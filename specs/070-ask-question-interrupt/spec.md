# Feature Specification: 修复被管理会话提问被拦截后问题丢失或挂起

**Feature Branch**: `fix/070-ask-question-interrupt`

**Created**: 2026-11-26

**Status**: Draft

**Change Category**: 缺陷修复

**Input**: User description: "被管理的任务会话调用 Ask user question（向用户提问的工具）时会被卡住（一直等待），而不是像预期的那样立刻中断当前轮次、把问题上报出去（kind=question，任务置 waiting_user）。"

## Open Decisions

- [ ] [D-001] 提问转上报的正文格式。建议：逐条列出问题、表头与选项，结尾提示「在调度会话或飞书中回答即可」，不要求任务会话再调 `send_report`。理由：正文必须让用户无需回到任务会话就能直接回答。 | Depends on: none | Status: pending
- [ ] [D-002] 投递 `question` 上报后由谁把任务置 `waiting_user`。建议：插件在投递成功时直接把 `in_progress` 的任务置 `waiting_user`，已是 `waiting_user` 时跳过。理由：去除对调度会话再执行 `task_update` 的依赖，状态与问题同时落地。 | Depends on: D-005 | Status: pending
- [ ] [D-003] 上报投递失败时的行为。建议：退回现状——拒绝该次调用、注入 S 提示模型改用 `send_report`，轮次继续。理由：静默丢问题比多一轮模型重试更糟。 | Depends on: none | Status: pending
- [ ] [D-004] 被拦截调用对模型的结果反馈。建议：结果文本明确「问题已代为上报，任务等待用户回答，本轮到此结束」；空 `answers` 仅作占位。理由：模型不能把拦截误解为用户跳过了问题。 | Depends on: none | Status: pending
- [ ] [D-005] 同一轮次多次提问的处理。建议：每次调用独立拦截并各自上报一条 `question`，任务保持 `waiting_user`。理由：与单次行为一致，无需去重逻辑。 | Depends on: none | Status: pending

## Clarifications

尚无记录。

## Review Record

尚无记录。

## 现状基线

以下结论均有代码或运行时证据：

1. 宿主 `ask_user_question`（`@deepseek-ai/dsh-tool-ask-user`，legacy 模式）的执行体等待 `user-questions/request` waterfall，直到某个已连接的界面提交答案；无人回答时永久等待（`dsh-user-questions/src/index.ts:291-352`）。宿主没有 `waiting_user` 或轮次挂起原语，等待期间轮次保持 running。
2. 本插件当前的拦截是「执行前拒绝」：被管理会话的调用在 `tools/pre-execute` 返回 deny，反馈文本要求模型改用 `send_report(kind=question)`，随后在下一次模型请求前注入临时指令 S（`src/lark-super-agent/managed/ask-guard.ts:91-105`、`task-rules.ts`）。问题内容只有模型随后主动调用 `send_report` 才会送达调度会话。
3. 拒绝路径不结束轮次：工具被拒后循环继续，模型可以接着做任何事；是否上报、何时上报完全依赖模型遵循指令。
4. 任务状态 `waiting_user` 由调度会话在收到 `question` 上报后执行 `task_update` 落账（`src/sa-dispatch/prompt.ts:41`），插件上报路径自身不改状态。
5. 生产证据（2026-11-26）：被管理会话 `session-1b54fe86`（task-20261126150548-9d53）的 5 次 `ask_user_question` 调用全部进入了真实等待——3 次由用户在界面回答（9～101 秒），1 次等待 1228 秒后由用户取消，1 次跨日未决。这些调用发生在 presence 时代构建（0.4.6 及更早）运行期间；主工作区 `dist/` 截至本日仍是含 `AWAY_ERROR` 的 pre-067 产物，实机使用该产物复现出同样的「提问挂起」。
6. 同日晚些（宿主 17:57 重启、加载 0.4.7 后），`session-06956f2f` 的 `ask_user_question` 在 3 毫秒内被拒绝，模型随即调用 `send_report(kind=question)` 上报。说明 HEAD 的拒绝路径本身生效，缺陷表现为第 2、3 条的机制缺口与第 5 条的历史产物叠加。
7. 2026-11-26 当天 0.4.6→0.4.7 的热升级曾让宿主进程残留旧模块（诊断记录见 task-20261126181045-6459 的上报），混合状态下旧守卫实例仍在服务。
8. 宿主数据通道支持在工具步终止轮次：工具调用可调用 `exec.concludeTurn()`，成功的工具结果携带 `concludesTurn` 时「ends the turn at its step」，同批已提交的工作照常收尾（`dsh-tools/src/contracts.ts:261`、`pipeline.ts:144,567`，`dsh-agent/src/runtime-types.ts:408`）。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 被管理会话的提问立刻转为上报 (Priority: P1)

任务会话（有未结束任务）调用 `ask_user_question`。工具执行体没有运行，没有进入任何等待；本次调用的问题被插件转成一条 `kind=question` 上报投递到调度会话；任务置为 `waiting_user`；当前轮次在该调用所在步结束。模型在工具结果里看到「已代为上报」。

**Why this priority**: 这是缺陷本身。远程用户只能经调度会话/飞书收到问题；任何进入等待或依赖模型自觉的路线都会让问题石沉大海。

**Independent Test**: 实机（或单测等价）驱动被管理会话调用 `ask_user_question`，断言：宿主网关无 `user-questions/request` 挂起；`reports/<taskId>/` 新增一条 `kind=question` 且 `origin` 标记为拦截来源；台账任务状态为 `waiting_user`；本轮 `turn/end` 原因为正常结束且发生在调用后的同一步内。

**Acceptance Scenarios**:

1. **Given** 会话有未结束任务，**When** 模型调用 `ask_user_question` 提出 1～N 个问题，**Then** 执行体不运行，产生一条包含全部问题与选项的 `question` 上报，任务变 `waiting_user`，轮次在该步结束。
2. **Given** 同一轮稍后再次调用（新一轮次或同轮并行批次），**When** 会话仍被管理，**Then** 每次调用各自上报一条 `question`。
3. **Given** 调用发生在并行工具批次中，**When** 同批其他工具返回，**Then** 轮次在批结束步关闭，其他结果照常入账。

### User Story 2 - 未被管理会话不受影响 (Priority: P2)

没有未结束任务的会话调用 `ask_user_question`，行为与宿主默认一致：问题面板出现，等待用户回答。

**Why this priority**: 拦截范围必须精确到被管理会话，否则会破坏用户在本地会话里的正常提问。

**Independent Test**: 未被管理会话调用该工具，断言工具执行体运行、无上报产生、任务台账不变。

**Acceptance Scenarios**:

1. **Given** 会话未被管理，**When** 调用 `ask_user_question`，**Then** 无拦截、无上报，等待语义由宿主决定。

### User Story 3 - 上报失败退回拒绝 (Priority: P3)

拦截时代码路径无法完成上报（投递异常）。此时退回到现状：拒绝该次调用并反馈「改用 `send_report`」，注入 S，轮次继续。

**Why this priority**: 缺陷修复不能引入静默丢失；投递失败时把决定权交回模型是现有可验证行为。

**Independent Test**: 令投递失败（模拟 `send_report` 抛错），断言工具结果为拒绝反馈、无任务状态变更、轮次未提前结束。

**Acceptance Scenarios**:

1. **Given** 上报投递失败，**When** 拦截执行，**Then** 返回既有拒绝反馈文本，任务状态不变。

### Edge Scenarios

- 会话在提问等待期间才开始被管理：沿用现有取消路径（可中止信号与网关取消），结束等待并照常走拦截上报。
- 插件未加载或台账判定为未被管理：宿主默认语义，本特性不新增行为。
- 调度会话自身调用该工具：调度会话永远未被管理，宿主默认语义。

## Functional Requirements

- **FR-001** 被管理会话调用 `ask_user_question` 时，插件 MUST 阻止其执行体运行，任何情况下不进入用户回答等待。
- **FR-002** 拦截发生时，插件 MUST 依据本次调用的问题列表立即生成并投递一条 `kind=question` 上报，`origin` 取新增值 `ask_intercept`，正文含每个问题的题面、表头与选项（D-001）。
- **FR-003** 上报投递成功后，插件 MUST 将该任务从 `in_progress` 置为 `waiting_user`；已是 `waiting_user` 或 `failed` 时保持不变（D-002）。
- **FR-004** 上报投递成功后，插件 MUST 使当前轮次在该调用所在步结束，同一批次的其余工具结果照常入账（D-004、宿主 `concludesTurn` 通道）。
- **FR-005** 上报投递失败时，插件 MUST 退回既有的拒绝反馈与 S 注入，轮次继续，任务状态不变（D-003）。
- **FR-006** 未被管理会话与调度会话的 `ask_user_question` 行为 MUST 与宿主默认一致。
- **FR-007** 被拦截调用的工具结果 MUST 向模型说明问题已代为上报、任务正等待用户回答（D-004）。
- **FR-008** 文档 `docs/how-it-works.md` 与 `docs/known-risks.md` MUST 同步：提问拦截从「拒绝 + 提示」改为「拦截 + 代为上报 + 终止轮次」，并更新依赖宿主私有接口的风险描述。

## Key Entities

- **Report（拦截来源）**: 现有上报实体新增 `origin = ask_intercept`；正文来自被拦截调用的问题列表（FR-002）。
- **AskGuard**: 现有组件的职责从「拒绝并提示」扩展为「拦截、代为上报、置状态、终止轮次、失败退回拒绝」。
- **Task 状态机**: 复用现有 `in_progress → waiting_user` 转换，新增由插件在拦截路径直接触发（FR-003）。

## Success Criteria *(mandatory)*

- **SC-001** 被管理会话调用 `ask_user_question` 后 5 秒内：该调用完成、轮次结束、`question` 上报存档并投递（以事件与文件断言）。
- **SC-002** 拦截路径下宿主网关 `user-questions/request` 挂起数始终为 0（实机验证记录）。
- **SC-003** 任务台账在拦截后状态为 `waiting_user`；投递失败时保持原状态（单测覆盖两条分支）。
- **SC-004** 未被管理会话行为回归为 0：拦截与上报均不发生（单测 + 实机对照）。

## Assumptions

- 沿用 legacy 阻塞语义宿主（`dsh` 0.2.2-rc.5）；timed 模式同样在调用入口被拦截，无需分支处理。
- 上报的送达、飞书通知与用户回答回注沿用现有 `send_report` 链路，本特性不改动。
- 用户在任务会话界面直接回答提问的场景维持 069 D-013 的开放状态，本特性只记录，不处理。
