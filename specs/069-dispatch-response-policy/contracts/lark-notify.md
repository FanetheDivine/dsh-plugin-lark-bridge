# 契约：lark_notify

## 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `text` | string | 是 | `text` 模式为正文；`card` 模式为完整 Markdown |
| `reply_to` | string | 否 | 要回复的用户消息 id |
| `mode` | `text` \| `card` | 否 | 默认 `text` |
| `summary` | string | `card` 必填 | 一句总结，常显 |
| `task_id` | string | 否 | 关联任务；带上时由插件在标题或首行写「<title> (<task id>)」 |

## 发送

- `text`：沿用现状，按 15 000 字符分段，`+messages-send --text -`；带 `task_id` 时首段首行为「<title> (<task id>)」。
- `card`：Card 2.0，`header.title` 为总结句（多张时带 `（i/n）`），`header.subtitle` 在带 `task_id` 时为「<title> (<task id>)」，body 为 `collapsible_panel(expanded=false)` 内放 `markdown`。命令：`+messages-send|+messages-reply --as bot --msg-type interactive --content -`。

## 结果

- 模型可见：`已发送给用户（消息 <messageId>）`；失败为现有文案 `发送失败（<code>）：<message>`。
- GUI 元数据：`{ taskSessionId }`（仅 `task_id` 解析成功时）。

## 错误码

保留 `invalid-args`、`invalid-text`、`invalid-reply-to`、`owner-missing`、`send-failed`、`reply-failed`、`not-bridge-session`；新增 `invalid-mode`、`invalid-summary`、`task-not-found`、`task-ledger-unavailable`。部分发送成功后失败时，错误消息含已发送条数与第一条消息 id。
