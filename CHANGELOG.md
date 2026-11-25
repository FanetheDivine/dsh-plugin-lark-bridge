# Changelog

## Unreleased

### Changed

- `send_report` 增加必填参数 `kind`：`progress`、`question`、`completed`、`abandoned`；投递块与上报存档带上该值。
- `SA-工作会话` 在电脑旁时也照常上报进度、提问、完成与放弃，调度会话不再丢失本机模式下的结果。
- `SA-调度会话` 默认把每条消息当作新任务，只按引用或点名归入未结束任务；新工作会话的首条要求只含本任务内容。
- `SA-调度会话` 只在 `completed` 或 `abandoned` 上报时结束任务并归档会话。
- `SA-工作会话` 收到的 `session_send` 消息剥掉 meta-tools 的 `<system-reminder>` 帧，只留一层 `<dispatch_session_message>`；首条任务与后续消息结构一致，正文中被转义的闭标签还原。
