# Contract: 模型工具与消息块

## 调度会话工具（`sa-dispatch` 子行）

| 工具 | 参数 | 结果 |
| --- | --- | --- |
| `session_create` | `workspace_id` 或 `cwd`；`provider`、`model`、`effort`；`title` 必填；`prompt` 必填；`message_id` 可选 | `{ sessionId, taskId, title, prompted }` |
| `session_manage` | `session_id` 必填 | `{ sessionId, taskId, title }` |
| `session_unmanage` | `session_id` 必填 | `{ sessionId, taskId }` |
| `task_update` | `task_id` 必填；`status`（`in_progress`、`waiting_user`、`failed`）、`title`、`add_message` 至少一项 | `{ taskId, status }` |
| `task_end` | `task_id` 必填；`reason`：`completed`、`cancelled` | `{ taskId }` |
| `workspace_note_set`、`workspace_note_remove` | 不变 | 不变 |

- 结束任务不归档会话；需要归档时由调度会话另行调用会话归档。
- `session_create` 的工作区 MUST 已登记在 `workspaces.json`。`title` 同时是会话标题与任务标题，`prompt` 记为任务首条消息。
- `session_manage` 拒绝调度会话自身、不存在的会话与已被管理的会话。
- 删除：`task_create`、`task_candidates`。

## 全部非调度会话的工具

`send_report`：

| 参数 | 说明 |
| --- | --- |
| `kind` 必填 | `progress`、`question` |
| `text` | 正文；`files` 为空时必填 |
| `files` | Markdown 文件路径 |
| `desc` 可选 | 一句话介绍调用方正在做的任务 |

- 结果：`{ reportId, taskId, delivered: true, warning? }`。
- 上报不结束任务。
- 未被管理时报错 `send_report is only available in a session managed by the dispatch session`。

## 投递到调度会话的消息块

上报：

```xml
<task_session_message sessionid="…" reportid="…" taskid="…" kind="…" origin="send_report|turn_end">
<desc>
…
</desc>
<text>
…
</text>
<files>
…
</files>
</task_session_message>
```

- `<desc>` 仅在提供时出现。

失败：

```xml
<task_session_failure sessionid="…" taskid="…">
<error>
…
</error>
</task_session_failure>
```

会话被归档：

```xml
<task_session_archived sessionid="…" taskid="…"/>
```

## 注入任务会话的消息

- 调度会话发来的消息：`<dispatch_session_message>`，规则不变。
- S：一条 `<system-reminder>` 用户消息，`source` 为 `{ kind: 'lark-task-rules', form: 'notice' }`。
- 离开错误文本：`The user is away from the computer and cannot answer ask_user_question right now.`
