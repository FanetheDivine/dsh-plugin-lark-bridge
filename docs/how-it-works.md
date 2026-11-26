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
| `src/lark-super-agent/` | `lark-super-agent` 行：调度服务、笔记、上报、归档、git、全局在场状态、自动切换调度、节假日数据与状态路由 |
| `src/sa-dispatch/` | `SA-调度会话` 预设子行：调度工具、提示词与在场提醒插入 |
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

参数用 zod 声明，经 `z.toJSONSchema` 转成 JSON Schema 后作为工具声明：`text` 必填，`reply_to` 可选。执行体自行校验参数，失败码为 `invalid-args`、`invalid-text`、`invalid-reply-to`。

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

`lark-super-agent` 全局行声明 `tools` 依赖并提供 `larkSuperAgent` 服务，组合任务台账、上报存档、git 队列、被管理会话能力与消息投递。`sa-dispatch` 预设子行声明 `larkSuperAgent`、`systemPrompt`、`tools` 三项依赖，并通过 `ctx.inject` 注册调度能力；三项缺一不可，否则 Cordis 拒绝读取未声明的服务。全局行停用时，子行的工具与监听随依赖下线，飞书对话与 `lark_notify` 照常工作。

| 预设 | 组成 |
| --- | --- |
| `SA-调度会话` | 标准预设中的 11 个基础工具、meta-tools 十项能力与本插件覆写的 `session_create`、`list_models`、`task_update`、`task_end`、`session_manage`、`session_unmanage`、`workspace_note_set`、`workspace_note_remove` 与调度提示词段 |

- 「被管理」是会话状态，与预设无关：`message-task-status.json` 中某个未结束任务记录的 `sessionId` 即为被管理会话，一个会话最多对应一个任务。
- 被管理会话的能力全部注册在全局行，见[被管理会话能力](#被管理会话能力)。
- meta-tools 是 `SA-调度会话` 的子行，预设补丁关闭它的 `session_create`，其余九项能力开启。`session_create` 由 `sa-dispatch` 子行提供，见「任务会话模型」。
- `SA-调度会话` 用 `ctx.systemPrompt.section` 注册提示词，要求回复只给结论、保持简短。
- 提示词要求调度会话自行回答 DSH 元信息问题（工作区、会话、任务状态），不为这类问题建任务。
- 提示词把用户指令默认理解为交给新建任务会话在工作区执行的独立任务。调度会话自身只在调度工作区读写笔记、任务归档与报告。
- 只有 `workspaces.json` 已登记的工作区可以接收任务。没有匹配或多个都匹配时，调度会话不猜测、不执行，告知「我不知道在哪个工作区」并询问目标。
- 每条用户消息默认是新任务。只有引用了未结束任务的消息，或点名未结束任务的标题或 id，才归入该任务；无法判断时询问用户。
- 用户要接管已有会话时调用 `session_manage`，要停止管理时调用 `session_unmanage`。用户归档会话时任务随之归档。
- 调度会话把用户消息追加到任务后，用 `session_send` 投递到任务会话。
- 调度会话按上报的 `kind` 更新任务：`progress` 设为 `in_progress`，`question` 设为 `waiting_user`。上报不结束任务。
- 调度会话自行判断任务是否完成：判断完成时先询问用户，用户确认后才用 `task_end(completed)` 结束；用户要求结束或取消时直接用 `task_end(cancelled)`。结束任务不归档会话。
- 在场状态见[在场状态](#在场状态)。
- `SA-调度会话` 的提示词按最近的在场提醒选择渠道：离开时经 `lark_notify` 回复与转达，在电脑旁时在正文回复与转达。
- `SA-调度会话` 不含 `tool-jobs`，保留 `persona`、`agent-instructions`、`time-context`、`skill-filesystem` 与压缩组。压缩组的 `compaction-basic` 设 `thresholdRatio: 0.3`，上下文压力到模型窗口 30% 时触发压缩。
- 全局行与预设子行的工具叠加。`lark_notify` 来自本插件主行，其他插件的全局工具也照常可见。

## 被管理会话能力

全局行注册以下能力，作用于所有非调度会话：

| 能力 | 行为 |
| --- | --- |
| `send_report` | 除调度会话外都能看到；未被管理的会话调用报错。描述要求只在被要求时调用 |
| 调度消息标记 | `source.kind` 为 `dsh-plugin-meta-tools` 的消息包进 `<dispatch_session_message>` |
| 提问拦截 | 用户离开时拒绝被管理会话的 `ask_user_question`，并结束正在等待的调用 |
| S 注入 | 提问因离开失败后，在下一次模型请求前插入一条临时指令 |
| 轮次自动上报 | 正常结束、本轮未上报、无运行中子代理时把最后一段文本作为 `progress` 上报 |
| 失败通知 | 轮次以错误结束时投递 `<task_session_failure>` |
| 归档通知 | 被管理会话被归档时归档任务并投递 `<task_session_archived>` |

- 在场提醒只插入调度会话；被管理会话在提问失败前对调度机制无感知。
- 离开期间被管理会话的提问在执行前即被拒绝；其他插件要求审批时同样改为离开错误，不进入审批等待。
- 提问拦截有两种途径：插件加载后开始的提问由 `tools/execute` 换上可中止信号；插件加载前已在等待的提问由网关私有接口取消。网关不可用时只记日志。
- S 是一条临时指令，说明本次无法提问、改用 `send_report` 的 `question`，并要求后续忽略它。同一会话同一时刻只保留一条。
- 自动上报带 `origin="turn_end"`，手动上报带 `origin="send_report"`，调度会话据此区分。

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

## 在场状态

`lark-super-agent` 行持有一份内存中的全局在场状态：`local` 表示在电脑旁，`remote` 表示离开。

- 行启用时状态为 `local`，不写盘。
- 浏览器经 `/lark-bridge/presence` 读取与切换。`webServer` 是该行的可选依赖，就绪后才注册路由。
- 该行注册全局 `agent/pre-step`，在 `next()` 之后观察本批消息：
  - `source.kind === 'user'` 且 `guiInputSetsLocal` 开启时设为 `local`。
  - `source.kind === 'lark-bridge'`、非桥接提醒且 `larkInputSetsRemote` 开启时设为 `remote`。
  - 同批以最后一条可判定消息为准。同一消息对象只观察一次，手动切换与自动更新以发生先后为准。
- 两个开关在行配置中，均为 volatile，默认 `true`，前端为 `dsh-plugin-lark-bridge#lark-super-agent` 注册配置页。
- 手动切换记录 `lastManualAt`；输入更新与自动切换不记录。

### 自动切换时间

行配置的 `presenceAlarms` 是一组闹钟条目，每条含 `id`、`time`、`action`、`enabled`、`skipWeekends`、`skipHolidays`。

- `PresenceScheduler` 每 15 秒判定一次当前 `HH:mm`，命中的启用条目按「日期 + 条目 id」去重后执行一次；同一分钟两种动作并存时以 `remote` 为准。
- 执行前比较 `lastManualAt` 与到点时刻：手动切换晚于到点则跳过本次，手动结果保持到下一个到点。
- 行启用时先补执行当天最近一个已过且未跳过的到点，再开始周期判定；不逐条补执行。
- 到点时刻按宿主本地时间计算，日期与时间都取自本地时钟。

### 节假日数据

`HolidayCalendar` 按年获取 `NateScarlet/holiday-cn` 的年度 JSON，主源 jsDelivr，备源 raw.githubusercontent。

- 缓存文件为 `<DSH_HOME>/lark-bridge/holiday-cache.json`，结构是 `fetchedAt` 加每年「日期到是否放假」的映射。
- 24 小时过期；缺年份或过期时刷新，失败后退避 1 小时；并发刷新合并为一次请求。
- `isOffDay` 为 `true` 表示法定节假日或调休放假，`false` 表示调休上班日：前者在开启跳过节假日时跳过，后者不按周末跳过。
- 没有某年数据时只按星期判断周末；获取失败保留旧缓存并记一条警告，配置页在有条目跳过节假日时显示提示。
- `/lark-bridge/presence` 的回答带 `holidays: { state, fetchedAt }`，`state` 取 `fresh`、`stale` 或 `missing`。

### 配置页的时间选择控件

- 时间选择控件是 ReUI 的 `@reui/time-picker`（shadcn 注册表条目，MIT）移植件，放在 `src/client/ui/time-picker.tsx`，底座是 `@radix-ui/react-popover`。
- 只保留 24 小时制的时、分两列，`value` 直接是 `HH:mm`，与 `PresenceAlarm.time` 同格式。
- 同目录的 `button.tsx`、`input.tsx`、`input-group.tsx`、`popover.tsx` 是 shadcn 源码移植件，`cn.ts` 对应 shadcn 的 `lib/utils`。
- 样式由 Tailwind v4 生成：`src/client/tailwind.css` 只引入 utilities，`@theme inline` 把 shadcn 的语义色映射到 `--dsw-*` 令牌，preflight 不进产物。
- `scripts/build-client-css.mjs` 在 tsdown 之前把 `tailwind.css` 编译成 `src/client/tailwind.generated.css`；`build`、`dev`、`check` 都会先跑它。

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

调度工作区是本插件配置的桥接工作区。全部任务与上报都存放在该目录：

| 路径 | 内容与写入者 |
| --- | --- |
| `message-task-status.json` | 未结束任务；由任务工具与 `session_create` 维护 |
| `workspaces.json` | 工作区笔记与派发白名单；由工作区写工具维护 |
| `reports/<taskId>/<reportId>.md` | 上报正文与元数据；由 `send_report` 与自动上报写入 |
| `reports/<taskId>/<reportId>-<n>-<文件名>.md` | 上报附件副本 |
| `archive/<taskId>/task.json` | 任务全量快照、归档时间与结束原因 |
| `archive/<taskId>/reports/` | 已结束任务的全部上报与附件 |
| `AGENTS.md` | 长期记忆；由调度会话自行维护与提交 |

- `message-task-status.json` 与 `workspaces.json` 用 zod 校验。校验不通过时按空台账处理，下次写入覆盖。
- 任务标题与工作区笔记为单行文本。任务消息正文允许多行。
- 台账校验不通过时，`task_update` 与 `task_end` 报告台账校验失败，不再返回 `task not found`。
- JSON 先写临时文件再重命名，同一工作区的写入与 git 操作串行执行。
- 首次写笔记时，若调度工作区根目录不是 git 仓库顶层，程序执行 `git init`。
- 程序用路径限定的 `git add` 与 `git commit` 提交本次文件，提交作者沿用本机 git 配置。
- 本机需要安装 git，并配置 `user.name` 与 `user.email`。
- `task_end` 把任务移入归档并记录结束原因，同时移动上报目录，再从 `message-task-status.json` 移除该任务。会话保持未归档。
- 结束原因取 `completed`、`cancelled`、`unmanaged`、`session_archived` 或 `session_missing`。

## 上报投递与失败监听

- 服务每次调用从 `$DSH_HOME/lark-bridge/state.json` 读取桥接会话 `sessionId` 与调度工作区 `workspaceRoot`；缺省 `$DSH_HOME` 为 `~/.dsh`。`workspaceRoot` 经 `toHostWorkspacePath` 转为当前平台的原生路径后再访问文件与 git。
- `send_report` 的 `kind` 必填，取值为 `progress` 与 `question`。取值之外报参数错误，不存档也不投递。
- `send_report` 的 `text` 与 `files` 至少提供一项，`files` 为 Markdown 文件路径；`desc` 可选，记录在 front matter 与投递块中。
- 未被管理的会话调用 `send_report` 直接报错，不存档也不投递。
- 上报存档的 front matter 记录 `kind`、`origin`、可选 `desc` 与任务标识。服务不按 `kind` 修改任务状态。
- `send_report` 校验文本与 Markdown 附件，生成 `reportId`，复制附件并写入上报记录，再把 `<task_session_message>` 块投递到调度会话。
- 投递使用 `sessionController.resolveAgent(sessionId)` 取得 agent，再调用 `agent.steer`。消息采用 `user` 角色，`source.kind` 为 `lark-super-agent`；空闲会话因此被唤醒。
- 注入块含 `sessionid`、`reportid`、`taskid`、`kind` 与 `origin`，`<desc>` 仅在提供时出现，`<text>` 与 `<files>` 始终保留。闭合标签与属性值会转义。
- 文件写入并投递后执行 git 提交。提交失败不撤回已投递上报，工具结果附带 `warning`。
- 自动上报在轮次正常结束、本轮没有调用 `send_report`、会话没有运行中的子代理时触发，来源记为 `turn_end`；调度会话不可用时只写日志。
- 全局行监听 `reason.kind === 'error'` 的 `turn/end`，每轮失败向调度会话投递一次 `<task_session_failure>`；取消不触发通知。
- 失败通知包含会话、任务标识与截断后的错误原因，不进入上报存档，也不提交 git。
- 成功的 `send_report` 在对话中显示为上报卡片，内容为类型、`desc`、Markdown 正文、附件与 `reportId`：
  - 前端注册 Conversation Definition `lark-report-result`，匹配 `send_report` 的 `tool/call` 与投递成功的 `tool/result`，参数取自 `tool/call` 的 `arguments`。
  - Definition 产出 `lark-report` Chat 节点，`groupTree` 为 `turn`，位于结果之后。节点不进入过程分组，轮次折叠后仍然可见。
  - 卡片注册在 `conversation.chat.node` 的 `lark-report` 键，附件按钮调用宿主 `openFile` 在右侧栏打开。
  - `send_report` 的工具行由宿主默认工具行显示，进行中、失败与中断都沿用它。

## 生命周期

- 事件子进程退出后按 2 秒起、上限 60 秒的退避重启。
- 插件卸载时终止子进程、注销路由和工具，并清理 Client 订阅与计时器。
- 鉴权失效时停止监听。
- 保存配置、增删工作区不重启监听；工作区失效后的注入按失败处理。

## 依赖

宿主提供的 `@deepseek-ai/*` 保持 external，与运行插件的 DSH 版本一致。`dsh-plugin-meta-tools` 是唯一的运行依赖，随本插件安装，由 `SA-调度会话` 的子行按包名加载。插件不声明 `@larksuite/cli` 依赖，所有调用固定使用本机命令 `lark-cli`。

Windows 一次性命令沿用受约束 shell 与安全参数白名单；macOS 与 Linux 使用 `shell: false`。
