# Contract: 归档通知记录与注入块

## `archive-notices.json`

位置：调度工作区根目录，与 `message-task-status.json` 同级。

```json
{
  "version": 1,
  "notices": [
    {
      "id": "task-20260101090000-abcd:2026-01-01T09:30:00.000+08:00",
      "taskId": "task-20260101090000-abcd",
      "sessionId": "worker",
      "time": "2026-01-01T09:30:00.000+08:00"
    }
  ]
}
```

- 读取：文件缺失、解析失败或 `version` 不为 `1` 时按空列表。
- 写入：只在 `runSerial(root)` 内追加或删除，整文件原子替换。
- 顺序：读取顺序即写入顺序；注入时按 `time` 升序排列。
- 提交：不进入 git 提交，与 `task-logs/` 的追加一致。

## 注入消息

来源 `source.kind = "lark-task-log"`，与任务日志、任务快照同一条消息，块顺序为任务快照、`<task_log_entry>`、`<task_session_archived>`。

```xml
<task_session_archived id="task-20260101090000-abcd:2026-01-01T09:30:00.000+08:00" sessionid="worker" taskid="task-20260101090000-abcd"/>
```

- 已注入判定：调度会话事件日志中来源 `lark-task-log` 的文本出现 `<task_session_archived id="<id>"`。
- 判定成立后删除该记录；未成立则下次 pre-step 再次注入。
- 没有未结束任务时，注入消息仍可能只含归档通知块。