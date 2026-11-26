# Changelog

## Unreleased

- 被管理会话调用 `ask_user_question` 改为拦截代为上报 `question`、把任务置 `waiting_user` 并结束当前轮次；上报投递失败时退回拒绝反馈。
- `lark_notify` 通知卡片关联来源会话，支持跳转未归档会话并标记已归档会话。
