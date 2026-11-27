# 调度信号分层

调度会话收到的东西按「是否需要立刻响应」分三类。新增信号时先归类，再选投递通道。

| 类别 | 定义 | 投递方式 | 成员 |
| --- | --- | --- | --- |
| 紧急 | 调度会话需要立刻响应 | `steer` 注入；空闲会话开始新一轮，运行中的会话并入下一步 | 飞书用户消息 `<lark-message>`、上报 `<task_session_message>`、失败 `<task_session_failure>` |
| 重要 | 注入调度会话，无需立刻响应 | 先持久化，调度会话下一次 `agent/pre-step` 注入 | 归档通知 `<task_session_archived>`、任务日志 `<task_log_entry>`、任务快照 `<task_snapshot>` |
| 日志 | 不注入调度会话 | 落文件，调度会话按需读取 | 报告存档、任务日志文件、任务台账、工作区笔记 |

## 紧急

飞书用户消息由桥接服务逐条注入桥接会话。上报与失败通知由全局行投递。

- 投递走 `agent.steer`，消息来源 `lark-super-agent` 或 `lark-bridge`。
- `steer` 之后若会话已空闲且消息仍在 `next-step` 队列，改为 `followup`，与飞书消息共用收尾逻辑（`src/steering.ts`）。
- 投放失败的后果需要调度会话立刻知道，因此失败通知保持这类通道。

## 重要

先写入调度工作区的文件，再由 `agent/pre-step` 合成一条消息注入。

- 任务日志：`session/event` 观察被管理会话，用户直接消息与用户停止写入 `task-logs/<taskId>.jsonl`。
- 归档通知：`session/event` 的 `workspace/session-archived` 结束后，写 `archive-notices.json`。
- 任务快照：全新调度会话第一次 pre-step 生成 `<task_snapshot>`。
- 注入消息来源为 `lark-task-log`，排在桥接提醒之后、本批第一条 `<lark-message>` 之前；顺序为任务快照、`<task_log_entry>`、`<task_session_archived>`。
- 已注入判定扫描调度会话完整事件日志：日志条目看 `<task_log_entry id="…">`，归档通知看 `<task_session_archived id="…">`。压缩只改模型可见表层，事件日志仍在，因此不重复注入；请求失败没写入事件日志时，下一次 pre-step 重新注入。
- 桥接提醒 `<system-reminder>` 在表层缺失时由 `agent/pre-step` 补注，同样不唤起会话。

## 日志

只写文件，调度会话用工具按需读取。

- 报告存档：`reports/<taskId>/<reportId>.md` 与附件；任务结束后移到 `archive/<taskId>/reports/`。
- 任务日志：`task-logs/<taskId>.jsonl`；任务结束后移到 `archive/<taskId>/task-log.jsonl`。
- 任务台账：`message-task-status.json`，未结束任务的状态、消息与报告编号。
- 工作区笔记：`workspaces.json`，派发白名单与长期说明。

## 判断规则

1. 不响应会阻塞用户或让任务停摆的，归紧急。
2. 来自用户自己的操作、下一个请求前看到即可的，归重要。
3. 只有事后追溯或回答问题时才需要的，归日志。