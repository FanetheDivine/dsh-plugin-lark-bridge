# Research: 被管理会话提问改为打断并注入 S 要求自行上报

日期：2026-11-27。宿主版本 0.2.2-rc.5，基线提交 `9d96e7b`。证据为包源码行号与仓库内实现。

## R1 「S」的既有含义

- Decision：S 即 `src/lark-super-agent/managed/task-rules.ts` 中的 `TASK_RULES_TEXT` 消息（`source.kind = 'lark-task-rules'`），由 `agent/pre-step` 在下一次模型请求前插到消息列表最前。
- Rationale：三处一致。代码注释 `ask-guard.ts:3` 与 `index.ts:145` 写作「S」；`docs/how-it-works.md:253` 的「S 注入」定义其行为；`specs/053-managed-sessions`、`specs/070-ask-question-interrupt/plan.md` 沿用同一记法。
- Alternatives：把「S」理解为某个发送到任务会话的调度消息（`session_send` 的 `<dispatch_session_message>` 块）——该块由调度会话发出，与「要求任务会话调用 send_report」的语义相反，排除。

## R2 拦截点取 `tools/pre-execute` 的 deny

- Decision：被管理会话的提问在 `tools/pre-execute` 返回 `{kind:'deny', reason: ASK_BLOCKED_ERROR}`，不再走 `tools/execute` 的工具体接管。
- Rationale：`prepare` 对 deny 生成 `Error: <reason>` 错误结果并回到模型，轮次继续（`dsh-tools/src/pipeline.ts:214-226`）。拒绝早于 `ask` 审批（`:201-205`），其他插件的 `ask` 决策不会把被管理会话拖进审批等待。
- Alternatives：`tools/execute` 接管后调用 `exec.concludeTurn()`——070 的做法，会结束轮次，S 要等下一轮次才有机会注入，且问题由插件原样回送。

## R3 提问内容的保留

- Decision：拦截时把 `exec.arguments.questions` 追加到会话级待注入内容，S 正文列出题面与选项；轮次结束仍未上报时补投。
- Rationale：S 在下一步注入，模型仍需知道被拦截的具体提问；补投保证模型不遵循 S 时问题仍到达用户。
- Alternatives：只依赖模型自己的上下文复述——丢弃选项原文，且模型可能改写提问。

## R4 补投时机

- Decision：`session/event` 的 `turn/end` 上取走待补投提问；有待补投时先 `TurnReporter.markIntercepted(sessionId)`，再异步投递 `origin=ask_intercept` 的 `question`。
- Rationale：`TurnReporter.finish` 在 `turn/end` 后按「本轮未上报」补投 `progress`（`managed/turn-report.ts:99-124`）。先取补投再调用 `observe` 才能让 `markIntercepted` 命中当前轮状态（`:100-103`）。
- Alternatives：定时器兜底——轮次可能长时间不结束，S 注入后模型通常在下几步就上报，定时器只增加状态。

## R5 已上报判定

- Decision：模型调用 `send_report(kind=question)` 成功返回即清空该会话的待补投提问；其他 `kind` 不清空。
- Rationale：`progress` 上报可能不提问题，清空会丢问题；`question` 上报必然覆盖该提问。
- Implementation：`buildSendReportTool` 增加可选 `onReport(args, result)` 回调，行装配里对 `kind==='question'` 调用 `askGuard.noteReported`。

## R6 会话已不被管理

- Decision：补投前重新读 `managedTask`；任务不存在时丢弃待补投内容。
- Rationale：`sendReport` 对被管理会话之外抛 `NOT_MANAGED_ERROR`（`service.ts:690-691`）；任务已结束时提问对用户已无意义。

## R7 轮次被停止

- Decision：`turn/end` 的 `reason.kind` 为 `aborted` 时照常补投。
- Rationale：用户可能只在飞书侧，本地停止轮次后仍需要看到未送达的提问；`aborted` 不会触发 `TurnReporter` 的 `progress` 补投，不产生重复。

## R8 与既有 070 行为的关系

- Decision：删除 `intercept` 装配、`ASK_REPORTED_NOTICE` 与 `concludeTurn` 调用；保留网关取消与信号中止路径。
- Rationale：拦截不再由插件投递，终止轮次与结果改写失去对象；取消路径解决的是「拦截前已在等待的提问」，与本变更的正交问题。
