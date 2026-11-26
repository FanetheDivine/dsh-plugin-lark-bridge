# Changelog

- 移除用户在场机制：删除侧栏在场按钮、自动切换开关与时间、节假日数据、`/lark-bridge/presence` 路由与 Tailwind 构建；被管理会话的 `ask_user_question` 一律拒绝并注入 S，桥接会话统一经 `lark_notify` 回复，正文最多一句。
