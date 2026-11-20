# 验证指南

## 前置

- Node.js 24.9 及以上。
- pnpm 11。
- 实机验证前，在终端运行 `npm install -g @larksuite/cli@latest && lark-cli config init`。

## 自动验证

1. 运行 `pnpm format && pnpm check`。
   - 类型检查、lint 和源码测试通过。
   - CLI 测试证明只使用本机命令，不读取专用路径配置或环境变量。
   - Windows 命令测试证明危险参数在启动前被拒绝，通知正文通过 stdin 传递，同步启动失败映射为 `cli-missing`。
   - 配置测试证明旧 `larkCli` 被忽略，其他未知键仍被拒绝。
   - 前端测试证明 `cli-missing` 弹窗与配置页鉴权面板显示同一条安装命令。
2. 运行 `pnpm build`。
   - 宿主与浏览器产物构建成功。
   - 产物测试通过。
3. 运行 `npm pack --dry-run --json`。
   - 包清单不声明 `@larksuite/cli`。
   - tarball 不含 `lark-cli` 程序、依赖目录、下载缓存或后备副本。
   - `dist`、`cordis.patch.yml`、`README.md` 与 locale 资源仍在包内。

## 实机验证

1. 确认终端可以执行 `lark-cli --version`，并完成 bot 配置与用户授权。
2. 在真实 DSH 宿主加载构建后的插件。
3. 打开插件配置页。
   - 页面只有工作区、会话标题、启动检测与桥接会话设置。
   - 页面没有 `lark-cli` 路径输入。
4. 在鉴权就绪后发送一条飞书私聊消息。
   - 消息进入配置工作区的桥接会话。
5. 调用 `lark_notify`。
   - 已绑定用户收到通知。
6. 在没有可用 `lark-cli` 的测试环境重新检测。
   - 插件配置与诊断入口仍可使用。
   - 弹窗和配置页鉴权面板均显示 `npm install -g @larksuite/cli@latest && lark-cli config init`。
7. 在中英文界面分别核对命令与提示。

## 预期边界

- 不检查最低版本。
- 不检查最低版本；旧版程序不支持 `--text -` 时，通知返回实际命令错误。
- 命令执行失败保留实际错误。
- 连通性测试不在本次验证范围内。
