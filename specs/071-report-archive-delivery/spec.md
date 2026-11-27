# Feature Specification: 上报先存档后投递、调度会话归档即重建与未读补投

**Feature Branch**: `fix/071-report-archive-delivery`

**Created**: 2026-11-27

**Status**: Approved

**Change Category**: 缺陷修复

**Input**: User description: "调查结论：调度会话归档时 send_report 假成功、消息被 archived gate 丢弃；调度会话不存在时在存档前抛错、报告不落盘。实现要求：1) 存档先于投递；2) 调度会话已归档等同于从未存在，无论来自飞书消息还是 send_report 都直接新建调度会话；3) 唤起或新建调度会话时，注入内容必须明确要求它先读当前任务以及所有未读的 send_report，不只是 latest_report；4) 并发报告、新建与投递、归档与投递、投递时的 claim/steer 竞态都要给出方案；5) 没有指定工作区时忽略报告。飞书注入消息创建调度会话的既有设计保持不变。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: 已归档的调度会话如何处理？ -> A: 归档等同不存在，新建调度会话后投递本份报告。飞书消息注入与 `send_report` 使用同一判定。
- [D-002] Q: 新建调度会话的触发条件？ -> A: 桥接状态没有会话标识、会话标识在 `archivedSessionIds` 中、或会话解析返回 `session/not-found` 时新建。其他解析错误按未送达处理。
- [D-003] Q: 新建调度会话使用哪套参数？ -> A: 复用桥接会话创建流程：插件配置的工作区与预设、宿主默认模型、固定标题、挂工作区、置顶并写入桥接状态。
- [D-004] Q: 未读报告如何标记？ -> A: 任务台账新增 `deliveredReportIds`；未读 = `reportIds` 减去 `deliveredReportIds`；投递成功后写入并提交。存量任务按「全部已投递」初始化。
- [D-005] Q: 注入内容包含什么？ -> A: 每次投递列出当前任务、该任务全部未读报告以及其他任务的全部未读报告；新建调度会话再加全部未结束任务快照；块内明确要求先读任务与全部列出的报告。飞书新建会话的任务快照同样列出未读报告并要求先读。调度提示词同步这条规则。
- [D-006] Q: 结果字段与形态？ -> A: `send_report` 按成功结果返回 `reportId`、`taskId`、`reportPath`、`delivered`；未送达时加 `reason`（`no_workspace`、`create_failed`、`delivery_failed`）。归档重建属于正常送达，不产生 `reason`。
- [D-007] Q: 没有工作区时如何忽略报告？ -> A: 不写报告、不改台账、不新建会话、不投递，返回 `delivered: false` 与 `no_workspace`。
- [D-008] Q: 自动上报与提问拦截是否共用同一路径？ -> A: 共用。`turn_end` 未送达只记日志；提问拦截未送达时退回既有拒绝反馈，任务保持 `in_progress`，轮次不因该上报结束。
- [D-009] Q: 竞态如何处理？ -> A: 存档与提交按工作区串行；投递按工作区一条队列串行，顺序等于存档顺序；新建调度会话单飞，创建后复核桥接状态；投递前复核归档状态，失败重试一次（重新解析或重建），仍失败则未送达且报告保持未读；投递成功后标记未读，标记失败允许下次重复投递。
- [D-010] Q: 解归档如何影响桥接状态？ -> A: 解归档不写回桥接状态。桥接状态指向新建会话时，旧会话不再是调度会话；解归档发生在投递判定之前时，复用该会话。
- [D-011] Q: 后续项是否纳入本次？ -> A: 不纳入。自动重试队列与退避、`turn_end` 标记时机、`pruneTasks` 列为后续；未读报告在下次投递或新建会话快照中补投。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 投递语义为至少一次，极端并发下同一报告可能重复列出；解归档不写回桥接状态，旧会话不再作为调度会话；新建会话或重试失败时报告停在未读状态，等待下次投递补投。

## 现状基线

以下结论均有代码证据：

1. `send_report` 先解析调度会话再存档：`resolveDispatchAgent` 在会话标识为空、解析返回错误时抛错（`src/lark-super-agent/service.ts:347-377`），调用发生在 `archiveReport` 之前（`service.ts:380-399`）。报告因此不落盘。
2. 存档内部先投递后提交：`delivery` 回调在 `commitFilesInQueue` 之前执行（`src/lark-super-agent/reports.ts:187-190`）。投递抛错时报告文件与台账 `reportIds` 已写、git 未提交、工具报错（`reports.ts:130-195`）。
3. `sendReport` 不读 `workspaceRegistry.archivedSessionIds`（`src/lark-super-agent/api.ts` 的 `WorkspaceRegistryLike`）。归档会话的投递照常返回 `delivered: true`。
4. 宿主对不存在的会话返回 `{ error }`，错误码为 `session/not-found`（`dsh-api-session-controller/lib/index.js` 的 `resolveAgent`）。归档状态由工作区注册表提供。
5. 飞书注入路径在会话归档时已重建：`resume` 遇到归档标识返回 `undefined`（`src/sessions.ts:165-168`），`ensure` 随后调用 `create`（`sessions.ts:311-333`）。该路径是本次「归档即重建」判定的既有实现。
6. 任务台账没有投递标记：`Task` 只有 `reportIds`（`src/lark-super-agent/api.ts:32-49`），台账 schema 同样只有该字段（`src/lark-super-agent/notes.ts:77-91`）。
7. 投递块只带当次报告：`taskSessionMessage` 接收单个 `reportPath`（`src/lark-super-agent/blocks.ts:41-63`），`sendReport` 用当前 `ArchivedReport` 组装（`service.ts:399-423`）。
8. 全新调度会话的任务快照只列 `latest_report`（`src/lark-super-agent/managed/task-log-injector.ts:143-164`），不列其他未读报告。
9. 存档与提交在同一条工作区串行队列中（`reports.ts:144`、`src/lark-super-agent/git.ts:71-85`）；投递不在独立队列中，多份报告并发时投递顺序取决于调度。
10. 客户端上报卡片只认 `delivered === true`（`src/client/report-node.ts:111`）。
11. 现有测试断言「调度会话不可用时上报失败且不写文件」（`tests/lark-super-agent-service.test.ts:322-338`），与新顺序相反。
12. `turn_end` 自动上报吞掉异常只记日志（`src/lark-super-agent/managed/turn-report.ts:115-129`）；提问拦截以异常判定回退（`src/lark-super-agent/managed/ask-guard.ts:199-225`），成功后置 `waiting_user` 并结束轮次（`src/lark-super-agent/managed/index.ts:86-97`）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 报告先存档与提交，再投递 (Priority: P1)

任务会话提交上报。插件先写报告文件与附件、更新台账 `reportIds` 并提交 git，随后才唤起或新建调度会话。投递失败时用户仍能在工作区找到完整报告，工具结果说明未送达。

**Why priority**: 报告是用户看到任务结果的唯一载体；投递失败连同存档一起丢掉会让工作无法追溯。

**Independent Test**: 让调度会话解析返回 `session/not-found` 以外的错误，调用一次 `send_report`，检查报告、附件、台账与 git 提交都存在，结果 `delivered: false`。

**Acceptance Scenarios**:

1. **Given** 被管理会话与可用工作区，**When** 投递抛错，**Then** 报告文件、附件、台账 `reportIds` 与 git 提交都存在，结果 `delivered: false` 且含 `reason`。
2. **Given** 报告已存档，**When** git 提交失败，**Then** 结果含 `warning`，投递照常执行。
3. **Given** 并发两份报告，**When** 存档完成，**Then** 两份报告按存档顺序投递。

---

### User Story 2 - 调度会话归档等同于不存在 (Priority: P1)

用户归档了调度会话。飞书消息到达或任务会话上报时，插件新建一个调度会话并把内容投递进去，桥接状态指向新会话。归档的会话不再被使用。

**Why priority**: 归档会话收不到消息；把「已归档」当作未送达会让用户永远看不到报告。

**Independent Test**: 把桥接状态记录的会话标识放进 `workspaceRegistry.archivedSessionIds`，调用 `send_report`，检查出现新会话、桥接状态更新、报告投递到新会话且结果 `delivered: true`。

**Acceptance Scenarios**:

1. **Given** 调度会话已归档，**When** 被管理会话调用 `send_report`，**Then** 报告已存档并提交，新建调度会话并投递。
2. **Given** 调度会话已归档，**When** 飞书消息注入，**Then** 新建调度会话并注入消息。
3. **Given** 调度会话解析返回 `session/not-found`，**When** 上报存档完成，**Then** 新建调度会话并投递。
4. **Given** 两个上报同时触发新建，**When** 存档完成，**Then** 只新建一个调度会话，两份报告投递到同一会话。

---

### User Story 3 - 未读报告完整补投 (Priority: P1)

报告曾因归档或投递失败而未送达。下一次投递或新建调度会话时，注入内容列出当前任务与全部未读报告，并要求调度会话先读这些文件。

**Why priority**: 只带最新报告会让旧报告留在磁盘上无人处理，用户看不到任务的历史结果。

**Independent Test**: 先制造两份未送达报告，再让调度会话可用并投递第三份，检查块内列出三份报告路径与「先读」要求；投递成功后台账 `deliveredReportIds` 记录三份。

**Acceptance Scenarios**:

1. **Given** 某个任务有两份未读报告，**When** 第三份报告投递成功，**Then** 块内列出三份报告路径，并要求先读当前任务与全部报告。
2. **Given** 其他任务有未读报告，**When** 任一份报告投递成功，**Then** 块内一并列出其他任务的未读报告，投递成功后全部标记已投递。
3. **Given** 调度会话被新建，**When** 首次投递，**Then** 块内含全部未结束任务快照与全部未读报告路径。
4. **Given** 调度会话由飞书消息新建，**When** 首个 pre-step 注入任务快照，**Then** 快照列出未读报告并要求先读。
5. **Given** 投递成功但标记失败，**When** 下一次投递，**Then** 同一报告可能再次列出；重复只增加提示。

---

### User Story 4 - 并发与归档竞争下的顺序和去重 (Priority: P1)

多份报告、新建会话、归档与解归档、投递同时发生时，存档顺序、投递顺序与会话唯一性保持确定；同一份报告在一次成功投递中只出现一次。

**Why priority**: 并发下重复新建会话、乱序投递或重复标记会让用户收到错误顺序和重复内容。

**Independent Test**: 并发调用多次 `send_report`，同时让会话处于归档状态，检查只新建一个会话、报告按存档顺序投递、每份报告只标记一次。

**Acceptance Scenarios**:

1. **Given** 会话缺失，**When** 三份报告并发存档，**Then** 只新建一个会话，三份报告按存档顺序投递。
2. **Given** 投递前会话被归档，**When** 首次投递失败，**Then** 重建会话并重试一次；重试成功后结果 `delivered: true`。
3. **Given** 重试仍失败，**When** 调用返回，**Then** 结果 `delivered: false`，报告保持未读。
4. **Given** 投递期间用户解归档旧会话，**When** 桥接状态已指向新会话，**Then** 投递继续使用新会话。
5. **Given** 同一报告已标记已投递，**When** 下一份报告投递，**Then** 块内不再列出该报告。

---

### User Story 5 - 没有工作区时忽略报告 (Priority: P2)

用户尚未选择桥接工作区。任务会话调用 `send_report` 时，插件不写文件、不改台账、不新建会话，返回未送达结果说明没有工作区。

**Why priority**: 没有工作区时报告没有归属；静默成功会让用户以为收到了报告。

**Independent Test**: 桥接状态 `workspaceRoot` 为空，调用 `send_report`，检查工作区无 `reports/`、桥接状态不变、结果 `delivered: false`。

**Acceptance Scenarios**:

1. **Given** 桥接状态无工作区，**When** 被管理会话调用 `send_report`，**Then** 不写报告、不建会话，结果 `delivered: false` 且原因为 `no_workspace`。
2. **Given** 桥接状态无工作区，**When** `turn_end` 自动上报触发，**Then** 只记一条未送达日志。

---

### Edge Cases

- 报告参数非法、调用方未管理：保持现有行为，在写文件前报错。
- 附件缺失：保持现有行为，在写文件前报错。
- 新建会话失败：保留存档，结果 `delivered: false` 与 `create_failed`，报告保持未读。
- 投递成功、标记已读失败：下一次投递重复列出，重复只增加提示。
- 新建的调度会话首轮未启动：投递沿用 `steer` 与收尾逻辑，空闲时改投 `followup`。
- 解归档发生在投递判定之后：本次投递仍走新建会话。
- 同一工作区并发上报：存档串行，投递串行，顺序一致。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 被管理会话的上报 MUST 按「写报告文件与附件 → 更新台账 `reportIds` → git 提交 → 唤起或新建调度会话 → 投递」的顺序执行。
- **FR-002**: 投递抛错时 MUST 保留报告文件、附件、台账与提交，结果 MUST 返回 `delivered: false` 与 `reason`。
- **FR-003**: 存档完成后 MUST 读取 `workspaceRegistry.archivedSessionIds`；桥接状态记录的会话在其中时 MUST 按不存在处理：新建调度会话并投递。飞书消息注入路径 MUST 使用同一判定。
- **FR-004**: 桥接状态无会话标识、或 `resolveAgent` 返回 `session/not-found` 时 MUST 新建调度会话。其他解析错误 MUST 返回未送达。
- **FR-005**: 新建调度会话 MUST 复用桥接会话创建流程，使用插件配置的工作区与预设、固定标题、挂工作区、置顶与桥接状态写入。
- **FR-006**: 任务台账 MUST 记录 `deliveredReportIds`；未读报告 MUST 为 `reportIds` 减去 `deliveredReportIds`。存量任务 MUST 按全部已投递初始化。
- **FR-007**: 每次投递块 MUST 列出当前任务、该任务全部未读报告与其他任务全部未读报告，并 MUST 明确要求先读任务与全部列出的报告。
- **FR-008**: 新建调度会话的首次投递块 MUST 包含全部未结束任务快照与全部未读报告路径。
- **FR-009**: 飞书新建调度会话的任务快照 MUST 列出未读报告并要求先读。
- **FR-010**: 投递成功后 MUST 把本次列出的报告写入 `deliveredReportIds` 并提交；标记失败 MAY 留到下次重复投递。
- **FR-011**: 同一工作区的存档与提交 MUST 串行；投递 MUST 使用按工作区的独立队列，顺序等于存档顺序。
- **FR-012**: 新建调度会话 MUST 单飞：同一工作区同时只有一个创建任务，创建后 MUST 复核桥接状态。
- **FR-013**: 投递前 MUST 复核桥接状态与归档列表；首次投递失败时 MUST 重建或重新解析后重试一次，仍失败 MUST 返回未送达且报告保持未读。
- **FR-014**: 桥接状态无工作区时 MUST 忽略报告：不写文件、不改台账、不新建会话、不投递，结果 `delivered: false` 且原因为 `no_workspace`。
- **FR-015**: git 提交失败 MUST 只记 `warning`，投递照常执行。
- **FR-016**: `send_report` 结果 MUST 含 `reportId`、`taskId`、`reportPath`、`delivered`；未送达 MUST 含 `reason`。工具描述 MUST 说明未送达时把内容保留在正文。
- **FR-017**: `turn_end` 自动上报 MUST 走同一路径；未送达只记日志。提问拦截未送达 MUST 退回既有拒绝反馈，任务保持 `in_progress`，轮次不因该上报结束。
- **FR-018**: 未被管理的会话调用 `send_report` MUST 仍报错且不存档；非法参数与非法附件 MUST 仍在写文件前报错。
- **FR-019**: 上报卡片 MUST 只在 `delivered: true` 时显示。
- **FR-020**: 解归档 MUST NOT 写回桥接状态。桥接状态指向新会话时，旧会话 MUST NOT 作为调度会话使用。
- **FR-021**: 调度提示词 MUST 说明：处理上报前先读当前任务与全部未读报告。
- **FR-022**: 机制变化 MUST 更新 `docs/how-it-works.md` 的上报投递与任务快照两节；用户可见行为变化 MUST 更新 `README.md`；CHANGELOG 按分支规则补充。

### Key Entities

- **Report**: 一次上报。属性为 `reportId`、`taskId`、`reportPath`、`kind`、`origin`、附件副本；存档含文件与 git 提交。
- **Task**: 任务。属性为 `id`、`sessionId`、`reportIds`、`deliveredReportIds`、状态与消息。
- **SendReportResult**: 工具结果。属性为 `reportId`、`taskId`、`reportPath`、`delivered`、可选 `reason`、可选 `warning`。
- **BridgeState**: 桥接状态。属性为 `sessionId`、`workspaceRoot`；`sessionId` 指向当前调度会话。
- **DispatchSession**: 调度会话。属性为会话标识、工作区、预设、标题；由飞书消息注入或上报路径创建。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 投递抛错时，一次 `send_report` 后报告文件、附件、台账 `reportIds` 与 git 提交都存在，工作区 `git status --porcelain` 为空。
- **SC-002**: 调度会话已归档时，一次 `send_report` 后新建会话、桥接状态更新、报告投递成功，结果 `delivered: true`。
- **SC-003**: 调度会话不存在时，一次 `send_report` 后新建会话并投递；桥接状态指向新会话。
- **SC-004**: 两份未读报告存在时，下一次投递的块内列出全部未读路径与「先读」要求，投递成功后 `deliveredReportIds` 含全部编号。
- **SC-005**: 并发三份报告且会话缺失时，只新建一个会话，报告按存档顺序投递，每份报告只记录一次已投递。
- **SC-006**: 桥接状态无工作区时，一次 `send_report` 后工作区无 `reports/` 新增，桥接状态不变，结果为 `no_workspace`。
- **SC-007**: 正常投递回归：报告文件、附件、注入块与卡片显示符合现有行为，结果 `delivered: true`。
- **SC-008**: 隔离 profile 的实机验证覆盖归档重建、会话不存在新建、未读补投、无工作区忽略与正常投递，全部通过；`pnpm full-check` 通过。

## 后续项

- 自动重试队列与退避。
- `turn_end` 标记时机。
- `pruneTasks` 清理已归档或不存在会话的任务。

## Assumptions

- 调度会话就是桥接会话，标题与预设来自插件配置。
- 新建的调度会话由投递直接开轮，不需要飞书消息触发。
- `workspaceRegistry.archivedSessionIds` 反映当前归档状态。
- 投递语义为至少一次：极端并发下同一报告可能被重复列出，文件内容不变。
- 本次不改 `lark_notify`，不改通知与归档通知的错误处理。