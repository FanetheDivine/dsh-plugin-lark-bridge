# Changelog

## Unreleased

- 移除用户在场机制：删除侧栏在场按钮、自动切换开关与时间、节假日数据、`/lark-bridge/presence` 路由与 Tailwind 构建；被管理会话的 `ask_user_question` 一律拒绝并注入 S，桥接会话统一经 `lark_notify` 回复，正文最多一句。
- 成功的 `lark_notify` 在轮次层级显示只含完整 `text` 的正文卡片，保留原始换行；进行中、失败与中断沿用宿主默认工具行。
- `send_report` 上报卡片的正文、任务简介与附件名改用对话正文的主前景色，Markdown 正文继承同一颜色。
