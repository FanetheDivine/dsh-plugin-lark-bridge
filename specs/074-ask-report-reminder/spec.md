# Feature Specification: 被管理会话提问改为打断并注入 S 要求自行上报

**Feature Branch**: `feat/074-ask-report-reminder`

**Created**: 2026-11-27

**Status**: Draft

**Change Category**: 插件变更

**Input**: User description: "当前任务会话调用 ask_user_question 时，会话会直接中断，且问题会直接回到任务会话。此处需要改为：打断任务会话，注入「S」，要求调用 send_report。原因：模型的提问内容与上下文内容关联紧密，用户可能已经忘记这个任务是干什么的了。"

## Open Decisions

None. 逐条决策见 Clarifications。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 「S」指什么？ -> A: 仓库既有约定。S 是 `src/lark-super-agent/managed/task-rules.ts` 的 `TASK_RULES_TEXT`，一条 `source.kind = 'lark-task-rules'` 的临时用户消息，由 `AskGuard` 排队、`agent/pre-step` 在下一次模型请求前插到消息列表前面；代码注释（`ask-guard.ts:3`、`index.ts:145`）与 `docs/how-it-works.md:253` 都写作「S」。
- [D-002] Q: 拦截后是否还由插件代为投递提问？ -> A: 否。插件不再在拦截时投递 `question` 上报，改由任务会话按 S 的要求自己调用 `send_report(kind=question)`，正文带上任务目的、当前状态、提问与选项。
- [D-003] Q: 被拦截的提问如何终止轮次？ -> A: 不再终止。`tools/pre-execute` 对被管理会话的提问返回拒绝并把提问内容记入待注入的 S，轮次继续到下一步，模型在下一步收到 S 后上报。
- [D-004] Q: 被拦截的提问内容如何不丢失？ -> A: 两处保留。S 正文列出被拦截调用的题面与选项；轮次结束时仍未上报的提问由插件补投一条 `origin=ask_intercept` 的 `question` 上报。
- [D-005] Q: 任务状态 `waiting_user` 谁落账？ -> A: 上报驱动。模型上报的提问由调度会话按既有规则置 `waiting_user`；只有补投路径由插件在投递成功后置状态。
- [D-006] Q: 会话已被用户停止如何处理？ -> A: 补投照常进行。轮次以 `aborted` 结束时，插件仍把未上报的提问投递给调度会话，避免远程用户看不到问题。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 提问送达依赖模型按 S 行动，模型不行动时由轮次结束补投兜底，兜底正文不含模型补充的背景

## 现状基线

2026-11-27，HEAD `9d96e7b`，宿主 `0.2.2-rc.5`。链路均有代码行号支撑：

1. `tools/pre-execute`（`src/lark-super-agent/managed/ask-guard.ts:132-149`）对被管理会话的 `ask_user_question` 返回 `allow`，只为提前结束该会话已挂起的旧提问。
2. `tools/execute` 环绕钩子（`ask-guard.ts:151-176`）对已被管理且装配了 `intercept` 的调用不执行工具体，直接走 `interceptCall`（`:199-222`）。
3. `interceptCall` 调用装配注入的 `intercept`（`src/lark-super-agent/managed/index.ts:86-99`）：`service.sendReport({kind:'question', text: questionReportText(questions)}, sessionId, 'ask_intercept')`，投递成功后把 `in_progress` 任务置 `waiting_user`，并调用 `reporter.markIntercepted(sessionId)`。
4. 随后 `exec.concludeTurn()`（`ask-guard.ts:215`）经宿主 `concludesTurn` 数据通道在当前步结束轮次；`tools/post-execute`（`:178-197`）把结果内容换成 `ASK_REPORTED_NOTICE`。
5. 上报投递失败时（`:207-213`）退回拒绝反馈并调用 `requireRules(sessionId)` 排队 S；`agent/pre-step`（`index.ts:143-155`）在下一步把 S 插到消息列表最前。
6. 调度会话收到 `question` 上报后按提示词置任务 `waiting_user`（`src/sa-dispatch/prompt.ts:72`）。
7. 轮次结束自动上报：`TurnReporter` 在正常结束、本轮未上报、无运行中子代理时补投 `progress`（`src/lark-super-agent/managed/turn-report.ts:109-124`）；`markIntercepted` 抑制该次补投（`:100-103`）。

问题：上报正文只由插件按调用参数拼成（题面、表头、选项），不含任务背景；用户不记得任务时无法判断该问题在问什么。模型自己的上下文里才有这份背景。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 提问转成一次自足的上报 (Priority: P1)

任务会话调用 `ask_user_question`。该调用被拒绝，工具体不运行，用户看不到原来的提问面板；轮次继续，模型在下一步收到 S，S 说明提问没有送达用户、要求调用 `send_report` 并把任务目的、当前状态、提问与选项写进正文。调度会话收到这条 `question` 上报后置 `waiting_user` 并转达用户。

**Why this priority**: 这是需求本身。用户不记得任务时，只有任务会话能写出足够背景。

**Independent Test**: 单测驱动 `tools/pre-execute` 与 `agent/pre-step`，断言拒绝、S 内容含被拦截的题面与选项、轮次未终止（`concludeTurn` 未被调用、无 `sendReport` 调用）。

**Acceptance Scenarios**:

1. **Given** 会话有未结束任务，**When** 模型调用 `ask_user_question` 提出 1～N 个问题，**Then** 该调用被拒绝，工具体不运行，插件不投递上报，S 在下一次模型请求前注入，S 正文含每个问题的题面与选项。
2. **Given** 模型收到 S，**When** 模型调用 `send_report(kind=question)`，**Then** 上报按既有链路存档、投递并驱动任务状态，插件不再重复投递该提问。
3. **Given** 模型收到 S 后没有上报，**When** 该轮结束，**Then** 插件补投一条含被拦截题面与选项的 `question` 上报，任务置 `waiting_user`，本轮不再补投 `progress`。

### User Story 2 - 未被管理会话不受影响 (Priority: P2)

没有未结束任务的会话调用 `ask_user_question`，行为与宿主默认一致：问题面板出现并等待用户回答。

**Why this priority**: 拦截范围必须精确到被管理会话。

**Independent Test**: 未被管理会话调用该工具，断言无拒绝、无 S、无上报。

**Acceptance Scenarios**:

1. **Given** 会话未被管理，**When** 调用 `ask_user_question`，**Then** 保持原决策，无 S 排队。

### User Story 3 - 重复与并发提问 (Priority: P3)

同一轮里模型多次调用 `ask_user_question`，或在并行批次中调用。

**Why this priority**: 拦截后模型可能重试；内容不能重复膨胀，也不能丢。

**Independent Test**: 同一会话连续两次拦截，断言 S 只注入一次且包含两次的题面；重复的相同参数只保留一份。

**Acceptance Scenarios**:

1. **Given** 同轮已被拦截一次，**When** 再次被拦截，**Then** S 仍只注入一次，正文合并两批问题，同内容的重复调用只列一次。
2. **Given** 多个被管理会话同时被拦截，**When** 各自下一步到来，**Then** 每个会话收到只属于自己的 S。

### Edge Scenarios

- 会话在拦截前已有等待中的提问：沿用既有取消路径，结束等待并排队 S。
- 问题参数缺失或不是数组：S 仍注入，说明按自己上下文复述问题，补投路径使用固定说明句。
- 上报失败（投递未送达）：由模型自己的 `send_report` 结果显示，插件不改写该调用结果。
- 会话在轮次结束前被停止（`aborted`）：补投照常执行。
- 会话已结束管理或任务已归档：不补投。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001** 被管理会话调用 `ask_user_question` 时，插件 MUST 阻止工具体运行，且 MUST NOT 由插件投递该提问。
- **FR-002** 被拦截的调用 MUST 让当前轮次继续，插件 MUST NOT 依据该调用结束轮次。
- **FR-003** 拦截发生时，插件 MUST 把该次调用的问题记为待注入内容，并在下一次模型请求前注入 S（`source.kind = 'lark-task-rules'`）。同一会话同一时刻只保留一条 S。
- **FR-004** S 正文 MUST 说明提问未送达用户、要求调用 `send_report(kind=question)`，并 MUST 列出被拦截调用的题面与选项（D-004）。
- **FR-005** S 正文 MUST 要求上报自足：任务目的与当前状态、提问本身、选项与建议。
- **FR-006** 模型上报的提问 MUST 视为已送达；插件 MUST NOT 再补投同一批问题（D-004）。
- **FR-007** 轮次结束时仍有未上报的被拦截提问，插件 MUST 补投一条 `question` 上报（`origin = ask_intercept`），正文列出题面与选项；投递成功后把 `in_progress` 任务置 `waiting_user`（D-005）。
- **FR-008** 补投发生时，插件 MUST 抑制该轮的 `turn_end` 进度上报。
- **FR-009** 未被管理会话与调度会话的 `ask_user_question` 行为 MUST 与宿主默认一致。
- **FR-010** 重复或并发的拦截 MUST 合并到同一条 S，相同问题只列一次；不同会话的待注入内容互不影响。
- **FR-011** 文档 `docs/how-it-works.md` MUST 同步提问拦截与 S 注入的现行行为；`docs/known-risks.md` MUST 记录提问送达依赖模型遵循 S 的风险。
- **FR-012** 仓库既有约定 MUST 保持不变：上报来源 `ask_intercept`、`waiting_user` 转换表、`send_report` 描述与调度会话提示词不改。

### Key Entities

- **S**: `source.kind = 'lark-task-rules'` 的临时用户消息；正文由固定说明与被拦截提问组成。
- **PendingQuestions**: 会话级待补投提问集合；上报送达、补投完成或轮次结束补投后清空。
- **Report（`origin = ask_intercept`）**: 仅由补投路径产生。

## Success Criteria *(mandatory)*

- **SC-001** 被管理会话调用 `ask_user_question` 后，宿主网关 `user-questions/request` 挂起数为 0，且插件侧 `sendReport` 调用数为 0（单测断言）。
- **SC-002** 拦截后下一步的消息列表第一条为 S，正文含被拦截调用的题面与全部选项（单测断言）。
- **SC-003** 模型上报后补投为 0；未上报时轮次结束补投 1 条并置 `waiting_user`（单测覆盖两条分支）。
- **SC-004** 未被管理会话拦截与注入次数均为 0（单测 + 实机对照）。

## Assumptions

- 宿主 `tools/pre-execute` 的拒绝结果返回给模型后轮次继续，宿主自身的 `ask` 审批路径不介入（070 research R2）。
- 调度会话按 `question` 上报置 `waiting_user` 的既有规则不变。
- 上报投递、飞书通知与用户回答回注链路不变。
