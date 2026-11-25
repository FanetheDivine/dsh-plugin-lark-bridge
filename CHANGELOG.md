# Changelog

## Unreleased

### Changed

- `SA-工作会话` 收到的 `session_send` 消息剥掉 meta-tools 的 `<system-reminder>` 帧，只留一层 `<dispatch_session_message>`；首条任务与后续消息结构一致，正文中被转义的闭标签还原。
- 「飞书任务与调度会话」配置页的自动切换时间改为卡片行：时间主按钮、跳过项 chip、启用开关与删除按钮分成两级视觉。
- 时间选择控件换成 shadcn 体系的列式 time picker（ReUI 移植件 + Radix Popover），移除表盘式控件与 `react-time-picker`、`react-clock` 依赖。
- 前端接入 Tailwind v4，只生成 utilities 并把 shadcn 语义色映射到宿主 `--dsw-*` 令牌，preflight 不进产物。
