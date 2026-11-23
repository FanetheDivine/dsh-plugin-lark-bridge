# Changelog

## Unreleased

### Added

- 迁入「飞书任务与调度会话」：`lark-super-agent` 行提供调度服务，补丁声明 `SA-调度会话` 与 `SA-工作会话` 两个预设，随包安装 `dsh-plugin-meta-tools`。
- 调度功能提供任务与工作区笔记、候选会话查询、`send_report` 上报、失败通知、用户在场提醒与任务归档；数据存放在调度工作区并逐次提交 git。
- 新增 `rows/` 下的行元数据与图标，插件详情页按行显示标题与描述。

### Changed

- 插件图标改为等比铺满画布宽度，横向占满宿主图标底板，仅保留宿主自身的底板间距。
- 插件标题与描述改为「用飞书和DSH对话」与「配置lark-cli即可在手机和dsh对话，体验Super Agent！」，英文标题为 `Talk to DSH from Lark`，`package.json` 的描述同步为新文案。
