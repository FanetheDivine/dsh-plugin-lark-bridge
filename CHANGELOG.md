# Changelog

## Unreleased

### Changed

- 「飞书任务与调度会话」配置页的自动切换时间改为卡片行：时间主按钮、跳过项 chip、启用开关与删除按钮分成两级视觉。
- 时间选择控件换成 shadcn 体系的列式 time picker（ReUI 移植件 + Radix Popover），移除表盘式控件与 `react-time-picker`、`react-clock` 依赖。
- 前端接入 Tailwind v4，只生成 utilities 并把 shadcn 语义色映射到宿主 `--dsw-*` 令牌，preflight 不进产物。
