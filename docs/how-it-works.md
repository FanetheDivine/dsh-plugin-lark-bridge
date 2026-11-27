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
| `src/lark-super-agent/` | `lark-super-agent` 行：调度服务、笔记、上报、归档与 git |
| `src/sa-dispatch/` | `SA-调度会话` 预设子行：调度工具与提示词 |
| `src/lark-super-agent/managed/` | 被管理会话能力：`send_report`、调度消息标记、提问拦截、S 注入、轮次自动上报、失败与归档通知 |

宿主按 `cordis.patch.yml` 的 `name` 分别 import 各入口：

| 入口 | 行 |
| --- | --- |
| `dist/index.mjs` | 主行 `dsh-plugin-lark-bridge` |
| `dist/lark-super-agent.mjs` | `lark-super-agent` |
| `dist/sa-dispatch.mjs` | `preset-sa-dispatch` 内的 `sa-dispatch` 子行 |

- `preset-sa-dispatch` 是 `@deepseek-ai/dsh-agent-preset` 声明行，声明 `SA-调度会话`。
- 两行的元数据与图标放在 `rows/<行>/`。

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

安全状态只包含 `cli`、`bot`、`user`、`ready` 与 `checkedAt`。路由不发送鉴权 URL、原始错误、App ID、用户名、open_id、token、scope 或会话错误。

路由只接受回环来源，`Origin` 必须与 `ctx.webServer.getOrigin()` 一致；存在 `ctx.connection` 时再调用 `requestRejection`。

Client 只创建一个状态控制器和两个配置表单：主行与「调度会话」行。弹窗与配置页共享它们，工作区列表通过 `useWorkspaces` 订阅。

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
5. 其余消息进入队列并立即投递：队列按 `create_time` 升序逐条注入，每条一个用户消息，内含一个 `<lark-message message_id="…" reply_to="…" time="…">` 块：

- 普通文本：块内是正文；非文本消息使用类型占位。
- 引用回复：块内先放 `<quote message_id="…" from="…" time="…">`，再放本条正文。读取失败时 `<quote>` 保留消息 ID 与失败说明，并记录一条警告。
- 引用正文最多 500 字符，超出追加「（已截断）」。
- 聊天记录消息：块内是 `<forwarded_messages message_id="…"/>`，不展开子消息。
- 块边界与属性值会转义。

注入失败时丢弃该条并记录原因，不重试，队列中的后续消息继续注入。会话空闲时开新轮，运行中并入当前轮的下一步。监听停止时清空队列。

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
- 桥接提醒要求所有桥接会话一律经 `lark_notify` 回复：完整内容写在通知里，成功送达后正文最多一句概述；通知失败时正文保留完整内容。
- 同一批输入里，同一任务的内容合并成一条回复，不同任务各回一条，回复之后到达的消息单独回复。带 `task_id` 的通知由插件在开头补写「名称 (id)」，正文不重复。上报块、失败通知、归档通知与任务日志块不是用户消息，不为它们本身回复。

`agent/pre-step` 检查桥接会话的表层：缺少提醒时把它插到本批第一条 `<lark-message>` 或任务日志注入消息之前，已有提醒时跳过。桥接会话由状态文件的 `sessionId` 识别，因此压缩覆盖提醒后，下一次模型请求前会补回。

会话归档由 DSH 管理，插件没有重置入口。

## 通知

`lark_notify` 只在桥接会话可见与可执行。判定用状态文件的 `sessionId`，与提醒补注一致；其他会话的步骤既拿不到工具声明，也无法执行该工具。执行体在 agent 缺失或不是桥接会话时返回 `not-bridge-session`，不发送请求。

参数用 zod 声明，经 `z.toJSONSchema` 转换后复制成纯 JSON 副本作为工具声明：剔除 `$schema` 与 zod 的不可枚举 `~standard` 键，宿主只能克隆可枚举字符串键。声明里 `text` 必填，`reply_to`、`mode`（`text` 或 `card`）、`summary` 与 `task_id` 可选。执行体自行校验参数，失败码为 `invalid-args`、`invalid-text`、`invalid-reply-to`、`invalid-mode`、`invalid-summary`、`invalid-task-id`、`task-not-found`、`task-ledger-unavailable`。

`lark_notify` 读取当前 owner open_id。`text` 模式按 15 000 字符分段，逐段执行：

```sh
lark-cli im +messages-send --as bot --user-id <open_id> --text - --idempotency-key <key>
```

正文通过 stdin 传递。任一段失败时返回 `{ ok: false, error }`。

提供 `reply_to` 时，首段改为：

```sh
lark-cli im +messages-reply --as bot --message-id <message_id> --text - --idempotency-key <key>
```

其余段仍用 `+messages-send`。`reply_to` 不做预先校验，无法回复时返回 `reply-failed` 错误，不回落为普通发送。

`card` 模式发送 Card 2.0：`header.title` 是 `summary`，`body` 是默认收起的 `collapsible_panel`，面板内是 `text` 的 Markdown。卡片 JSON 经 stdin 传入：

```sh
lark-cli im +messages-send --as bot --user-id <open_id> --msg-type interactive --content - --idempotency-key <key>
```

- 单张卡片 JSON 不超过 28 000 字节（飞书上限 30 KB，留出余量）。超过时在 Markdown 段落边界拆成多张，标题带「（i/n）」；单个超长段落再按行、按字符拆分。
- 首张卡片使用 `reply_to`，其余用普通发送。
- 插件不自动发卡片，卡片只由调度会话主动调用。

带 `task_id` 时，`lark_notify` 自行读取状态文件与调度工作区台账查找未结束任务，不依赖 `lark-super-agent` 行是否启用。任务不存在或已结束返回 `task-not-found`；工作区未配置或台账校验失败返回 `task-ledger-unavailable`；两者都不发送。找到任务后：

- 文本模式在正文首行加「<title> (<task id>)」；卡片模式把它写在 `header.subtitle`。
- 不带 `task_id` 的调用不读台账，照常发送。

多段或多张发送中第 n 张失败时，错误说明已发送条数与第一条消息标识，已发出的消息不撤回；调度会话只补发剩余部分。

模型可见的成功结果只有「已发送给用户（消息 <messageId>）」。`output.presentationMeta` 只把任务会话标识 `taskSessionId` 持久化到 `tool/result.meta`，仅在带 `task_id` 且解析成功时出现。

成功的 `lark_notify` 在对话中显示完整正文与所属任务：

- 前端注册 Conversation Definition `lark-notify-result`，匹配 `lark_notify` 的 `tool/call` 与成功的 `tool/result`。成功文案同时识别新文案与历史文案（「已发送给用户（消息 …）」「已发送给用户（N 条）」「已回复给用户（N 条）」）。卡片内容取自 `tool/call` 的 `arguments`：`text`、卡片模式的 `summary` 与 `task_id`；会话取自结果元数据的 `taskSessionId`，兼容历史元数据的 `sessionId`。
- Definition 产出 `lark-notify` Chat 节点，`groupTree` 为 `turn`，位于结果之后。节点不进入过程分组，轮次折叠后仍然可见。
- 卡片注册在 `conversation.chat.node` 的 `lark-notify` 键，按纯文本保留换行。卡片模式常显总结，完整 Markdown 放在默认收起的 `<details>`。带 `task_id` 时显示任务标识，会话区域显示任务会话标识，并通过 `useWorkspaces` 同时读取工作区成员关系与归档状态。没有 `task_id` 且没有历史元数据时不显示任务与会话。
- 目标属于工作区且未归档时显示按钮，点击调用 `ctx.uiWorkspace.openSession`。已归档目标显示「已归档」标签，未知目标只显示标识。
- 进行中、失败与中断沿用宿主默认工具行。历史窗口缺少调用参数或正文为空时不产生空卡片；历史结果缺少元数据时只显示正文。

## 调度服务与预设叠加

`lark-super-agent` 全局行声明 `tools` 依赖并提供 `larkSuperAgent` 服务，组合任务台账、上报存档、git 队列、被管理会话能力与消息投递。`sa-dispatch` 预设子行声明 `larkSuperAgent`、`systemPrompt`、`tools` 三项依赖，并通过 `ctx.inject` 注册调度能力；三项缺一不可，否则 Cordis 拒绝读取未声明的服务。全局行停用时，子行的工具与监听随依赖下线，飞书对话与 `lark_notify` 照常工作。

| 预设 | 组成 |
| --- | --- |
| `SA-调度会话` | 标准预设中的 11 个基础工具、meta-tools 十项能力与本插件覆写的 `session_create`、`list_models`、`session_model`、`session_restore`、`task_update`、`task_end`、`session_manage`、`session_unmanage`、`workspace_note_set`、`workspace_note_remove` 与调度提示词段 |

- 「被管理」是会话状态，与预设无关：`message-task-status.json` 中某个未结束任务记录的 `sessionId` 即为被管理会话，一个会话最多对应一个任务。
- 被管理会话的能力全部注册在全局行，见[被管理会话能力](#被管理会话能力)。
- meta-tools 是 `SA-调度会话` 的子行，预设补丁关闭它的 `session_create`，其余九项能力开启。`session_create` 由 `sa-dispatch` 子行提供，见「任务会话模型」。
- `SA-调度会话` 用 `ctx.systemPrompt.section` 注册提示词，要求自己的话只给结论、保持简短；转达报告全文不受此限。
- 提示词写明用户只能看到 `lark_notify` 的内容。用户每条消息都回复；`session_create`、`session_send`、`session_manage`、`session_unmanage`、`task_end` 成功后下一步用 `lark_notify` 回应，置顶与归档排在同一步或其后，失败另发一条通知。同一任务的内容合并为一条并带 `task_id`，不同任务分开发送；`task_end` 与 `session_unmanage` 之后任务已不存在，通知不带 `task_id`，正文开头写「<title> (<task id>)」。
- 对用户提及任务时写成「名称 (id)」：名称取台账当前标题，每次提及都用全形式；名称取不到时说明并给出 id。桥接提醒对提及任务的情况提出同样要求。
- 提示词要求调度会话自行回答 DSH 元信息问题（工作区、会话、任务状态），不为这类问题建任务。
- 提示词把用户指令默认理解为交给新建任务会话在工作区执行的独立任务。调度会话自身只在调度工作区读写笔记、任务归档与报告。
- 只有 `workspaces.json` 已登记的工作区可以接收任务。没有匹配或多个都匹配时，调度会话不猜测、不执行，告知「我不知道在哪个工作区」并询问目标。
- 每条用户消息默认是新任务。只有引用了未结束任务的消息，或点名未结束任务的标题或 id，才归入该任务；无法判断时询问用户。
- 用户要接管已有会话时调用 `session_manage`，要停止管理时调用 `session_unmanage`。用户归档会话时任务随之归档。
- 用户要求切换某个会话的模型时调用 `session_model`：省略 `session_id` 即切换调度会话自己；先 `llm.resolveCallConfig` 校验，再 `agent.model.select`，只写该会话的选择事件，从下一步生效，当前请求保持原模型。目标会话已归档时仍记录，结果 `archived: true`。宿主在下一步按新路由的上下文容量做压缩检查，容量不足时该步报错并保留原模型。
- 用户要求恢复已归档会话时调用 `session_restore`：解除归档，恢复结束原因为 `session_archived` 的最近归档任务及其报告与任务日志，再按 `pin`（默认 `true`）置顶。任务恢复失败或跳过时返回 `taskRestored: false` 与 `warning`，会话仍已解除归档。
- 派发与接管任务时，调度会话用 `session_pin` 置顶任务会话；再次置顶与取消置顶只在用户要求时进行。取消管理不归档，会话与其置顶保留。
- 调度会话先判断点名任务的消息是否是给任务会话的指令：指令追加到任务后用 `session_send` 投递；给调度会话自己的说明只用 `task_update` 的 `add_message` 记录并回应用户，不投递；无法判断时询问用户。
- 发往任务会话的消息只有两类：用户本人的指令、补充或回答，以及请求重发报告的消息。调度会话不向任务会话发送对报告的确认或转述。
- 调度会话按上报的 `kind` 更新任务：`progress` 设为 `in_progress`，`question` 设为 `waiting_user`，不论是否通知用户。上报不结束任务。
- 报告既没有描述任务当前状态、也没有需要用户确认的点时，调度会话向任务会话发一次重发请求，要求用 `send_report` 报告当前状态与待确认点；`turn_end` 与 `send_report` 两类都适用，不设次数上限。
- 只有本份报告含新的结果、里程碑、阻塞、失败或提问时，调度会话才通知用户，并按上报原文送达，只补充任务、工作区与待决问题等自己掌握的信息；长报告用 `lark_notify` 的卡片模式。
- 任务会话轮次失败时，调度会话把任务设为 `failed`，就该次失败通知用户一次，用户要求后才重试。
- 调度会话自行判断任务是否完成：判断完成时先询问用户，用户确认后才用 `task_end(completed)` 结束；用户要求结束或取消时直接用 `task_end(cancelled)`。结束任务后以 `session_archive` 的 `stop_activity: true` 归档该任务的会话，归档同时移除置顶。
- `SA-调度会话` 不含 `tool-jobs`，保留 `persona`、`agent-instructions`、`time-context`、`skill-filesystem` 与压缩组。压缩组的 `compaction-basic` 设 `thresholdRatio: 0.3`，上下文压力到模型窗口 30% 时触发压缩。
- 全局行与预设子行的工具叠加。`lark_notify` 来自本插件主行，其他插件的全局工具也照常可见。

## 被管理会话能力

全局行注册以下能力，作用于所有非调度会话：

| 能力 | 行为 |
| --- | --- |
| `send_report` | 除调度会话外都能看到；未被管理的会话调用报错。描述要求只在被要求时调用，并规定上报送达后正文最多一句简短收尾 |
| 调度消息标记 | `source.kind` 为 `dsh-plugin-meta-tools` 的消息包进 `<dispatch_session_message>` |
| 提问拦截 | 被管理会话的 `ask_user_question` 在执行前被拒绝，工具体不运行，轮次继续；问题记入 S 与轮次结束补投 |
| S 注入 | 提问被拒绝或等待被结束后，在下一次模型请求前插入一条临时指令，要求用 `send_report` 上报自足的提问 |
| 轮次自动上报 | 正常结束、本轮未上报、无运行中子代理时把最后一段文本作为 `progress` 上报；拦截代为上报的轮次同样视为已上报 |
| 失败通知 | 轮次以错误结束时投递 `<task_session_failure>` |
| 归档通知 | 被管理会话被归档时归档任务并投递 `<task_session_archived>` |

- 被管理会话的提问由 `tools/pre-execute` 拒绝，模型收到错误结果，要求立刻用 `send_report` 的 `question` 上报。其他插件要求审批时同样改为拒绝，不进入审批等待。
- 每次被拦截调用的 `questions` 参数按会话累积，内容相同的问题只保留一份。
- 模型成功上报 `question` 后，该会话的待处理问题清空。
- 轮次结束时仍有待处理问题，插件补投一条 `question` 上报，`origin` 为 `ask_intercept`，正文逐条列出题面、表头与选项；投递成功且任务为 `in_progress` 时置 `waiting_user`。补投在轮次被停止时同样执行，任务已结束时跳过。补投的轮次不再触发 `turn_end` 自动上报。
- 会话开始被管理时与插件加载后，已在等待的提问被结束：插件加载后开始的提问由 `tools/execute` 换上可中止信号；加载前已等待的提问由网关私有接口取消。网关不可用时只记日志。
- S 是 `source.kind` 为 `lark-task-rules` 的临时用户消息，正文见 `src/lark-super-agent/managed/task-rules.ts` 的 `TASK_RULES_TEXT`：
  - 说明本会话不能直接提问，这次提问用户没有看到，要求立刻用 `send_report` 的 `question` 上报。
  - 要求报告自足：任务目的与当前状态、每个问题及其选项含义与建议，并用 `desc` 概括任务。
  - 收尾要求与 `send_report` 描述同口径，并要求后续忽略它。
  - 有被拦截的问题时，末尾附「Blocked questions」段，逐条列出题面、表头、选项与说明。
- 同一会话同一时刻只保留一条 S；同一步内的多次拦截合并到这一条。
- 自动上报带 `origin="turn_end"`，手动上报带 `origin="send_report"`，拦截上报带 `origin="ask_intercept"`，调度会话据此区分。

## 任务会话模型

`lark-super-agent` 行的 `commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`、`complexTaskProvider`、`complexTaskModel`、`complexTaskEffort`、`defaultTaskType` 与 `taskPreset` 保存新建任务会话时使用的普通/复杂任务模型、默认任务类型与预设。模型与预设字段均为 volatile 字符串，默认空；`defaultTaskType` 取 `'common'` 或 `'complex'`，默认 `'common'`。provider 与模型同时非空才成立，effort 只在成立时生效。

- 配置页复用官方 `ModelSelect` 与模型目录，普通任务与复杂任务分别使用一个 `ModelDefaults` 实例，并在标题旁提供「默认」/「设为默认」切换 `defaultTaskType`。
- 「任务会话预设」复用主行「预设」的下拉组件，配置键为 `taskPreset`，空值表示跟随宿主默认。可选项不含 `sa-dispatch`；已存该值时照常生效，选择器把它显示为禁用的不可用项。
- `sa-dispatch` 子行注册自己的 `session_create`，参数不含 `agent_preset`，支持可选 `task_type`（`'common'`、`'complex'` 或空值），预设始终取配置值。
- 创建流程：`sessionController.create` 新建会话，随后 `agent.model.select` 写入模型，再改标题，接着建立任务，最后发送首条提示。首条提示在选择之后才送达，首轮请求即用该模型，首轮结束的自动上报也能找到任务。
- 模型优先级：调用参数里的 `provider`、`model`、`effort` 覆盖任务类型模型；其次是 `task_type`（为空时取配置的 `defaultTaskType`）对应的「普通任务模型」或「复杂任务模型」；最后是宿主默认（不在普通与复杂任务模型之间互相回退）。
- 显式参数经 `llm.resolveCallConfig` 校验，失败时报错且不创建会话。配置的模型校验失败、`llm` 不可用或未配置时，新会话沿用宿主默认，校验失败写一条警告。
- 配置的预设不在宿主名册时省略，由宿主选默认预设，并写一条警告。
- 选择只写入新会话本身，不写任何默认模型设置。
- 保存配置后无需重启，每次调用读取实时配置。

## 调度工作区存储

调度工作区是本插件配置的桥接工作区。全部任务与上报都存放在该目录：

| 路径 | 内容与写入者 |
| --- | --- |
| `message-task-status.json` | 未结束任务；由任务工具与 `session_create` 维护 |
| `workspaces.json` | 工作区笔记与派发白名单；由工作区写工具维护 |
| `reports/<taskId>/<reportId>.md` | 上报正文与元数据；由 `send_report` 与自动上报写入 |
| `reports/<taskId>/<reportId>-<n>-<文件名>.md` | 上报附件副本 |
| `task-logs/<taskId>.jsonl` | 任务日志：用户直接与任务会话交互的记录；由插件在 `session/event` 中追加，不单独 git 提交 |
| `archive/<taskId>/task.json` | 任务全量快照、归档时间与结束原因 |
| `archive/<taskId>/reports/` | 已结束任务的全部上报与附件 |
| `archive/<taskId>/task-log.jsonl` | 任务结束时由 `task-logs/` 迁入的日志；归档后插件与调度会话都不再读取 |
| `AGENTS.md` | 长期记忆；由调度会话自行维护与提交 |

- `message-task-status.json` 与 `workspaces.json` 用 zod 校验。校验不通过时按空台账处理，下次写入覆盖。
- 任务标题与工作区笔记为单行文本。任务消息正文允许多行。
- 台账校验不通过时，`task_update` 与 `task_end` 报告台账校验失败，不再返回 `task not found`。
- JSON 先写临时文件再重命名，同一工作区的写入与 git 操作串行执行。
- 首次写笔记时，若调度工作区根目录不是 git 仓库顶层，程序执行 `git init`。
- 程序用路径限定的 `git add` 与 `git commit` 提交本次文件，提交作者沿用本机 git 配置。
- 本机需要安装 git，并配置 `user.name` 与 `user.email`。
- `task_end` 把任务移入归档并记录结束原因，同时移动上报目录与任务日志，再从 `message-task-status.json` 移除该任务。会话保持未归档。
- 日志迁移的 git 提交含 `archive/<taskId>/task-log.jsonl`；日志平时不提交，源文件通常未被跟踪，只有已被跟踪时才同时提交其删除。
- 结束原因取 `completed`、`cancelled`、`unmanaged`、`session_archived` 或 `session_missing`。
- `session_restore` 取某会话 `archivedAt` 最新的 `archive/<taskId>/task.json`：结束原因为 `session_archived` 时把报告目录与任务日志迁回原位、任务写回台账、删除归档目录并提交；其他结束原因不恢复任务。

## 上报投递与失败监听

- 服务每次调用从 `$DSH_HOME/lark-bridge/state.json` 读取桥接会话 `sessionId` 与调度工作区 `workspaceRoot`；缺省 `$DSH_HOME` 为 `~/.dsh`。`workspaceRoot` 经 `toHostWorkspacePath` 转为当前平台的原生路径后再访问文件与 git。
- `send_report` 的 `kind` 必填，取值为 `progress` 与 `question`。取值之外报参数错误，不存档也不投递。
- `send_report` 的 `text` 与 `files` 至少提供一项，`files` 为 Markdown 文件路径；`desc` 可选，只记录在 front matter 中。
- 未被管理的会话调用 `send_report` 直接报错，不存档也不投递。
- 上报存档的 front matter 记录 `kind`、`origin`、可选 `desc` 与任务标识。服务不按 `kind` 修改任务状态。
- `send_report` 校验文本与 Markdown 附件，生成 `reportId`，复制附件并写入上报记录，更新台账 `reportIds`，提交 git，然后解析或新建调度会话并投递。投递失败保留存档，工具结果 `delivered` 为 `false` 并带 `reason`。
- 调度会话判定读取 `workspaceRegistry.archivedSessionIds`：桥接 `sessionId` 为空、在归档集合中、或 `resolveAgent` 返回 `session/not-found` 时新建调度会话，新建复用桥接会话的预设、标题、挂载、置顶与状态写入；其他解析错误按未送达处理。没有 `workspaceRoot` 时返回 `no_workspace`，不存档也不新建。
- 投递使用 `sessionController.resolveAgent(sessionId)` 取得 agent，再调用 `agent.steer`。消息采用 `user` 角色，`source.kind` 为 `lark-super-agent`；空闲会话因此被唤醒。
- 投递按工作区一条队列串行，顺序等于存档顺序；新建调度会话单飞，多个上报共享同一个会话。投递失败会重新解析或重建后重试一次。
- `steer` 之后让出两个微任务：会话已空闲且消息仍在 `next-step` 队列时，移除并改为 `followup`，与飞书消息注入共用同一段收尾逻辑（`src/steering.ts`）。上报、失败通知与归档通知都经此投递。
- 注入块含 `sessionid`、`reportid`、`taskid`、`kind` 与 `origin` 属性，以及 `<report_path>`、`<attachment_paths>`、`<unread_reports>` 与 `<instructions>`：路径相对调度工作区根、以 `/` 分隔，报告位于 `reports/<taskId>/<reportId>.md`。块内没有 `desc` 与正文，调度会话自行读取文件。任务结束后报告移到 `archive/<taskId>/reports/`，调度提示词要求读取失败时改读该位置。闭合标签与属性值会转义。
- 未读报告按台账记录汇总：任务台账新增 `deliveredReportIds`，未读为 `reportIds` 减去它。每次投递列出全部任务的未读报告并要求先读任务与报告；新建调度会话额外带 `<task_snapshot>`。投递成功后把列出的报告写进 `deliveredReportIds` 并提交；标记失败只记 `warning`，下次可能重复列出。旧台账按全部已投递初始化。
- git 提交失败只记 `warning`，投递照常执行。
- 自动上报在轮次正常结束、本轮没有调用 `send_report`、会话没有运行中的子代理时触发，来源记为 `turn_end`；未送达只写日志。
- 全局行监听 `reason.kind === 'error'` 的 `turn/end`，每轮失败向调度会话投递一次 `<task_session_failure>`；取消不触发通知。
- 失败通知包含会话、任务标识与截断后的错误原因，不进入上报存档，也不提交 git。
- 提问补投未送达时只写日志，任务保持原状态。
- 成功的 `send_report` 在对话中显示为上报卡片，内容为类型、`desc`、Markdown 正文、附件与 `reportId`：
  - 前端注册 Conversation Definition `lark-report-result`，匹配 `send_report` 的 `tool/call` 与投递成功的 `tool/result`，参数取自 `tool/call` 的 `arguments`。
  - Definition 产出 `lark-report` Chat 节点，`groupTree` 为 `turn`，位于结果之后。节点不进入过程分组，轮次折叠后仍然可见。
  - 卡片注册在 `conversation.chat.node` 的 `lark-report` 键，附件按钮调用宿主 `openFile` 在右侧栏打开。
  - 卡片容器、Markdown 正文、任务简介与附件名使用 `--dsw-alias-label-primary`，与宿主对话正文同色；回执、标签与完整路径保留辅助色。
  - `send_report` 的工具行由宿主默认工具行显示，进行中、失败与中断都沿用它。

## 任务日志

任务日志让调度会话知道用户直接在任务会话 GUI 里做过什么。

- 全局行在 `session/event` 中观察被管理会话：`source.kind` 为 `user` 的 `user/message` 写 `user_message` 条目；`turn/end` 的原因为 `{ kind: 'aborted', reason: { kind: 'user' } }` 且会话不在 `workspaceRegistry.archivedSessionIds` 时写 `user_stop` 条目。
- 宿主归档会话并停止活动时，先写归档集合再以同样的 `{ kind: 'user' }` 取消轮次，所以归档引发的取消按归档集合排除。
- 条目 `id` 是 `<任务会话 id>:<事件 seq>`；追加在工作区串行队列内完成，写前重新读台账确认任务仍未结束，文件内已有同 `id` 则跳过。原文超过 2000 字符时截断并标记 `truncated`。
- 写日志不唤醒调度会话。
- 调度会话每次 `agent/pre-step` 前，插件扫描该会话完整事件日志，取出来源为 `lark-task-log` 的消息里已注入的条目 `id`，只注入还没有的条目，合成一条消息，按时间升序，排在桥接提醒之后、本批第一条 `<lark-message>` 之前。扫描位置缓存在进程内，缓存丢失时从头重建。压缩只改变模型可见表层，事件日志仍在，因此不会重复注入。
- 没有任何注入标记的调度会话视为全新会话：先注入 `<task_snapshot covers_entries="…">`，列出全部未结束任务的标识、标题、状态、工作区、任务会话、最新报告路径与 `<unread_reports>`，并附各任务最新报告之后的日志条目；更早的条目记入 `covers_entries`，视为已覆盖。快照带 `<instructions>`，要求先读任务与未读报告。没有未结束任务时注入空快照，使标记落地。
- 注入消息因请求失败没有写入会话日志时，下一次 pre-step 会再次注入。
- 日志与报告存档、台账互相独立：台账 `task.messages` 记调度会话处理过的用户消息，报告存档只记上报，日志只记调度会话看不到的用户直接交互。

## 生命周期

- 事件子进程退出后按 2 秒起、上限 60 秒的退避重启。
- 插件卸载时终止子进程、注销路由和工具，并清理 Client 订阅与计时器。
- 鉴权失效时停止监听。
- 保存配置、增删工作区不重启监听；工作区失效后的注入按失败处理。

## 依赖

宿主提供的 `@deepseek-ai/*` 保持 external，与运行插件的 DSH 版本一致。`dsh-plugin-meta-tools` 是唯一的运行依赖，随本插件安装，由 `SA-调度会话` 的子行按包名加载。插件不声明 `@larksuite/cli` 依赖，所有调用固定使用本机命令 `lark-cli`。

Windows 一次性命令沿用受约束 shell 与安全参数白名单；macOS 与 Linux 使用 `shell: false`。
