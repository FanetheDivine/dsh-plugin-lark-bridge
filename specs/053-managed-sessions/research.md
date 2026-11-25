# Research: 调度会话统一管理任务会话

宿主版本：`@deepseek-ai/dsh-*` 0.2.2-rc.5。

## R-01 按会话显示 `send_report`

- Decision: 全局 `tools.register(def, { when })`，`when` 在调度会话返回 false。
- Rationale: `when` 在每个 step 按 agent 判定，返回 false 时声明与执行同时去掉。`lark_notify` 已用同一机制。
- Alternatives: 在 `agent/created` 里对每个 agent 作用域 `restrict`，需要跟踪全部 agent 生命周期。

## R-02 拒绝离开期间的新提问

- Decision: 全局 `tools/pre-execute` 对 `ask_user_question` 返回 `{ kind: 'deny', reason }`。
- Rationale: 拒绝原因作为错误结果交给模型，文本由插件决定。权限审批走 `approval/request`，不受影响。
- Alternatives: `tools.guard` 只能给出拒绝原因，与 pre-execute 等价，但执行更晚。

## R-03 中断正在等待的提问

- Decision: 两层机制。
  1. 插件加载后开始的提问：全局 `tools/execute` 把 `exec.signal` 换成 `AbortSignal.any([exec.signal, own.signal])`，切为离开时中止；`tools/post-execute` 把中止产生的错误结果替换为离开错误。
  2. 插件加载前开始的提问：`ctx.typertGateway.pendingRemoteEvents` 中 `frame.event === 'user-questions/request'` 且 `frame.agentId === sessionId` 的条目，调用 `cancelRemoteEvent(pending, new Error(离开错误))`。
- Rationale:
  - 第 1 层只用公开事件。
  - 第 2 层覆盖第 1 层拿不到 signal 的调用。网关取消后 waterfall 以该 Error reject，工具结果为 `isError: true` 的错误，轮次继续，问题卡片关闭。
  - `agentId` 的 wire codec 是 `SessionId`，`dsh-api-remotes` 传入 `agent.id`，二者等于会话 id。
- Risks: 第 2 层依赖网关私有字段与方法。调用前检查 `pendingRemoteEvents instanceof Map` 与 `typeof cancelRemoteEvent === 'function'`，不满足时只记日志。服务代理对私有方法 `this` 的影响需真机确认。
- Alternatives: `agent.cancel()` 中止整轮；`userQuestions.answer()` 只接受 timed 模式已转 pending 的问题；`agent.steer` 不中断工具。

## R-04 轮次结束与本轮内容

- Decision: 全局 `session/event` 增量累计每个会话当前轮次的 `tool/call` 名称与最后一条非空 `assistant/message` 的文本块；`turn/end` 时读取并清空。
- Rationale: `turn/end` 带 `reason.kind`：`completed`、`aborted`、`blocked`、`error`。同步读取全量事件的接口已弃用。

## R-05 运行中的子代理

- Decision: `ctx.agents.list()` 中 `status === 'running'` 且 `session.header.origin === 'subagent'`、父会话链可追溯到目标会话的 agent。
- Rationale: 宿主归档准入使用同一判定。子代理结束后父会话收到 `subagent-settled` 消息并开始新轮次，该轮结束时再判定。

## R-06 会话归档

- Decision: 监听 `workspace/session-archived({ sessionId })`；调度会话结束任务时调用 `workspaceRegistry.archiveSession(id, { stopActivity: true })`。
- Rationale: meta-tools 的 `session_archive` 使用同一接口。

## R-07 `send_report` 专用卡片

- Decision: Client 在 `tool.call.toolview` 槽位以 key `send_report` 注册组件；正文用 `@deepseek-ai/dsh-client-ui-primitives` 的 `MarkdownText`。
- Rationale: 槽位按工具名选择组件，props 含 `phase`、`block`、`toolName`、`callId`。`MarkdownText` 来自平台种子模块。
- Dependency: 槽位类型来自 `@deepseek-ai/dsh-client-ui-tool/client`，npm 已发布 0.2.2-rc.5。

## R-08 新建会话的预设

- Decision: `sessionController.create({ agentPreset })` 传入「任务会话预设」；名册中不可用或为空时省略。
- Rationale: 与现有 `availablePreset` 一致。
