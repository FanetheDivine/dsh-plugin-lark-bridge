# Research: 侧栏在场状态按钮

## R-01 页脚按钮的挂载与样式

**Decision**: 前端注册 `sidebar.footer.action` 槽位，`id` 为 `lark-bridge-presence`，`order: 52`。按钮样式取参考插件 `dsh-plugin-practical-tool-bundle` 的 `restart.tsx` 与 `sweeper.tsx`。

**Rationale**:

- 参考插件的扫帚为 `order: 50`，重启为 `order: 51`，52 落在其后。
- 样式：36×36 圆形、透明底、无边框；图标 18 px，描边 1.8，继承 `currentColor`；悬停底色为 `color-mix(in srgb, <色> 12%, transparent)`。
- 槽位 owner props 为 `SidebarFooterActionOwnerProps`，提供 `wide` 表示侧栏是否展开。
- 侧栏折叠时，参考插件用一段 CSS 把页脚动作改为纵向一列。本插件沿用同一选择器，以 `data-rail` 标记本按钮。

**Alternatives considered**: 放进 `sidebar.toggle.badge`。该槽位只在折叠时显示，且不可交互。

## R-02 按钮随「飞书任务与调度会话」行显示

**Decision**: `lark-super-agent` 行注册 `GET/POST /lark-bridge/presence`。前端每 3 秒读取：

- 回答为本插件 JSON：行启用，挂载按钮。
- 回答不是 JSON：路由未注册，卸载按钮。
- 网络失败：保持现状。

**Rationale**:

- 前端 bundle 挂在主行 `dsh-plugin-lark-bridge` 上，不随子行启停。
- `dsh-host-webserver` 对未注册路径交给 fallback，Web 组合中由 SPA 返回 `index.html`。现有 `callApi` 把这种回答映射为 `invalid-response`。
- 路由随行的 `ctx.effect` 注销，行停用即消失，无需读取 loader。

**Alternatives considered**: 参考插件的做法是主行读取 loader 条目树判断各行状态。它依赖 loader 内部结构与 `FiberState` 序号，本功能只需一行，路由存在与否已足够。

## R-03 状态存放位置

**Decision**: `lark-super-agent` 行的 `SuperAgentService` 持有一个 `PresenceStore`，`sa-dispatch` 子行经 `larkSuperAgent` 服务读取。

**Rationale**:

- 状态全局唯一且只在内存中，规格 FR-006、FR-009。
- 两个配置项属于 `lark-super-agent` 行，行停用时状态、路由与按钮一起下线。
- `sa-dispatch` 已声明 `larkSuperAgent` 依赖。

## R-04 自动更新的观察点

**Decision**: `lark-super-agent` 行注册全局 `agent/pre-step`，在 `next()` 返回后观察 `decision.messages`。`sa-dispatch` 的 `agent/pre-step` 在比较前也调用同一观察函数。观察函数用 `WeakSet` 记录已处理的消息对象，同一条消息只生效一次。

**Rationale**:

- 主行的 `installReminderGuard` 已用全局 `agent/pre-step` 观察所有会话，可行性已验证。
- 两个中间件的嵌套顺序不确定。调度会话自己先观察，保证提醒使用本批消息更新后的状态。
- 判定规则沿用 `src/sa-dispatch/presence.ts`：`source.kind === 'user'` 为 GUI 输入；`source.kind === 'lark-bridge'` 且 `reminder !== true` 为飞书输入。
- 同批多条可判定消息以最后一条为准。

**Alternatives considered**: 监听 `session/event` 的 `user/message`。事件在消息落盘后才触发，调度会话的 `pre-step` 会先读到旧状态。

## R-05 提醒的属性与查找

**Decision**: 提醒 `source` 为 `{ kind: 'sa-presence', form: 'notice', presence: 'local' | 'remote' }`，两个预设共用。查找从 `session.surface.nodes` 末尾向前，取第一条 `user/message` 且 `source.kind === 'sa-dispatch-presence'` 的事件，读 `source.presence`。

**Rationale**:

- 主行 `surfaceHasReminder` 已用 `surface.nodes` 与 `eventAt` 查找表层消息。
- 表层随压缩更新，提醒被压缩移除后会补回。
- 旧版本插入的提醒 `kind` 为 `sa-dispatch-presence`，不匹配新 `kind`，升级后补一条。
- `sa-worker` 的 `agent/pre-step` 已在 `next()` 后改写 `decision.messages`，插入提醒放在包裹调度消息之后。

## R-06 行配置页

**Decision**: 前端为 `dsh-plugin-lark-bridge#lark-super-agent` 注册 `plugins.row.config`，表单取 `ctx.configForms.get('lark-super-agent')`，开关用 `@deepseek-ai/dsh-client-ui-primitives` 的 `Switch`。

**Rationale**:

- 宿主 Plugins 页只为注册了 `plugins.row.config` 的行显示配置入口。
- 主行配置页已用同一套 `SettingsFormModel`，布尔字段以 `'true'`、`'false'` 文本暂存。
- 字段声明为 `.volatile()`，保存后原地生效，不重启行，内存状态得以保留。

## R-07 构建依赖

**Decision**: 新增 devDependency `@deepseek-ai/dsh-client-ui-sidebar@0.2.2-rc.5`，并列入 `minimumReleaseAgeExclude`。

**Rationale**: 槽位声明 `sidebar.footer.action` 与 `SidebarFooterActionOwnerProps` 来自该包，只做 type-only 导入。

## R-08 系统提示词的在场章节

**Decision**: 两份提示词只说明两种位置的处理方式，当前位置以最近一条在场提醒为准。

`SA-调度会话` 的 `## Track where the user is`：

```text
- A system reminder tells you where the user is. Follow the latest one.
- When the user is at the computer, reply in your response body and relay worker communication there. Do not call lark_notify.
- When the user is away, reply and relay worker communication through lark_notify.
- Dispatch every task in both states. Presence only changes how you talk to the user.
```

`SA-工作会话` 的 `## Tell who is talking to you` 改为 `## Follow where the user is`：

```text
- A message wrapped in <dispatch_session_message> comes from the dispatch session. Any other user message comes from the user in the Web GUI.
- A system reminder tells you where the user is. Follow the latest one: at the computer means local mode, away means remote mode.
```

`## Local mode` 删去「Start the report text with the line "用户在电脑前" ...」一句，其余保留。

**Rationale**:

- 规格 FR-006g：提示词不含无提醒时的默认。
- 规格 FR-006c、FR-006h：工作会话只按提醒决定模式，本机模式仍上报变更、完成与放弃。
- 删去调度提示词中「Worker reports and failures never change your presence ...」：状态由全局维护，上报已无法改变它。
