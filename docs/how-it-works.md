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
| `src/lark-super-agent/` | `lark-super-agent` 行：调度服务、笔记、上报、归档、git、全局在场状态与状态路由 |
| `src/sa-dispatch/` | `SA-调度会话` 预设子行：调度工具、提示词与在场提醒插入 |
| `src/sa-worker/` | `SA-工作会话` 预设子行：`send_report`、提示词、调度消息标记、在场提醒插入与失败通知 |

宿主按 `cordis.patch.yml` 的 `name` 分别 import 各入口：

| 入口 | 行 |
| --- | --- |
| `dist/index.mjs` | 主行 `dsh-plugin-lark-bridge` |
| `dist/lark-super-agent.mjs` | `lark-super-agent` |
| `dist/sa-dispatch.mjs` | `preset-sa-dispatch` 内的 `sa-dispatch` 子行 |
| `dist/sa-worker.mjs` | `preset-sa-worker` 内的 `sa-worker` 子行 |

- `preset-sa-dispatch` 与 `preset-sa-worker` 是 `@deepseek-ai/dsh-agent-preset` 声明行，分别声明 `SA-调度会话` 与 `SA-工作会话`。
- 三行的元数据与图标放在 `rows/<行>/`。

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

`sessionProvider` 与 `sessionModel` 同时非空才构成模型选择，`sessionEffort` 只在模型成立时生效。`sessionPreset` 缺省为 `sa-dispatch`，空值表示跟随宿主默认预设。空白与半组配置按未配置处理。

保存任一项后，宿主发出 `loader/volatile-update`。插件更新配置、使旧工作区缓存失效、停止旧监听、立即重新解析，并执行一次完整鉴权检测。

## 鉴权

所有 lark-cli 调用使用本机当前生效的配置。插件不创建配置、不读取凭据，也不执行用户登录。终端命令见 [README](../README.md#使用)。

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

收发消息还需要在飞书开放平台为该应用完成配置：

1. 启用机器人能力。
2. 订阅 `im.message.receive_v1` 事件，并选择「接收单聊消息」。
3. 授予 `im:message.p2p_msg:readonly` 与 `im:message:send_as_bot` 权限。

## 浏览器通信

宿主注册两条同源 JSON 路由：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/lark-bridge/status` | 返回最近一次安全状态 |
| POST | `/lark-bridge/check` | 执行完整检测并返回安全状态 |
| GET | `/lark-bridge/presence` | 返回全局在场状态，由 `lark-super-agent` 行注册 |
| POST | `/lark-bridge/presence` | 写入 `{ presence: 'local' \| 'remote' }` 并返回新状态 |

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

## 调度服务与预设叠加

`lark-super-agent` 全局行提供 `larkSuperAgent` 服务，组合调度会话解析、笔记、上报存档、git 队列与消息投递。`sa-dispatch` 与 `sa-worker` 预设子行声明 `larkSuperAgent`、`systemPrompt`、`tools` 三项依赖，并通过 `ctx.inject` 注册能力。三项缺一不可，否则 Cordis 拒绝读取未声明的服务。全局行停用时，两个子行的工具与监听随依赖下线，飞书对话与 `lark_notify` 照常工作。

| 预设 | 组成 |
| --- | --- |
| `SA-调度会话` | 标准预设中的 11 个基础工具、meta-tools 十一项能力、`task_create`、`task_update`、`workspace_note_set`、`workspace_note_remove`、`task_candidates` 与调度提示词段 |
| `SA-工作会话` | 标准预设去掉 `tool-ask-user`，加入 `send_report`、任务提示词段与失败监听 |

- meta-tools 是 `SA-调度会话` 的子行，十一项能力全部开启，`session_preset` 固定为 `sa-worker`。
- 两个预设子行用 `ctx.systemPrompt.section` 注册各自会话的提示词。
- `SA-调度会话` 的提示词要求回复只给结论、保持简短，不用礼貌用语，不讲实现细节，不提无意义的疑问与建议。
- `SA-调度会话` 的提示词把用户指令默认理解为交给新建工作会话在工作区执行的独立任务。调度会话自身只在调度工作区读写笔记、任务归档与报告，用户明确要求时才亲自执行，也不建议由调度会话执行；建任务前按 `workspaces.json` 的 `summary` 与 `keywords` 匹配工作区。
- 只有 `workspaces.json` 已登记的工作区可以接收任务。没有匹配或多个都匹配时，调度会话不猜测、不执行，告知「我不知道在哪个工作区」并询问目标。
- 每个任务新建工作会话；只有用户明确要求才复用已有会话，无法判断时询问用户。`task_candidates` 仅用于查找用户要求复用的会话。
- 派发开始时，调度会话告诉用户任务 id、目标工作区与所选会话。
- 用户对上报的回答由调度会话送回原工作会话，并追加到任务笔记。
- 在场状态见[在场状态](#在场状态)。
- `SA-调度会话` 的提示词按最近的在场提醒选择渠道：离开时经 `lark_notify` 回复与转达，在电脑旁时在正文回复与转达。
- `SA-工作会话` 把 `source.kind` 为 `dsh-plugin-meta-tools` 的消息包进 `<dispatch_session_message>`，保留原消息 id 与 `source`，文本中的闭标签转义。这覆盖 `session_create` 的首条任务与 `session_send` 的提醒。
- `SA-工作会话` 的提示词用 `<dispatch_session_message>` 区分调度消息与用户消息，按最近的在场提醒选择模式：离开为远程模式，经 `send_report` 交流；在电脑旁为本机模式，正文直接对话，需求变更、完成与放弃仍上报。
- `SA-调度会话` 的提示词要求新建工作会话后先置顶，再发送任务要求；用户要求复用的会话保持原置顶状态。
- `SA-调度会话` 的提示词要求任务完成时先取得会话 id，标记完成后再逐个归档；仍被未完成任务引用的会话保持未归档，归档带 `stop_activity` 停止运行中的工作。
- 两个预设都不含 `ask_user_question`，也不修改新会话的默认预设。
- `SA-调度会话` 不含 `tool-jobs`，保留 `persona`、`agent-instructions`、`time-context`、`skill-filesystem` 与压缩组。压缩组的 `compaction-basic` 设 `thresholdRatio: 0.3`，上下文压力到模型窗口 30% 时触发压缩。
- 全局行与预设子行的工具叠加。`lark_notify` 来自本插件主行，其他插件的全局工具也照常可见。

## 在场状态

`lark-super-agent` 行持有一份内存中的全局在场状态：`local` 表示在电脑旁，`remote` 表示离开。

- 行启用时状态为 `local`，不写盘。
- 浏览器经 `/lark-bridge/presence` 读取与切换。`webServer` 是该行的可选依赖，就绪后才注册路由。
- 该行注册全局 `agent/pre-step`，在 `next()` 之后观察本批消息：
  - `source.kind === 'user'` 且 `guiInputSetsLocal` 开启时设为 `local`。
  - `source.kind === 'lark-bridge'`、非桥接提醒且 `larkInputSetsRemote` 开启时设为 `remote`。
  - 同批以最后一条可判定消息为准。同一消息对象只观察一次，手动切换与自动更新以发生先后为准。
- 两个开关在行配置中，均为 volatile，默认 `true`，前端为 `dsh-plugin-lark-bridge#lark-super-agent` 注册配置页。

两个预设子行在 `agent/pre-step` 调用服务的 `presence.reminderFor(session, messages)`：

1. 先观察本批消息，保证提醒使用更新后的状态。
2. 从 `session.surface.nodes` 末尾向前找第一条 `user/message` 且 `source.kind === 'sa-presence'` 的事件，读 `source.presence`。
3. 找不到或与当前状态不同时，在本批消息最前插入提醒，`source` 为 `{ kind: 'sa-presence', form: 'notice', presence }`。

- 识别与比较只读来源属性，不解析正文。
- 提醒正文两个预设共用，只陈述用户位置。
- 压缩移除提醒后，下一次模型请求前补回。
- 其他预设的会话不插入提醒。

前端 `PresenceController` 每 3 秒读取一次路由，页面隐藏时跳过：

- 回答为在场状态 JSON 时，在 `sidebar.footer.action` 注册按钮，`order: 52`。
- 回答不是 JSON 时视为行已停用，注销按钮。路由随行注销后，该路径的回答不是 JSON，0.2.2-rc.5 实测为无正文类型的 404。
- 网络失败时保持现状。
- 单击先显示目标状态再写入；写入期间暂停轮询，失败时恢复原状态并显示 3 秒错误态。

## 调度工作区存储

调度工作区是本插件配置的桥接工作区。全部笔记与上报都存放在该目录：

| 路径 | 内容与写入者 |
| --- | --- |
| `message-task-status.json` | 未归档任务；由任务写工具维护 |
| `workspaces.json` | 工作区笔记与派发白名单；由工作区写工具维护 |
| `reports/<taskId>/<reportId>.md` | 上报正文与元数据；由 `send_report` 写入 |
| `reports/<taskId>/<reportId>-<n>-<文件名>.md` | 上报附件副本；由 `send_report` 复制 |
| `reports/_unassigned/` | 无法关联任务的上报 |
| `archive/<taskId>/task.json` | 任务全量快照与归档时间 |
| `archive/<taskId>/reports/` | 已完成任务的全部上报与附件 |
| `AGENTS.md` | 长期记忆；由调度会话自行维护与提交 |

- JSON 先写临时文件再重命名，同一工作区的写入与 git 操作串行执行。
- 首次写笔记时，若调度工作区根目录不是 git 仓库顶层，程序执行 `git init`。
- 程序用路径限定的 `git add` 与 `git commit` 提交本次文件，提交作者沿用本机 git 配置。
- 本机需要安装 git，并配置 `user.name` 与 `user.email`。
- `task_update` 把状态改为 `completed` 时，程序在同一调用内移动任务快照与上报目录，并从 `message-task-status.json` 移除该任务。
- 程序不执行每周归档。

## 上报投递与失败监听

- 服务每次调用从 `$DSH_HOME/lark-bridge/state.json` 读取桥接会话 `sessionId` 与调度工作区 `workspaceRoot`；缺省 `$DSH_HOME` 为 `~/.dsh`。`workspaceRoot` 经 `toHostWorkspacePath` 转为当前平台的原生路径后再访问文件与 git。
- `send_report` 的 `text` 与 `files` 至少提供一项，`files` 为 Markdown 文件路径。
- `send_report` 校验文本与 Markdown 附件，生成 `reportId`，复制附件并写入上报记录，再把 `<work_session_message>` 块投递到调度会话。
- 投递使用 `sessionController.resolveAgent(sessionId)` 取得 agent，再调用 `agent.steer`。消息采用 `user` 角色，`source.kind` 为 `lark-super-agent`；空闲会话因此被唤醒。
- 注入块含 `sessionid`、`reportid` 与 `taskid`，始终保留 `<text>` 与 `<files>`。闭合标签与属性值会转义，`<files>` 列出调度工作区内副本的绝对路径。
- 文件写入并投递后执行 git 提交。提交失败不撤回已投递上报，工具结果附带 `warning`。
- `sa-worker` 监听 `session/event` 中 `reason.kind === 'error'` 的 `turn/end`，每轮失败向调度会话投递一次 `<work_session_failure>`；取消不触发通知。
- 失败通知包含工作会话、任务标识与截断后的错误原因。它不进入上报存档，也不提交 git；调度会话不可用时只写日志。

## 生命周期

- 事件子进程退出后按 2 秒起、上限 60 秒的退避重启。
- 插件卸载时终止子进程、注销路由和工具，并清理 Client 订阅与计时器。
- 鉴权失效时停止监听。
- 保存配置、增删工作区不重启监听；工作区失效后的注入按失败处理。

## 依赖

宿主提供的 `@deepseek-ai/*` 保持 external，与运行插件的 DSH 版本一致。`dsh-plugin-meta-tools` 是唯一的运行依赖，随本插件安装，由 `SA-调度会话` 的子行按包名加载。插件不声明 `@larksuite/cli` 依赖，所有调用固定使用本机命令 `lark-cli`。

Windows 一次性命令沿用受约束 shell 与安全参数白名单；macOS 与 Linux 使用 `shell: false`。
