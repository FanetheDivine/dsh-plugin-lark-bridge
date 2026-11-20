# 技术研究

## 1. 工作区配置标识

**Decision**: 保留 `workspaceRoot` 路径配置，插件内部统一使用 Linux 风格路径。Windows `C:\work\demo`、`C:/work/demo` 归一化为 `/c/work/demo`，select 保存归一化后的值。

**Rationale**: 现有配置、会话状态和恢复逻辑都使用路径。统一形式消除 Windows 斜杠和盘符大小写差异，避免前端把同一注册目录误判为失效。`src/workspace-path.ts` 集中提供归一化、比较与 Host 原生路径转换；后端通过 `resolveByPath` 按注册关系验证，目录存在不能替代注册。

**Alternatives Considered**: 新增 `workspaceId` 配置。它能直接调用 `registry.get`，但需要处理旧 `workspaceRoot` 的迁移、表单默认值和会话路径映射，本次不扩大配置变更。直接保存宿主原生路径会保留 U1 的格式差异，不采用。

### Host 边界转换

- 配置读取、前端表单、select 值与标签、状态文件统一使用归一化路径。
- Windows 上 `/c/work/demo` 转回 `C:/work/demo` 后再调用 `workspaceRegistry.resolveByPath`、目录访问和会话创建。
- POSIX 路径保持原义；盘符转换只在 Windows Host 执行。
- Windows 路径比较忽略大小写，POSIX 路径比较保持大小写敏感。
- 归一化不解析符号链接；注册关系的权威判定仍由 Host `resolveByPath` 完成。

## 2. 浏览器工作区列表

**Decision**: 使用全局标准 props 的 `useWorkspaces(selector)`，直接读取 `WorkspaceView[]`；新增 `@deepseek-ai/dsh-client-ui-workspace@0.2.2-rc.3` 的显式类型与 Client inject 声明。

**Rationale**: Workspace UI 将 `ctx.workspaces.list` 注入所有 root slot 的标准 props，注册删除通过快照失效和 `remove` 流实时反映。直接依赖拥有该声明的包，避免借用 conversation 的传递类型。

**Alternatives Considered**: 另行封装 `ctx.workspaces.list` 的 Client store。它会产生第二份订阅与状态，不符合最小实现。

### 字段与有效性

- 浏览器行字段：`workspaceId`、`path`、`title`、`sessionIds`。
- 选项值使用 `path`，标签使用 `title` 与 `path`。
- 保存时列表中的值已由宿主提供，任意文本输入无效。
- 注册列表为空时 select 禁用并显示空状态。

## 3. 选择组件

**Decision**: 使用原生 `select`，样式只使用宿主主题变量。

**Rationale**: `dsh-client-ui-primitives` 的公开入口没有 `Select`；包内未公开的 `ConfigField` 也不能作为稳定公共 API。原生元素满足单选、禁用、空状态、键盘与辅助技术语义。

**Alternatives Considered**: 引入组件库或引用包内私有路径。两者都会增加无必要的运行时或版本耦合。

## 4. 鉴权状态模型

**Decision**: 用三个独立 `ConnectionState` 替代串行 `AuthStage`，完整检测固定使用 `lark-cli auth status --json --verify`。

**Rationale**: 当前命令一次返回 bot 与 user，可以独立投影状态。旧四阶段会在 bot 未就绪时丢失 user 状态，也会在首次检测完成前误显示 `cli-missing`。`--verify` 符合规格的完整检测定义。

**Alternatives Considered**: 为 bot 与 user 分别执行 CLI 命令。宿主 CLI 已提供同一状态响应，重复调用只增加延迟。

### 状态映射

| 条件 | CLI | bot | user | 整体 ready |
| --- | --- | --- | --- | --- |
| 尚未完成首次检测 | checking | checking | checking | false |
| `lark-cli --version` 无法启动 | disconnected | disconnected | disconnected | false |
| `auth status` 执行失败 | connected | disconnected | disconnected | false |
| bot 非 ready，user 有 open_id | connected | disconnected | connected | false |
| bot ready，user 无 open_id | connected | connected | disconnected | false |
| bot ready，user 有 open_id | connected | connected | connected | true |

`AuthManager` 内部保留诊断与 owner open_id，浏览器投影删除这些信息。并发完整检测共享同一 Promise，三个检测按钮无需各自实现状态机。

## 5. 授权生命周期

**Decision**: 删除设备码授权 Host 方法、后台轮询、路由与浏览器 API。

**Rationale**: 用户已明确在终端自行执行三条命令。保留授权路由会提供绕过新界面的入口，也需要继续维护不再使用的取消与竞态逻辑。

**Alternatives Considered**: 只隐藏按钮并保留路由。功能冗余且不符合精简流程。

## 6. 浏览器路由

**Decision**: 只保留 `GET /lark-bridge/status` 与 `POST /lark-bridge/check`，统一返回安全状态投影。

**Rationale**: 状态轮询不能触发外部命令；手动与自动完整检测共用 POST。删除会话字段与诊断字段后，界面数据源与「只展示笼统状态」一致。

**Alternatives Considered**: 保留详细字段但不在组件渲染。响应仍会把敏感诊断暴露给浏览器，不采用。

## 7. 共用表单与弹窗

**Decision**: 配置页和 `shell.overlay` 共享同一个 `PluginConfigForm`；表单只保留 `workspaceRoot`。

**Rationale**: 两处编辑同一配置，单一草稿可避免各自保存后覆盖对方。宿主配置表单已经处理 volatile 写入、只读与 override 状态。两个槽位都是 root scope，均能通过 `PropsRuntime` 接收 `useWorkspaces`。

`SettingsFormActions.save()` 对外返回 `void`，内部异步保存通过共享快照的 `saving`、`dirty`、`failed` 投影结果。弹窗的选择事件只调用 `edit`；显式保存按钮调用 `save`，保存前按最新列表复核路径。`writable=false` 时禁用配置操作，`overridden=true` 仍可编辑并提供恢复默认。

**Alternatives Considered**: 弹窗新增专用保存路由。它会绕过宿主配置表单及其权限处理。选择即保存容易产生误选，P-D001 已选择显式保存。

## 8. 固定标题与归档

**Decision**: 从运行时配置删除 `sessionTitle`，`SessionManager` 直接使用固定常量；删除重置入口，保留现有恢复失败即新建的逻辑。

**Rationale**: 现有 `syncMeta` 能在复用时同步固定标题；归档会话无法恢复时已经会创建新会话，无需额外重置状态。

**Alternatives Considered**: 保留标题配置或主动删除会话记录。两者都不符合已批准规格。

## 9. 验证策略

**Decision**: 单元测试覆盖状态组合和注册生命周期，React SSR 覆盖安全文案与共用组件，真实宿主覆盖动态工作区和飞书链路，最后执行一次 UI/UX 子代理审查。

**Rationale**: 纯 SSR 无法验证宿主标准 props、注册删除事件和真实事件消费者；实机验证可覆盖这些集成边界。

**Alternatives Considered**: 只运行现有模板实机脚本。脚本面向 `demo_echo` 示例插件，不能覆盖本插件的新状态与工作区流程。

## 10. Host 工作区删除同步

**Decision**: 监听通用 `domain/changed`，筛选 `domain === 'workspace'`、`table === 'workspaces'` 与 `operation === 'deleted'`。目标 id 命中缓存的当前工作区时，先同步调用 `bridge.stop()`，再执行统一 `reconcile()`。

**Rationale**: WorkspaceRegistry 没有专用生命周期事件或 Host subscribe。`domain/changed` 在实体从注册表删除后同步发出，此时 `registry.get(id)` 已返回 undefined。先等待 `resolveByPath` 会留下继续接收事件的窗口。

**Alternatives Considered**: 只在浏览器观察 `remove`，或定期轮询注册表。GUI 关闭时无法工作，轮询也会增加延迟。

### 统一 reconcile

三个入口调用同一协调逻辑：

1. `AuthManager.onChange`：未就绪先同步停止。
2. `loader/volatile-update`：配置已提交，先停止旧工作区监听，再解析新值，同时触发完整鉴权检测。
3. 目标工作区删除：同步失效并停止，再重新解析。

每次异步解析递增 generation，只有最新结果可以启动事件桥。无关 domain、table 或 workspace id 不影响当前监听。配置有效且鉴权已就绪时，volatile 保存后立即 reconcile，无需等待鉴权命令再次完成。

新增 `@deepseek-ai/dsh-storage-domain@0.2.2-rc.3` 的纯类型依赖，获取 `domain/changed` 的事件声明；运行时使用宿主同一服务实例。

### 注入竞争

`SessionManager` 只调用 `resolveByPath`，把返回的 Workspace 用于挂载 Session；undefined 时抛错。最终 `agent.followup()` 前再次解析，覆盖首次校验后发生的删除。任何注入路径都不调用 `registry.create()`。