# Feature Specification: 被管理会话提问直接返回上报指令 S

**Feature Branch**: `feat/074-ask-report-reminder`

**Created**: 2026-11-27

**Status**: Draft

**Change Category**: 插件变更

**Input**: 「直接把 S 作为 ask_user_question 的回答，也不需要把被拦截的问题告知模型，让它调用 send_report。」

## Open Decisions

无。最新需求已明确工具结果、题面处理与上报方式。

## Clarifications

### Session 2026-11-27

- [D-001] S 是仓库已有的提问转上报指令，正文见 `src/lark-super-agent/managed/task-rules.ts` 的 `TASK_RULES_TEXT`。本功能将固定正文作为 `ask_user_question` 的成功结果交给模型。
- [D-002] 模型从原上下文组织任务目的、当前进展、问题与选项，调用 `send_report(kind=question)`。插件不复制题面和选项，不维护待上报问题，也不补发提问。
- [D-003] 拦截不终止轮次。调度会话按普通 `question` 上报更新 `waiting_user`。用户停止轮次时，插件尊重停止，不为这次提问唤醒会话或发报告。

## Review Record

- 2026-11-27：按用户最新要求直接实施。当前规格仍为 Draft，未获正式批准或豁免。PR 暂缓。

## 排查基线

基线 `9d96e7b` 的执行路径见 [research.md](./research.md)。该路径由插件用题面和选项生成 `origin=ask_intercept` 上报，随即结束轮次；报告缺少任务会话掌握的背景。

## User Scenarios & Testing

### User Story 1 — 收到带任务背景的提问 (P1)

被管理任务会话调用 `ask_user_question` 时，模型直接收到 S。S 要求模型发送一份独立可读的提问报告，让用户脱离任务会话也能回答。

**Independent Test**: 给拦截调用传入可识别的题面和选项，验证工具体未执行，结果为成功且正文恰好为固定 S，当前轮次继续，插件未创建报告或附加提醒消息。

**Acceptance Scenarios**:

1. 被管理会话直接调用工具，用户不进入提问面板；模型获得 S。正文说明尚未收到用户回答，并要求模型用原上下文组织报告。
2. 模型调用 `send_report(kind=question)` 后，调度会话按普通报告流程处理并将任务置为 `waiting_user`。
3. 模型未上报或用户停止轮次时，插件不代发该问题。常规轮次结束进度上报与失败通知仍按各自规则处理。

### User Story 2 — 保持宿主提问与取消行为 (P2)

未被管理的会话与调度会话继续使用宿主提问工具。会话被纳管或插件加载时，已在等待的请求沿用既有取消机制。

**Independent Test**: 比较未被管理调用和被纳管前就已等待的请求，分别确认透传与取消后的一次 S 提醒。

**Acceptance Scenarios**:

1. 调度会话或未被管理的会话调用提问工具，宿主原有决策和工具结果保持不变。
2. 会话被纳管或插件加载时，插件成功结束目标会话已在等待的提问。下一次模型请求可以收到一次 S 提醒；插件不主动开启新轮次。

### Edge Cases

- 同一轮重复提问或多条调用并发时，每个已拦截的调用返回各自的固定 S。
- 其他执行前钩子拒绝或取消时，保留其决定。管理状态下的审批请求直接交由插件结果处理，无需等待审批。
- `send_report` 的投递失败仍通过工具结果返回；拦截本身不更改任务状态。

## Requirements

### Functional Requirements

- **FR-001** 被管理会话的提问 MUST 在工具体执行前被接管；本次调用以固定 S 成功返回，当前轮次继续。
- **FR-002** S MUST 要求模型调用 `send_report(kind=question)`，并从自己的上下文写清任务目的、当前进展、问题与选项。
- **FR-003** 插件 MUST NOT 为这条调用复制或记录题面与选项、额外注入 S、代发或在轮次结束时补发 `question` 报告。
- **FR-004** 调度会话 MUST 沿用普通 `question` 报告的处理流程更新 `waiting_user`。`ask_intercept` 仅为历史报告保留。
- **FR-005** 插件 MUST 保留未被管理会话的宿主提问行为、已等待请求的取消路径，以及常规轮次进度与失败通知行为。

### Key Entities

- **S**：固定上报指令。用于新提问的工具结果，也用于既有等待被取消后的一次性提醒。
- **`question` 报告**：由任务模型通过 `send_report` 提交，交由调度会话处理。

## Success Criteria

- **SC-001** 被管理调用的工具体执行、结束轮次、额外 S 消息与当场代发报告均为 0 次；每个调用返回一个只含 S 的成功结果。
- **SC-002** 上报走正常 `send_report` 路径；未调用上报时，正常结束或停止都不生成 `ask_intercept` 报告，也不会因拦截修改任务状态。
- **SC-003** 未管理的调用行为不变；取消历史等待路径仍能触发一次提醒。

## Assumptions

- 任务模型可从工具调用与已有上下文获得题面和选项。问题能否送达取决于模型执行 S 以及正常上报链路的投递结果。
- S 通过直接工具调用的结果正文交给模型。程序式调用限制见 [已知风险](../../docs/known-risks.md#被管理会话)。
- 报告存档、飞书通知和回答回注沿用既有流程。
