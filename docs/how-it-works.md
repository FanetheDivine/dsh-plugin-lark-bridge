# 工作机制

## 组成

| 文件 | 作用 |
| --- | --- |
| `src/index.ts` | 宿主入口、完整检测与统一监听协调 |
| `src/client/index.ts` | 浏览器入口、共享表单与共享状态控制器 |
| `src/cli.ts` | 调用本机 `lark-cli`、管理子进程并解析 JSON |
| `src/auth.ts` | CLI、bot、user 独立连接状态 |
| `src/workspace.ts` | 注册工作区解析、缓存与删除失效 |
| `src/workspace-path.ts` | Linux 风格路径、平台比较与 Host 原生路径转换 |
| `src/bridge.ts` | 事件消费、过滤、去重与注入 |
| `src/quote.ts` | 被引消息读取与 `<quote>` 渲染 |
| `src/sessions.ts` | 工作区会话的创建、恢复、新建标题与置顶 |
| `src/routes.ts` | 安全状态与完整检测的同源 JSON 路由 |
| `src/state.ts` | 会话标识、归一化路径与去重窗口的持久化 |

## 入口契约

宿主 loader 识别四个导出：

| 导出 | 含义 |
| --- | --- |
| `name` | `dsh-plugin-lark-bridge`，与 `cordis.patch.yml` 的 `id` 一致 |
| `inject` | `tools`、`agents`、`webServer`、`workspaceRegistry` |
| `apply(ctx, config)` | 装配服务、注册工具与路由、执行完整检测 |
| `Config` | 仅包含 volatile `workspaceRoot` 的 schema |

`apply` 完成后不阻塞启动。鉴权结果、配置热重载与工作区注册删除共同驱动事件监听。

## 配置

`readConfig` 展开 `.volatile()` 引用后交给 `resolveConfig` 严格校验。当前读取 `workspaceRoot`、`sessionProvider`、`sessionModel`、`sessionEffort` 与 `sessionPreset`；旧 `profile`、`ownerOpenId`、`larkCli`、`sessionTitle` 与 `authCheckOnStartup` 被接受并丢弃。

`sessionProvider` 与 `sessionModel` 同时非空才构成模型选择，`sessionEffort` 只在模型成立时生效。`sessionPreset` 为空表示跟随宿主默认预设。空白与半组配置按未配置处理。

保存任一项后，宿主发出 `loader/volatile-update`。插件更新配置、使旧工作区缓存失效、停止旧监听、立即重新解析，并执行一次完整鉴权检测。

## 鉴权

所有 lark-cli 调用使用本机当前生效的配置。插件不创建配置、不读取凭据，也不执行用户登录。终端命令见 [README](../README.md#前置)。

每次完整检测依次执行：

```sh
lark-cli --version
lark-cli auth status --json --verify
```

| 状态 | 判定 |
| --- | --- |
| `cli` | `--version` 能启动时为 `connected`，启动失败为 `disconnected` |
| `bot` | `identities.bot.status === 'ready'` 时为 `connected` |
| `user` | `identities.user.openId` 存在时为 `connected` |
| `ready` | 三项均为 `connected`，并提供 owner open_id |

首次检测前三项为 `checking`。状态命令失败时 CLI 保持 `connected`，bot 与 user 为 `disconnected`，详细原因只写后端日志。

插件加载、GUI 打开和三个检测按钮都执行带 `--verify` 的完整检测。并发检测共享同一个 Promise；定时状态刷新不执行 CLI。

## 浏览器通信

宿主注册两条同源 JSON 路由：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/lark-bridge/status` | 返回最近一次安全状态 |
| POST | `/lark-bridge/check` | 执行完整检测并返回安全状态 |

安全状态只包含 `cli`、`bot`、`user`、`ready` 与 `checkedAt`。路由不发送鉴权 URL、原始错误、App ID、用户名、open_id、token、scope 或会话错误。

路由只接受回环来源，`Origin` 必须与 `ctx.webServer.getOrigin()` 一致；存在 `ctx.connection` 时再调用 `requestRejection`。

Client 只创建一个状态控制器和一个配置表单。弹窗与配置页共享它们，工作区列表通过 `useWorkspaces` 订阅。

## 工作区

配置、前端选项和状态文件统一使用 Linux 风格路径：

| 原始值 | 归一化值 |
| --- | --- |
| `C:\work\demo` | `/c/work/demo` |
| `C:/work/demo` | `/c/work/demo` |
| `/home/user/project` | `/home/user/project` |

Windows 比较忽略大小写，POSIX 比较保持大小写敏感。调用 `workspaceRegistry.resolveByPath`、目录访问和会话创建前，Windows 路径转换回 `C:/work/demo` 形式。

`WorkspaceSelection` 使用 `resolveByPath` 解析当前配置，目录存在但未注册时无效。每次异步解析递增序号，旧结果不能覆盖新选择。

宿主没有专用 Workspace 生命周期事件。插件监听 `domain/changed`，筛选 `workspace` domain、`workspaces` 表与 `deleted` 操作。目标 id 命中当前缓存时，先同步停止事件桥，再重新解析。

`SessionManager` 在创建会话前和最终 `agent.followup()` 前分别校验注册关系。注入路径不调用 `registry.create()`。

## 消息

事件监听以子进程运行：

```sh
lark-cli event consume im.message.receive_v1 --as bot --quiet --timeout 0
```

监听在 CLI、bot、user 与工作区全部就绪后启动，启动时刻写入 `startedAt`。插件只接受 owner open_id 的私聊；消息按 `message_id` 去重。

事件按以下顺序处理：

1. 鉴权未就绪或发送者不符时丢弃。
2. `message_id` 已在去重窗口时忽略。
3. `create_time` 早于 `startedAt` 时过滤并记日志；飞书会按 `15 秒 / 5 分钟 / 1 小时 / 6 小时` 重推未确认事件，这些历史消息不会注入。
4. 有 `reply_to` 时读取被引消息：`lark-cli im +messages-mget --no-reactions`，user 身份优先、bot 兜底，单次 8 秒。
5. 其余消息进入队列，并重置 15 秒静默计时。

计时到点且队列非空时，一次取走全部消息，按 `create_time` 升序拼成一个用户消息，每条一个 `<lark-message message_id="…" reply_to="…" time="…">` 块：

- 普通文本：块内是正文；非文本消息使用类型占位。
- 引用回复：块内先放 `<quote message_id="…" from="…" time="…">`，再放本条正文。读取失败时 `<quote>` 保留消息 ID 与失败说明，并记录一条警告。
- 引用正文最多 500 字符，超出追加「（已截断）」。
- 聊天记录消息：块内是 `<forwarded_messages message_id="…"/>`，不展开子消息。
- 块边界与属性值会转义。

注入失败时整批丢弃并记录原因，不重试。监听停止时清空队列与计时器。

ACK 由 lark-cli 完成；插件持续读取消费者输出，注入不阻塞事件读取。

## 会话

状态文件保存 `sessionId`、归一化 `workspaceRoot`、创建时的标题与去重窗口。

- 路径一致且会话可恢复时复用。
- 恢复失败、会话已归档或路径变化时新建。
- 新建会话使用固定标题「飞书桥接会话」；复用会话保留已有标题。
- 新建会话挂到已注册工作区并置顶。
- 新建会话经 `sessionController.create` 建立，只传注册工作区标识与配置的预设；配置的模型先经 `llm.resolveCallConfig` 校验，再写入 `agent.model.select`。
- 预设不在宿主名册、名册读取失败或模型校验失败时，新建会话按宿主默认运行并记录警告；飞书消息照常注入。
- 已存在的会话保持原有模型与预设。
- 注入使用 `createUserMessage`，`source.kind` 是 `lark-bridge`，再调用 `agent.followup`。
- 桥接提醒是一条 `source.reminder` 为 true 的 `<system-reminder>` 用户消息。

`agent/pre-step` 检查桥接会话的表层：缺少提醒时把它插到本批第一条 `<lark-message>` 之前，已有提醒时跳过。桥接会话由状态文件的 `sessionId` 识别，因此压缩覆盖提醒后，下一次模型请求前会补回。

会话归档由 DSH 管理，插件没有重置入口。

## 通知

`lark_notify` 只在桥接会话可见与可执行。判定用状态文件的 `sessionId`，与提醒补注一致；其他会话的步骤既拿不到工具声明，也无法执行该工具。执行体在 agent 缺失或不是桥接会话时返回 `not-bridge-session`，不发送请求。

`lark_notify` 读取当前 owner open_id，按 15 000 字符分段，逐段执行：

```sh
lark-cli im +messages-send --as bot --user-id <open_id> --text - --idempotency-key <key>
```

正文通过 stdin 传递。任一段失败时返回 `{ ok: false, error }`。

提供 `reply_to` 时，首段改为：

```sh
lark-cli im +messages-reply --as bot --message-id <message_id> --text - --idempotency-key <key>
```

其余段仍用 `+messages-send`。`reply_to` 不做预先校验，无法回复时返回 `reply-failed` 错误，不回落为普通发送。

## 生命周期

- 事件子进程退出后按 2 秒起、上限 60 秒的退避重启。
- 插件卸载时终止子进程、注销路由和工具，并清理 Client 订阅与计时器。
- 鉴权失效时停止监听。
- 保存配置、增删工作区不重启监听；工作区失效后的注入按失败处理。

## 依赖

宿主提供的 `@deepseek-ai/*` 保持 external，与运行插件的 DSH 版本一致。插件不声明 `@larksuite/cli` 依赖，所有调用固定使用本机命令 `lark-cli`。

Windows 一次性命令沿用受约束 shell 与安全参数白名单；macOS 与 Linux 使用 `shell: false`。
