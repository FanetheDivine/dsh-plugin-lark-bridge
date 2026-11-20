# 已知风险

## 宿主版本

- `@deepseek-ai/dsh-*` 处于 rc 阶段，接口可能在版本间变化。
- 插件依赖的 `dsh-*` 版本应与运行它的 DSH 版本一致。
- 实机测试按 `@deepseek-ai/dsh-agent` 的版本选择宿主，版本不一致时安装到 `~/.dsh-local/dsh-<版本>`，全局安装保持不变。

## 安装 rc 依赖

pnpm 的 minimum release age 策略会拒绝发布时间过短的包。

- `@deepseek-ai/dsh-*` 依赖未列入 `minimumReleaseAgeExclude` 时，`pnpm install` 失败。
- 列入规则见[宪章](../.specify/memory/constitution.md)原则 I。

## 共享宿主实例

插件运行时使用宿主提供的 cordis、dsh-tools 与 zod。

- 这些包被打进 bundle 时会产生第二份实例，类型判断和服务注入随之失效。
- 保持 external 的规则见 [how-it-works.md](./how-it-works.md#依赖)。

## 本机 lark-cli

插件使用宿主进程环境解析到的本机 `lark-cli`。

- 命令缺失或无法启动时，鉴权进入 `cli-missing`；在终端执行 `lark-cli --version` 检查安装与命令解析。
- 正在运行的 DSH 可能保留启动时的环境。安装、升级或修改 `PATH` 后重启 DSH，再执行重新检测。
- 插件不检查最低版本；本机命令不支持所用参数时，界面或工具返回实际错误。

## 默认配置

插件使用 lark-cli 当前生效的配置。

- 终端里切换 lark-cli 的生效档案会同时改变插件使用的机器人，下一次检测或重启监听后生效。
- 用户授权失效后，插件发起的授权只请求 `auth:user.id:read`，新令牌会替换终端里同一档案原有的授权范围，需要时在终端重新授权。
- 旧版本创建的专用档案 `dsh-lark-bridge` 保留在 lark-cli 中，插件不会读取或删除它。

## 飞书开放平台

插件无法代替用户配置应用。

- 未订阅 `im.message.receive_v1` 时，`event consume` 可能启动但收不到消息。
- 缺少 `im:message:send_as_bot` 时，通知工具返回权限错误。
- 缺少 `im:message.p2p_msg:readonly` 时，事件订阅校验失败。
- 事件订阅与权限变更需要重新发布应用版本后生效。

## 事件流

`event consume` 依赖本地事件总线守护进程。

- 守护进程异常退出时，子进程关闭，插件按退避重启。
- 同一应用配置多个消费者时，每个消费者都会收到事件；本插件按消息标识去重，避免同一实例重复注入。
- 多个 DSH 实例加载本插件时，每个实例都会创建自己的桥接会话并各自注入。

## 浏览器路由

鉴权界面通过同源 JSON 路由读取状态。

- 路由只在 `ctx.webServer` 存在时注册；宿主未加载 HTTP 服务时配置页的鉴权面板显示请求失败。
- 非回环来源与非同源 `Origin` 被拒绝；远程访问模式需要通过宿主自身的认证。
- 桌面版是否经 HTTP 服务渲染界面由宿主决定；路由不可达时弹窗保持隐藏，配置页显示请求错误并保留重新检测入口，不影响消息桥。

## 配置面板

- 只有标记 `.volatile()` 的字段出现在“插件”面板的配置页。
- 配置被更高层覆盖时，宿主拒绝保存，表单保留草稿并提示未接受。
- 表单命名空间是插件行在 profile 里的 id；`plugins.row.config` 的键是 `<包名>#<行 id>`。
- 配置页依赖 `dsh-client-ui-plugin-manager` 与 `dsh-client-ui-settings`；弹窗依赖 `dsh-client-ui-layout` 的 `shell.overlay`。

## 严格配置

配置中出现未知键或非法值时，插件加载失败。

- 用户在 `cordis.patch.yml` 写错键名会导致插件停用。旧版本的 `profile`、`ownerOpenId` 与 `larkCli` 例外，加载时被丢弃。
- 用 `dsh --profile <profile> --dump-config` 检查最终配置。

## 国际化

- 宿主在注册时捕获的文案保持注册时的语言；槽位渲染的文案随切换更新。
- 元数据或字典缺当前语言时按回退链取值。
- 规范见 [i18n.md](./i18n.md)。

## Windows 长路径

`node_modules` 嵌套很深，路径可能超过 Windows 的 260 字符上限。

- `git worktree remove` 此时报错 `Filename too long`。
- `finish-worktree.sh` 遇到该错误时用 Node.js `rmSync` 删除目录，再运行 `git worktree prune`。