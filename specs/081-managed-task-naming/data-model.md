# Data Model: 接管会话的任务名基于会话标题生成

## 会话标题快照

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `title` | `sessionTitle.get(session)` | 会话日志中最新 `session/title` 事件的文本 |

- 读取失败、快照为空或标题为空白时视为无标题。

## 任务台账记录（既有格式）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `title` | string | 单行任务名；接管时初始值为规范化后的会话标题，调度会话随后用 `task_update` 覆盖为生成的任务名 |
| `sessionId` | string | 被管理会话标识 |
| `messages[0].text` | string | 会话首条用户消息；无消息时为初始标题 |

## 映射

```text
session_manage(session_id)
  → resolveAgent(session_id)
  → sessionTitle.get(session)?.title
  → normalize（换行折叠、去首尾空白）
  → 空则回退 session_id
  → 任务初始 title
  → 调度会话基于 title 生成任务名
  → task_update(task_id, title)
```

## 不变量

- 任务标题非空且为单行。
- 有标题的会话接管后，任务初始标题等于会话标题。
- 无标题的会话接管后，任务初始标题等于会话 id，接管成功。
- `session_manage` 结果字段保持 `sessionId`、`taskId`、`title`。
