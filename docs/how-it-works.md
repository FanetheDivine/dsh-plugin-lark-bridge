# 工作机制

## 组成

| 文件 | 作用 |
| --- | --- |
| `package.json` | 包元数据、依赖、发布内容与前端声明 |
| `cordis.patch.yml` | 插件行与默认配置 |
| `src/index.ts` | 唯一宿主入口 |
| `src/client/index.ts` | 浏览器入口，注册字典、弹窗与配置页 |
| `src/cli.ts` | 定位并调用 `@larksuite/cli` |
| `src/auth.ts` | 鉴权状态机与设备码授权 |
| `src/bridge.ts` | 事件消费、过滤、去重与注入 |
| `src/sessions.ts` | 工作区会话的创建、恢复、标题与置顶 |
| `src/routes.ts` | 浏览器读取状态与执行授权的同源 JSON 路由 |
| `src/state.ts` | 会话标识与去重窗口的持久化 |

## 入口契约

宿主 loader 识别四个导出：

| 导出 | 含义 |
| --- | --- |
| `name` | `dsh-plugin-lark-bridge`，与 `cordis.patch.yml` 的 `id` 一致 |
| `inject` | `tools`、`agents`、`webServer` |
| `apply(ctx, config)` | 读取配置、装配服务、注册工具与路由 |
| `Config` | 配置 schema，字段全部 `.volatile()` |

`apply` 完成后不阻塞启动。鉴权检查在后台执行，结果通过回调驱动事件监听。

## 配置

`readConfig` 展开 `.volatile()` 引用后交给 `resolveConfig` 严格校验：未知键、非法档案名、非法 open_id 直接抛错。

保存 volatile 字段时宿主发出 `loader/volatile-update`。插件重新读取配置，按新的 `larkCli` 重建 CLI 适配，再执行一次鉴权检查。工作区与标题在下一次消息或注入时生效。

## 鉴权

鉴权分四个阶段，按依赖顺序推进：

| 阶段 | 判定 |
| --- | --- |
| `cli-missing` | `lark-cli --version` 无法启动 |
| `app-missing` | 专用档案不在 `profile list` 中 |
| `bot-unavailable` | `auth status` 的 `identities.bot.status` 不是 `ready` |
| `user-missing` | bot 就绪，但配置与授权结果都没有 open_id |
| `ready` | bot 就绪且 open_id 可用 |

`ready` 的 open_id 来自 `ownerOpenId` 配置或 `identities.user.openId`。用户 token 处于 `needs_refresh` 时 open_id 仍可用，因此不阻断桥接。

### 应用绑定

配置页把 App ID 与 App Secret 提交到 `POST /lark-bridge/app`。宿主执行：

```sh
lark-cli profile add --name <profile> --app-id <id> --app-secret-stdin --brand feishu
```

Secret 只写入子进程 stdin。档案已存在时，先 `profile remove` 再添加；删除范围仅限插件专用档案。

### 设备码授权

`POST /lark-bridge/auth/start` 执行：

```sh
lark-cli --profile <profile> auth login --no-wait --json --scope auth:user.id:read
```

响应中的 `verification_url` 返回给浏览器。宿主随即在后台执行 `auth login --device-code <code> --json`，完成后重新检测。取消授权只丢弃后台结果，不改动已保存的凭据。

### 浏览器通信

宿主注册六条同源 JSON 路由：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/lark-bridge/status` | 鉴权阶段、用户、工作区、会话与待授权链接 |
| POST | `/lark-bridge/check` | 重新检测 |
| POST | `/lark-bridge/app` | 绑定应用 |
| POST | `/lark-bridge/auth/start` | 开始授权 |
| POST | `/lark-bridge/auth/cancel` | 取消授权 |
| POST | `/lark-bridge/session/reset` | 清除会话记录 |

路由只接受回环来源，`Origin` 必须与 `ctx.webServer.getOrigin()` 一致；存在 `ctx.connection` 时再调用 `requestRejection` 做宿主校验。请求体上限 64 KiB。

浏览器入口每 3 到 5 秒读取一次状态。鉴权未就绪时，`shell.overlay` 弹窗显示阶段与入口；配置页的鉴权面板执行同样的读取与动作。

## 消息

事件监听以子进程运行：

```sh
lark-cli --profile <profile> event consume im.message.receive_v1 --as bot --quiet --timeout 0
```

stdout 是 NDJSON。插件逐行解析并过滤：

- `chat_type` 必须是 `p2p`。
- `sender_type` 必须是 `user`。
- `sender_id` 必须等于已绑定 open_id。
- `message_id` 必须未出现在去重窗口。

消息正文优先使用事件的 `content`；为空时用 `[<message_type> 消息]` 占位。注入文本包含发送者、时间、消息 ID 与正文。

## 会话

状态文件保存 `sessionId` 与它所属的 `workspaceRoot`。

- 路径一致且会话可恢复时复用。
- 恢复失败、会话已归档或路径变化时新建。
- 新建会话的 `meta.cwd` 是工作区路径，setup 阶段追加 `session/title`。
- 创建后挂到对应工作区并 `pinSession`。
- 配置标题与记录不同时，复用会话追加新的 `session/title`。

注入使用 `createUserMessage`，`source.kind` 是 `lark-bridge`，再调用 `agent.followup` 唤醒会话。

## 通知

`lark_notify` 读取当前用户 open_id，按 15 000 字符分段，逐段执行：

```sh
lark-cli --profile <profile> im +messages-send --as bot --user-id <open_id> --text <part> --idempotency-key <key>
```

任一段失败时返回 `{ ok: false, error }`，不抛异常。

## 生命周期

- 事件子进程退出后按 2 秒起、上限 60 秒的退避重启；运行超过 30 秒的进程退出时重置退避。
- 插件卸载时终止子进程、注销路由、注销工具并取消待完成授权。
- 鉴权变为未就绪时停止监听；恢复就绪后重新启动。

## 依赖

宿主提供的 `@deepseek-ai/*` 保持 external，与运行插件的 DSH 版本一致。`@larksuite/cli` 是运行时依赖，按包目录解析 `bin/lark-cli`；二进制缺失时执行 `scripts/run.js` 触发按需下载。子进程不经过 shell。