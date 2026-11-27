# Feature Specification: 调度会话切换会话模型与恢复已归档会话

**Feature Branch**: `feat/072-session-model-restore`

**Created**: 2026-11-27

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "给调度会话（sa-dispatch 预设）增加工具能力：1. 切换某个会话（任务会话 / 调度会话自身）的模型——在运行中指定 provider/model（以及 effort），让该会话后续轮次使用新模型。2. 取消会话归档（unarchive / 恢复已归档会话），并把任务、pin 等状态恢复到可用状态。需先调研 DSH 宿主与现有插件代码：session_* 系列 meta-tools、session_archive 的 remove 参数、模型切换在宿主侧是否有可用 API。"

## Open Decisions

None. 决策已由用户授权自行拍板，逐条记录在 Clarifications。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 「取消会话归档」指什么？ -> A: 解除归档，把会话恢复到未归档的可用状态。会话日志与工作目录都保留。见 Assumptions 第 1 条。
- [D-002] Q: 宿主是否已有切换模型的工具？ -> A: 没有。meta-tools 只提供 `session_create`、`session_stop`、`session_send`、`session_pin`、`session_archive`、`session_list`、`session_get`。宿主会话控制器有 `selectModel`，插件直接调用它背后的 `agent.model.select`。
- [D-003] Q: 插件通过什么路径切换模型？ -> A: 先用 `ctx.llm.resolveCallConfig` 校验 provider/model/effort，再对目标会话的 Agent 调用 `agent.model.select(selection)`。`session_create` 已用同一条路径。
- [D-004] Q: 是否复用宿主 `sessionController.selectModel`？ -> A: 不复用。`selectModel` 会把选择写成全局默认模型，切换一个任务会话的模型不应改变新建会话的默认模型。`agent.model.select` 只写会话自己的选择事件。
- [D-005] Q: 切换对正在运行的轮次有什么影响？ -> A: 当前已发出的模型请求不变。选择从下一步生效，宿主在下一步插入一条模型变更提示。任务会话正在执行时切换，当前轮剩余步与后续轮都用新模型。
- [D-006] Q: effort 如何校验？ -> A: `effort` 省略或空串表示沿用该路由的默认 effort。路由不支持指定的 effort、provider 未注册、model 不存在时，宿主校验抛错，工具把原错误信息放进失败结果。
- [D-007] Q: 会话不存在或为子代理会话时？ -> A: 宿主返回 `session/not-found` 或 subagent 归属错误，工具透传。
- [D-008] Q: 已归档会话能否切换模型？ -> A: 可以。选择被记录，但要等会话恢复后才进入模型步。结果显示 `archived: true`，提示先恢复。
- [D-009] Q: 恢复会话恢复哪些状态？ -> A: 解除归档、按需恢复任务、恢复置顶。任务恢复只处理最近一份结束原因为 `session_archived` 的归档任务；结束原因为 `completed`、`cancelled`、`unmanaged`、`session_missing` 时不恢复任务，会话恢复为未管理状态。
- [D-010] Q: 恢复是否默认重新置顶？ -> A: 是。归档会清掉 pin，恢复默认把会话放回置顶列表；传 `pin: false` 可跳过。
- [D-011] Q: 对未归档会话调用恢复工具？ -> A: 报错，说明该会话未归档。不做静默成功。
- [D-012] Q: 恢复任务时报告与任务日志如何处理？ -> A: 归档任务里的目录整体迁回原位：`archive/<taskId>/reports` 回到 `reports/<taskId>`，`archive/<taskId>/task-log.jsonl` 回到 `task-logs/<taskId>.jsonl`。任务记录回到 `message-task-status.json`，保留原 id、标题、消息、状态、报告列表与投递记录。归档目录删除。
- [D-013] Q: 恢复是否需要通知调度会话？ -> A: 不需要。工具只由调度会话自己调用，调用方已经知道结果。被归档时发出的 `task_session_archived` 通知不受影响。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 切换模型不改变全局默认模型，与其他会话的模型继承无关；恢复任务依赖归档目录里的 `task.json`，目录被手工删除时任务无法恢复；恢复后旧报告按未读重新参与投递列表，可能再次列出。

## 现状基线

以下结论均有代码证据：

1. 调度会话的能力由 `sa-dispatch` 子行注册：`session_create`、`list_models`、`task_update`、`task_end`、`session_manage`、`session_unmanage`、`workspace_note_set`、`workspace_note_remove`（`src/sa-dispatch/index.ts`、`src/sa-dispatch/tools.ts`）。
2. `session_pin` 与 `session_archive` 来自 meta-tools 行，`session_archive` 已有 `remove: true` 用于解除归档，`session_archive` 的 `stop_activity` 用于归档前停止工作（`dsh-plugin-meta-tools` 的 `buildSessionArchiveTool`）。
3. 宿主没有切换会话模型的工具。会话控制器把 `selectModel` 暴露为远程方法，内部先 `resolveAgent`，再 `llm.resolveCallConfig`，然后 `agent.model.select`，最后异步保存全局默认模型（`@deepseek-ai/dsh-api-session-controller` 的 `commands.ts`）。
4. 宿主 `AgentModel.select` 只追加一条 `model/selection` 事件；`AgentModel.current` 按「待生效选择 → 最近使用」读取（`@deepseek-ai/dsh-agent` 的 `model-selection.ts`）。
5. 每一步的 `agent/pre-step` 携带当步的 `modelSelection`；模型变更提示由宿主插入，effort 单独变化不插提示（同文件）。
6. 归档会同时清掉 pin，`unarchiveSession` 只把 id 从归档集合移除，不恢复 pin（`@deepseek-ai/dsh-workspace` 的 `index.ts`）。
7. 归档会话在模型步上被拒：`ArchivedSessionGate` 在 `agent/pre-step` 直接拒绝（`@deepseek-ai/dsh-api-session-controller` 的 `archived-session-gate.ts`）。
8. 会话归档时任务被结束：`notifyArchived` 与 `pruneTasks` 都以 `session_archived` 结束任务（`src/lark-super-agent/service.ts:716`、`src/lark-super-agent/notes.ts:404`）。
9. 任务归档写入 `archive/<taskId>/task.json`，并把 `reports/<taskId>` 与 `task-logs/<taskId>.jsonl` 移入归档目录（`src/lark-super-agent/notes.ts:361`）。
10. 台账按会话唯一：`readTaskState` 校验任务 id 与会话 id 不重复（`src/lark-super-agent/notes.ts:169`）。
11. 未读报告按 `reportIds` 减去 `deliveredReportIds` 计算，路径固定为 `reports/<taskId>/<reportId>.md`（`src/lark-super-agent/managed/task-log-injector.ts:160`）。
12. `list_models` 已能枚举 provider、model 与支持的 effort，切换模型沿用同一份目录（`src/sa-dispatch/list-models.ts`）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 切换某个会话的模型 (Priority: P1)

用户在飞书里指定「把 <任务> 换成 provider/model」，调度会话调用会话模型工具。任务会话后续轮次改用新模型，当前正在执行的请求保持原模型。

**Why priority**: 调度会话当前只能在新建任务会话时选模型，任务跑起来后无法改。

**Independent Test**: 对一个任务会话调用 `session_model` 指定另一条路由，检查会话的 `modelSelection` 投影在下一步变为新路由，且全局默认模型不变。

**Acceptance Scenarios**:

1. **Given** 一个可用的任务会话，**When** 用合法的 provider、model、effort 调用 `session_model`，**Then** 结果返回会话 id 与生效选择，会话下一步使用新路由。
2. **Given** 切换自己的模型，**When** 调度会话省略 `session_id`，**Then** 目标为调用方会话。
3. **Given** 路由不存在或 effort 不被支持，**When** 调用 `session_model`，**Then** 工具失败并给出宿主校验错误，会话选择保持不变。
4. **Given** 任务会话正在执行一轮，**When** 切换模型，**Then** 当前请求不受影响，下一步与后续轮次使用新模型。

---

### User Story 2 - 恢复已归档会话 (Priority: P1)

用户要求恢复一个已归档的任务会话。调度会话调用会话恢复工具，会话离开归档列表、任务重新可用并恢复置顶，之后可以继续用 `session_send` 与 `send_report` 协作。

**Why priority**: 归档后任务结束、pin 丢失、归档门禁拒绝模型步；只调 `session_archive remove: true` 会留下无法上报的会话。

**Independent Test**: 归档一个被管理会话（任务以 `session_archived` 结束），调用 `session_restore`，检查会话不再归档、任务回到台账并带原报告、pin 恢复。

**Acceptance Scenarios**:

1. **Given** 一个因归档而结束任务的会话，**When** 调用 `session_restore`，**Then** 会话解除归档、任务恢复、pin 恢复，结果给出 `taskId`。
2. **Given** 任务结束原因为 `completed` 的会话，**When** 调用 `session_restore`，**Then** 会话解除归档、没有任务、pin 恢复，结果标明任务未恢复。
3. **Given** 该会话未归档，**When** 调用 `session_restore`，**Then** 工具失败并说明未归档。
4. **Given** 传 `pin: false`，**When** 调用 `session_restore`，**Then** 会话解除归档且保持未置顶。
5. **Given** 会话已恢复但置顶失败，**When** 调用 `session_restore`，**Then** 结果为部分成功，带 `pinned: false` 与警告。

---

### Edge Cases

- 会话 id 首尾带空白：按去空白后的 id 处理。
- 归档任务是会话的第二次归档：只恢复最近一份 `session_archived` 归档任务。
- 归档目录里的 `task.json` 缺失或损坏：会话照常解除归档，任务不恢复，结果带警告。
- 台账已存在该会话的未结束任务：不再恢复第二份，跳过任务恢复并带警告。
- `workspaceRegistry` 不可用：恢复工具失败并说明注册表不可用。
- effort 传空串与省略等效。
- provider 或 model 传空串：参数错误，不发起任何切换。
- 恢复已归档的调度会话自身：允许，恢复的是桥接状态里记录的那个会话，不重建新会话。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 调度会话必须能切换本预置列出的任意会话的模型，包括任务会话与调度会话自身。
- **FR-002**: 切换模型必须接受 `session_id`、`provider`、`model`，以及可选的 `effort`；`session_id` 省略时目标是调用方会话。
- **FR-003**: `provider` 与 `model` 必须成对出现；任一为空时按参数错误失败。
- **FR-004**: 切换前必须经宿主模型运行时校验 provider、model 与 effort，校验失败必须失败且不改动目标会话。
- **FR-005**: 切换只改变目标会话自己的选择，不得改变宿主全局默认模型，也不得改动其他会话。
- **FR-006**: 切换结果必须给出目标会话 id 与生效的 provider、model、effort；省略 effort 时不回填猜测值。
- **FR-007**: 目标会话已归档时，切换必须被记录，并在结果中标明会话已归档且需先恢复。
- **FR-008**: 调度会话必须能把已归档会话恢复为未归档状态。
- **FR-009**: 恢复必须只处理确实在归档集合中的会话；未归档会话按失败处理并说明原因。
- **FR-010**: 恢复必须把最近一份结束原因为 `session_archived` 的归档任务恢复到未归档台账，保留任务 id、标题、状态、消息、报告列表、投递记录与创建时间。
- **FR-011**: 恢复任务必须把归档的报告目录与任务日志迁回原位，并删除该任务的归档目录。
- **FR-012**: 结束原因不是 `session_archived` 的归档任务不恢复；此时恢复结果必须标明没有恢复任务。
- **FR-013**: 恢复必须默认把会话重新置顶，并允许调用方用 `pin: false` 关闭。
- **FR-014**: 置顶失败不得回滚已完成的解除归档与任务恢复；结果必须标明 `pinned: false` 与原因。
- **FR-015**: 恢复任务过程中的记录写入必须与既有台账写入一样原子落盘并做限定路径 git 提交。
- **FR-016**: 调度提示词必须说明两个新工具的用途与使用时机。
- **FR-017**: 会话恢复后必须能继续接收 `session_send` 消息并再次调用 `send_report` 上报。

### Key Entities

- **会话模型选择**：目标会话的 provider、model 与可选 effort，记录在会话日志中，从下一步生效。
- **归档任务**：`archive/<taskId>` 下的 `task.json`，含任务记录、归档时间与结束原因，可附带报告目录与任务日志。
- **恢复结果**：会话 id、是否恢复任务、任务 id、是否置顶、警告。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 用一次工具调用即可把任意指定会话的模型切到任一路由，结果含会话 id 与生效选择。
- **SC-002**: 切换后目标会话的下一步请求携带新路由，其他会话的选择与全局默认模型保持不变。
- **SC-003**: 非法路由或 effort 在一步内失败，目标会话的选择与切换前一致。
- **SC-004**: 用一次工具调用即可把因归档而结束的任务恢复到可上报状态，任务 id 与报告列表保持不变。
- **SC-005**: 恢复后该会话不再出现在归档集合，并出现在置顶集合。
- **SC-006**: 对未归档会话调用恢复工具时一次失败并给出原因。

## Assumptions

1. 「取消会话归档」等于解除归档（unarchive），把会话恢复成未归档的可用状态。它不删除会话日志、任务台账或工作目录。
2. 只有调度会话（sa-dispatch 预设）需要这两个工具；其他预设的会话不注册它们。
3. 模型切换的权限沿用调度会话已有权限：调度会话能管理哪些会话，就能切换哪些会话的模型。
4. effort 的合法取值来自宿主模型目录；`list_models` 的结果足以选择 effort。
5. 恢复置顶默认开启，因为归档会清掉 pin，而调度会话创建的任务会话通常处于置顶状态。
6. 任务恢复只覆盖因归档而结束的任务；已完成或已取消的任务保持归档。