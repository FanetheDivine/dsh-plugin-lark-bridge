# Changelog

## Unreleased

### Changed

- `SA-工作会话` 收到的 `session_send` 消息剥掉 meta-tools 的 `<system-reminder>` 帧，只留一层 `<dispatch_session_message>`；首条任务与后续消息结构一致，正文中被转义的闭标签还原。
