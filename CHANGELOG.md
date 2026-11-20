# Changelog

## Unreleased

### Changed

- 插件完全使用用户本机安装的 `lark-cli`，发布包不再携带 `@larksuite/cli`
- 移除 `larkCli` 配置、`LARK_CLI` 环境变量覆盖与自定义 `PATH` 搜索；旧 `larkCli` 配置在升级时被忽略
- `cli-missing` 弹窗与配置页鉴权面板显示 `npm install -g @larksuite/cli@latest && lark-cli config init`
- 通知正文改由 stdin 传给 `--text -`；Windows 使用受约束 shell 调用 `lark-cli.cmd`
- Spec Kit 主流程在探索后按依赖分批访谈，规格与计划经用户批准或豁免后推进，任务与实现复核未决项
- 实机测试改为链接安装并启用 HMR：构建后同一 GUI 实例自动替换插件，前后端都无需刷新或重启，每轮结束删除 profile
- `docs/development.md` 增加前端 UI 链接规则：`a` 标签的 `href` 使用完整 URL，相对链接在 Desktop 中打不开目标
