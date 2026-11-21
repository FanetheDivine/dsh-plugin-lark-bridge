# Feature Specification: 通知工具限定在桥接会话

**Feature Branch**: `fix/035-notify-tool-scope`

**Created**: 2026-11-21

**Status**: Approved

**Input**: User description: "总是会注入 lark_notify 这与需求不符 我希望只在实际的调度会话注入"

## Open Decisions

探索结论（来自代码与宿主工具包）：

- `buildNotifyTool` 在 `apply` 中用 `ctx.tools.register(notifyTool)` 全局注册，全部会话可见。
- 宿主 `ctx.tools.register` 接受 `{ when }` 条件；条件为 false 时该工具同时从声明与执行中排除。
- 桥接会话由状态文件 `sessionId` 判定，`SessionManager.isBridgeSession` 已实现该判定，提醒补注也用它。
- 状态文件缺失或损坏时 `StateStore.load` 返回空状态，判定结果为无桥接会话。

无未决项。

## Clarifications

### Session 2026-11-21

- [D-001] Q: 用户所说的「实际调度会话」指哪一种会话？ -> A: 桥接会话，即状态文件记录、承载飞书消息注入的会话。
- [D-002] Q: 桥接会话尚不存在时（新装、首次飞书消息之前、恢复失败），工具是否在全部会话不可见？ -> A: 是，全部不可见。
- [D-003] Q: 桥接会话派生的子代理子会话是否可见该工具？ -> A: 不可见，只有桥接会话本身可见。
- [D-004] Q: 桥接会话里由 GUI 普通输入触发的步骤是否仍允许调用该工具？ -> A: 允许。工具是否可用只取决于会话本身。
- [D-005] Q: 桥接会话的建立时机？ -> A: 保持现状，收到第一条飞书消息时创建并记录会话标识。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 首次飞书消息之前与桥接会话恢复失败期间全部会话都没有该工具；由 GUI 输入触发的桥接会话步骤也能调用

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 桥接会话照常回复飞书 (Priority: P1)

用户向机器人发私聊消息，插件把消息注入桥接会话。该会话里的模型能看到 `lark_notify`，调用后用户收到 bot 私聊回复。

**Why this priority**: 这是插件的主链路，限定可见性后必须保持可用。

**Independent Test**: 让状态文件指向一个可用会话，投递一条 owner 私聊消息，检查该会话的工具列表含 `lark_notify`，调用后用户收到消息。

**Acceptance Scenarios**:

1. **Given** 状态文件指向可用桥接会话，**When** 该会话开始新的一步，**Then** 模型可用的工具包含 `lark_notify`。
2. **Given** 桥接会话中的模型调用 `lark_notify`，**When** 参数合法且鉴权就绪，**Then** 已绑定用户收到 bot 私聊消息。
3. **Given** 桥接会话里的本轮消息来自 GUI 输入，**When** 该会话开始新的一步，**Then** 模型仍可调用 `lark_notify`。

---

### User Story 2 - 其他会话不出现通知工具 (Priority: P1)

用户在同一个桥接工作区或其他工作区新建普通会话，或者在 DSH 界面里继续一个与飞书无关的会话。这些会话的模型看不到 `lark_notify`。

**Why this priority**: 用户当前的困扰是工具出现在全部会话，分散模型选择并可能造成误发。

**Independent Test**: 在非桥接会话里发起一步，检查工具列表不含 `lark_notify`，模型无法选择该工具。

**Acceptance Scenarios**:

1. **Given** 一个非桥接会话，**When** 它开始新的一步，**Then** 该步的可用工具与工具声明都不含 `lark_notify`。
2. **Given** 非桥接会话的模型尝试调用 `lark_notify`，**When** 调用到达宿主，**Then** 插件不发送任何飞书消息，调用以工具不可用结束。

---

### User Story 3 - 桥接会话更换后可见性跟随 (Priority: P2)

桥接会话被归档后，插件收到新消息并新建会话。新会话接管回复，旧会话不再显示该工具。

**Why this priority**: 可见性必须跟随当前注入目标，否则会出现两个会话都能发通知。

**Independent Test**: 让状态文件先指向会话 A，再把状态文件改为会话 B，检查两边的工具可见性。

**Acceptance Scenarios**:

1. **Given** 状态文件从会话 A 改为会话 B，**When** 会话 A 与 B 各开始一步，**Then** 只有 B 可用 `lark_notify`。
2. **Given** 插件重载，**When** 桥接会话开始一步，**Then** 可见性仍按当前状态文件判定。

---

### Edge Cases

- 首次安装、尚未收到任何飞书消息时，全部会话都看不到 `lark_notify`。
- 桥接会话派生的子代理子会话看不到 `lark_notify`。
- 桥接工作区配置改动后，状态文件指向的会话仍是唯一可见该工具的会话。
- 会话被归档或删除后，插件在收到下一条消息前不会产生可见该工具的会话。
- 桥接会话恢复失败时，工具在全部会话不可见，直到新建会话成功。
- 状态文件读取失败或内容损坏时，按无桥接会话处理。
- 通过批量调用或程序化调用绕过声明引用 `lark_notify` 时，同样不发送飞书消息。
- 插件卸载后，工具随之消失。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `lark_notify` MUST 只对桥接会话的模型步骤可见。
- **FR-002**: 非桥接会话 MUST 既看不到工具声明，也无法执行该工具；桥接会话派生的子代理子会话按非桥接会话处理。
- **FR-003**: 可见性 MUST 在每一步按当前桥接会话判定，只由会话身份决定，不缓存注册时刻的结果。
- **FR-004**: 状态文件没有会话标识、会话不可用或读取失败时，工具 MUST 在任何会话都不可见。
- **FR-005**: 可见性判定 MUST 与桥接提醒共用同一桥接会话定义，避免两处结论不一致。
- **FR-006**: 非桥接会话发起的 `lark_notify` 调用 MUST 不产生任何飞书请求。
- **FR-007**: 工具在桥接会话中的参数、发送、拆分与错误返回 MUST 保持现状。
- **FR-008**: 插件卸载时 MUST 注销工具。

### Key Entities

- **桥接会话**：状态文件 `sessionId` 记录的会话，飞书消息注入的目标。
- **桥接状态文件**：会话标识、工作区路径、标题与去重窗口。
- **目标会话集合**：当前唯一可见 `lark_notify` 的会话，成员由状态文件决定。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 桥接会话中的模型在任意一步都能看到 `lark_notify`，调用后 10 秒内用户收到消息。
- **SC-002**: 非桥接会话的每一步工具声明都不含 `lark_notify`，检查 10 个会话全部一致。
- **SC-003**: 状态文件切换会话后，旧会话与新会话的下一次模型请求分别表现为不可见与可见。
- **SC-004**: 非桥接会话发起的调用产生 0 次飞书请求。

## Assumptions

- 插件只服务一个已绑定用户与一个桥接工作区，桥接会话由状态文件唯一确定。
- 桥接会话在收到第一条飞书消息时创建，插件启动时不预建会话。
- 宿主按步骤解析工具可用性，插件的判定只读状态文件，不修改宿主工具注册表。
- 飞书消息注入、提醒补注与发送实现保持不变。
