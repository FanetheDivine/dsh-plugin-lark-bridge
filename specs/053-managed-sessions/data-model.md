# Data Model: 调度会话统一管理任务会话

## Task

记录在调度工作区 `message-task-status.json`：`{ "version": 2, "tasks": Task[] }`。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | `task-<yyyyMMddHHmmss>-<4 hex>` | 任务标识 |
| `title` | string | 单行标题 |
| `status` | `in_progress` \| `waiting_user` \| `failed` | 未结束任务的状态 |
| `sessionId` | string | 对应的被管理会话 |
| `workspaceId` | string \| null | 会话所在工作区；手动管理且无工作区时为 null |
| `cwd` | string | 会话工作目录 |
| `messages` | TaskMessage[] | 至少一条 |
| `reportIds` | string[] | 本任务的上报 |
| `createdAt`、`updatedAt` | ISO 时间 | |

约束：

- 一个 `sessionId` 最多出现在一个任务中。
- 「被管理」等价于存在 `sessionId` 匹配的任务。
- 读到 `version` 不是 2 的文件时按空台账处理，下次写入覆盖。

## ArchivedTask

`archive/<taskId>/task.json`：Task 全部字段加 `archivedAt` 与 `endReason`。

| `endReason` | 触发 | 会话 |
| --- | --- | --- |
| `completed` | 调度会话判断完成并经用户确认 | 保持未归档 |
| `cancelled` | 用户要求结束或取消 | 保持未归档 |
| `unmanaged` | 用户取消管理 | 保持未归档 |
| `session_archived` | 会话被归档 | 已归档 |
| `session_missing` | 读取时会话已不存在 | 无 |

结束任务不归档会话；用户要求归档时由调度会话调用会话归档。

## 状态转换

```text
(session_create | session_manage) → in_progress
in_progress ↔ waiting_user
in_progress → failed → in_progress
任一未结束状态 → archived(endReason)，会话状态不变
```

## Report

`reports/<taskId>/<reportId>.md` 的 front matter：`reportId`、`sessionId`、`taskId`、`kind`、`origin`、`desc`、`time`、`files`。

- `origin` 取 `send_report` 或 `turn_end`。
- `desc` 仅 `send_report` 提供时存在。

## 内存状态

| 状态 | 归属 | 生命周期 |
| --- | --- | --- |
| 每会话当前轮次的工具名集合与最后文本 | 自动上报 | `turn/end` 时清空 |
| 每会话可中止的提问信号 | 提问拦截 | 调用结束时移除 |
| 需要 S 的会话集合 | S 注入 | 会话取消管理时移除；宿主重启后清空 |
