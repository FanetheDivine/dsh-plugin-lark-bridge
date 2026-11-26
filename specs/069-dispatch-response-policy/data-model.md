# Data Model: 调度会话响应策略与上报投递

## 任务日志条目（`task-logs/<taskId>.jsonl` 每行一条）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `<sessionId>:<seq>`，同一事件重复观察得到同一 id |
| `time` | string | ISO 时间（本机时区偏移，与台账同格式） |
| `taskId` | string | 任务 id |
| `sessionId` | string | 任务会话 id |
| `type` | `'user_message' \| 'user_stop'` | 事件类型 |
| `text` | string | 用户原文；`user_stop` 为空串 |
| `truncated` | boolean（可省略） | 原文超过 2000 字符被截断时为 `true` |

- 校验：JSON 解析失败的行读取时跳过；`id` 在文件内唯一。
- 状态流转：追加（队列内，任务未结束）→ 任务结束时整文件移到 `archive/<taskId>/task-log.jsonl`。

## 日志注入消息

- 来源：`{ kind: 'lark-task-log' }`，role=user。
- 正文由一个或多个 `<task_log_entry id="…" taskid="…" sessionid="…" time="…" type="…">原文</task_log_entry>` 与可选的 `<task_snapshot>` 组成。
- `<task_snapshot>`：每个未结束任务一个 `<task id title status workspace latest_report>`，路径为工作区相对路径。

## 上报块（`<task_session_message>`）

| 属性/子块 | 说明 |
| --- | --- |
| `sessionid`、`reportid`、`taskid`、`kind`、`origin` | 与现状一致 |
| `<report_path>` | `reports/<taskId>/<reportId>.md`，相对调度工作区根，`/` 分隔 |
| `<attachment_paths>` | 每行一个附件副本相对路径 |
| 不再包含 | `<desc>`、`<text>`、`<files>` |

## lark_notify

参数：`text`（必填）、`reply_to`、`mode`（`text`｜`card`，默认 `text`）、`summary`（`card` 必填）、`task_id`。

结果：`{ ok: true, messageId, taskSessionId? }` 或 `{ ok: false, error: { code, message, sentCount?, firstMessageId? } }`。`taskSessionId` 只出现在 `presentationMeta`。

## 归档结构

```text
reports/<taskId>/...                  # 现行
task-logs/<taskId>.jsonl              # 现行日志
archive/<taskId>/task.json
archive/<taskId>/reports/...
archive/<taskId>/task-log.jsonl       # 任务结束时由 task-logs 迁入
```
