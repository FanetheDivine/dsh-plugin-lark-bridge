# Data Model: 上报先存档后投递、归档即重建与未读补投

## Task

`message-task-status.json` 的未结束任务。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | 任务标识，既有 |
| `sessionId` | string | 被管理会话，既有 |
| `reportIds` | string[] | 已存档报告，既有，按存档顺序 |
| `deliveredReportIds` | string[] | 已成功投递给调度会话的报告 |
| `status` | `in_progress` / `waiting_user` / `failed` | 既有 |
| `messages` | TaskMessage[] | 既有 |

规则：

- `deliveredReportIds` 是 `reportIds` 的子集。
- 读取缺失该字段的旧任务时按 `reportIds` 初始化，存量报告不重复注入。
- 结束任务时该字段随 `archive/<taskId>/task.json` 一起归档。
- 未读集合 = `reportIds` 减去 `deliveredReportIds`。

## SendReportResult

`send_report` 的返回值。

| 字段 | 类型 | 出现条件 |
| --- | --- | --- |
| `reportId` | string | 报告已存档 |
| `taskId` | string | 总是 |
| `reportPath` | string | 报告已存档，相对调度工作区根 |
| `delivered` | boolean | 总是 |
| `reason` | `no_workspace` / `create_failed` / `delivery_failed` | 未送达 |
| `warning` | string | 提交或标记失败 |

## Report 投递块

`<task_session_message>` 的属性保持 `sessionid`、`reportid`、`taskid`、`kind`、`origin`。

新增子元素：

| 元素 | 内容 |
| --- | --- |
| `<unread_reports>` | 每份未读报告一行 `<unread_report taskid="..." reportid="...">相对路径</unread_report>` |
| `<task_snapshot>` | 仅新建会话：全部未结束任务的 `id`、`title`、`status`、`workspace`、`session` |
| `<instructions>` | 说明先读 `message-task-status.json` 中的任务与列出的全部报告 |

## BridgeState

`state.json` 保持不变：`sessionId`、`workspaceRoot`、`title`、`seen`、`updatedAt`。

调度会话判定：

| 条件 | 动作 |
| --- | --- |
| `workspaceRoot` 为空 | 返回 `no_workspace`，不存档、不建会话 |
| `sessionId` 为空 | 新建调度会话 |
| `sessionId` 在 `archivedSessionIds` 中 | 新建调度会话 |
| 解析返回 `session/not-found` | 新建调度会话 |
| 解析返回其他错误 | 未送达 `delivery_failed` |
| 解析成功且未归档 | 投递到该会话 |

## 状态转移

| 起点 | 事件 | 终点 |
| --- | --- | --- |
| 未读报告 | 投递成功 | 已读，写入 `deliveredReportIds` |
| 未读报告 | 投递失败 | 未读，等下一次投递 |
| 已读报告 | 下一次投递 | 不再列出 |
| 调度会话缺失或归档 | 上报或飞书注入 | 新建会话，桥接状态指向新会话 |

## 顺序与并发

| 场景 | 规则 |
| --- | --- |
| 同一工作区多份报告 | 存档串行；投递链按登记顺序串行 |
| 多份报告同时发现会话缺失 | 创建单飞，只建一个会话 |
| 投递前会话被归档 | 首次失败，重建后重试一次 |
| 投递成功后标记失败 | 保留未读，下次重复列出 |
| 解归档 | 不写回桥接状态；桥接状态指向新会话时旧会话不再使用 |