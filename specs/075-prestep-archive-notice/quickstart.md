# Quickstart: 归档通知改为 pre-step 注入

## 前置

- 插件主行与 `lark-super-agent` 行已装载；调度工作区已配置。
- 至少一个被管理会话（`session_create` 或 `session_manage` 产生任务）。
- 命令：`pnpm format && pnpm check && pnpm test:code`。

## 场景

1. 归档不唤起调度会话
   - 归档被管理会话。
   - 观察调度会话没有新增轮次；任务台账不再列出该任务；`archive/<taskId>/task.json` 的 `endReason` 为 `session_archived`。
   - 调度工作区出现 `archive-notices.json`，含该任务的记录。

2. 下次 pre-step 注入
   - 让调度会话因飞书消息或其他原因进入下一轮。
   - 注入消息里出现 `<task_session_archived id="…" sessionid="…" taskid="…"/>`，位置在任务日志条目之后。
   - 该轮结束后再次进入下一轮，同一通知不再出现；`archive-notices.json` 中对应记录已删除。

3. 恢复后失效
   - 归档后立即用 `session_restore` 恢复会话。
   - 下一次 pre-step 不出现该任务的归档通知；任务回到未结束集合。

4. 文档
   - `docs/dispatch-signals.md` 列出三类信号及成员。
   - 按表核对：飞书消息、`<task_session_message>`、`<task_session_failure>` 走 `steer`；`<task_session_archived>`、`<task_log_entry>`、`<task_snapshot>` 走 pre-step 注入；报告存档、任务日志、任务台账、工作区笔记按需读取。

## 预期

- 归档前后调度会话的模型请求数不变（无即时投递）。
- 同一条归档通知在压缩、重启后不重复。

## 失败排查

- `archive-notices.json` 没有新记录：确认 `workspaceRoot` 已配置且该会话有未结束任务。
- 通知一直重复：确认注入消息已进入调度会话事件日志，来源为 `lark-task-log`。
- 通知没有出现：确认调度会话标识与桥接状态一致，且 pre-step 未在第一步空消息时跳过。