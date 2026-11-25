# Data Model: 任务边界与上报规则

## ReportKind

| 取值 | 含义 | 调度会话设置的任务状态 |
| --- | --- | --- |
| `progress` | 里程碑进度或需求变更 | `in_progress` |
| `question` | 需要用户决定 | `waiting_user` |
| `completed` | 任务完成 | `completed`，随后归档会话 |
| `abandoned` | 任务放弃 | `completed`，随后归档会话 |

## SendReportInput

| 字段 | 类型 | 必填 |
| --- | --- | --- |
| `kind` | `ReportKind` | 是 |
| `text` | string | `files` 为空时必填 |
| `files` | string[] | 否 |

## 上报存档 front matter

`reportId`、`sessionId`、`taskId`、`kind`、`time`、`files`。

## Task

字段与状态转换不变，见 `src/lark-super-agent/notes.ts`。`waiting_user` 可转回 `in_progress`。
