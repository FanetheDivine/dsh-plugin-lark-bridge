# Data Model: 归档通知改为 pre-step 注入

## ArchiveNotice

调度工作区 `archive-notices.json` 中的一条待注入归档通知。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `<taskId>:<time>`，同一任务再次归档得到新 id |
| `taskId` | string | 归档时结束的任务标识 |
| `sessionId` | string | 被归档的任务会话标识 |
| `time` | string | 归档时间，带时区的 ISO 字符串 |

## ArchiveNoticesFile

`archive-notices.json` 的顶层结构。

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

校验规则：`version` 必须为 `1`；`notices` 为数组；字段缺失或类型不符的条目读取时忽略；文件缺失或整体损坏按空列表处理，下次写入覆盖。

## TaskSessionArchivedBlock

注入消息中的块。

```xml
<task_session_archived id="<taskId>:<time>" sessionid="<sessionId>" taskid="<taskId>"/>
```

## 状态流转

| 事件 | 变化 |
| --- | --- |
| 用户归档被管理会话 | 任务以 `session_archived` 结束；追加一条状态为「待注入」的记录 |
| 调度会话 pre-step 读到记录且事件日志没有对应 `id` | 块写入注入消息；记录保留 |
| 调度会话事件日志出现对应 `id` | 删除记录 |
| `session_restore` 恢复该任务 | 删除该 `taskId` 的全部记录 |
| 没有调度工作区或会话没有任务 | 不产生记录 |

## 与既有实体的关系

- `Task`：记录由任务的归档事件产生；任务 id 与 `Task.id` 相同。
- `ArchivedTask`：归档记录保存 `endReason = session_archived`，待注入记录不写入任务台账。
- 任务日志条目：与归档通知共用注入消息，条目 id 与通知 id 各自独立。