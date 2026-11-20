# Changelog

## Unreleased

### Added

- 插件图标使用飞书标志，随包发布并在插件行与详情页显示
- `lark_notify` 支持可选 `reply_to`，精确回复指定用户消息

### Changed

- 桥接会话标题改为「飞书桥接会话」，复用会话保留原标题
- README 收敛为标题、npm 徽章、一句简介与「前置」
- 引用回复在 `<lark-message>` 内注入 `<quote>` 块，聊天记录只给容器 `message_id`
- 桥接提醒增加 `reply_to` 用法、引用准确性与引用内容读取规则