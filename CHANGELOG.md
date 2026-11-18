# Changelog

## Unreleased

### Added

- 飞书私聊消息通过 lark-cli bot 事件注入工作区会话。
- 首次消息创建会话、设置标题并置顶；之后复用持久化的会话标识。
- `lark_notify` 工具以 bot 身份向已绑定用户发送消息。
- 配置页支持应用绑定、设备码授权、重新检测与会话重置。
- 鉴权未就绪时显示全局弹窗。
- 事件监听断线退避重启，插件卸载时终止子进程。

### Changed

- 项目从 `dsh-plugin-template` 转为 `dsh-plugin-lark-bridge`。
- 前端入口注册 `shell.overlay` 弹窗与插件行配置页。
- 依赖新增 `@larksuite/cli` 与宿主会话、工作区、LLM 类型包。