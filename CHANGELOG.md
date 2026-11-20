# Changelog

## Unreleased

### Added

- CLI、bot、user 三种连接状态独立展示，每项提供终端命令与完整检测按钮
- 工作区只从当前 DSH 注册列表选择，路径统一为 Linux 风格（例如 `/c/work/demo`）
- 未选择或注册失效时显示共用设置弹窗，可暂时关闭并在新的失效时重新提示

### Changed

- 插件完全使用用户本机安装的 `lark-cli`，发布包不再携带 `@larksuite/cli`
- 移除 `larkCli` 配置、`LARK_CLI` 环境变量覆盖与自定义 `PATH` 搜索；旧 `larkCli` 配置在升级时被忽略
- `cli-missing` 弹窗与配置页鉴权面板显示 `npm install -g @larksuite/cli@latest && lark-cli config init`
- 通知正文改由 stdin 传给 `--text -`；Windows 使用受约束 shell 调用 `lark-cli.cmd`
- Spec Kit 主流程在探索后按依赖分批访谈，规格与计划经用户批准或豁免后推进，任务与实现复核未决项
- 每次加载与打开 GUI 都执行带 `--verify` 的完整检测，删除「启动时检测鉴权」开关
- 界面只展示笼统连接状态，不再展示授权链接、原始错误或身份元数据；移除插件内授权交互
- 桥接会话标题固定为「来自用户的飞书消息」，删除「重置桥接会话」；归档后下一条消息自动新建会话
- 已归档会话不再被恢复复用；`workspaceRegistry` 成为必需注入，消除启动顺序竞态
- 实机测试改为链接安装并启用 HMR：构建后同一 GUI 实例自动替换插件，前后端都无需刷新或重启，每轮结束删除 profile
- `docs/development.md` 增加前端 UI 链接规则：`a` 标签的 `href` 使用完整 URL，相对链接在 Desktop 中打不开目标
