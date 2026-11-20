# Feature Specification: 飞书消息块与回复提醒

**Feature Branch**: `feat/029-lark-message-block`

**Created**: 2026-11-20

**Status**: Approved

**Input**: User description: "1. 插件注入的用户消息改为<lark-message message_id="xx">块
2. 插件要注入一条system-reminder 说明 对于lark-message块是用户远程发送的消息 要通过lark-notify回复用户 用户只能看到这个 多条连续的只回复一次 减少输出的text块要少 因为用户看不到；对于其他用户消息正常回复 不要用lark_notify
3, 2的system-reminder要求表层日志中至少有一条（意思是会话压缩后依旧要有）"

**变更类别**: 插件变更

## Open Decisions

探索结论（来自代码与宿主包）：

- 当前注入：`src/sessions.ts` 用 `reminder()` 把正文包成 `<system-reminder>`，再由 `agent.followup` 投递；正文由 `src/bridge.ts` 的 `formatFeishuReminder` 生成，含发送者、时间与消息 ID。
- 回复工具名是 `lark_notify`（`src/constants.ts` 的 `NOTIFY_TOOL_NAME`）。
- 宿主的表层（surface）由 `system/message`、`user/message`、`developer/message`、`tool/result` 等节点组成。压缩用一个 `user/message` 摘要替换旧区段，被替换的节点留在日志里但不再出现在表层。
- 宿主 `@deepseek-ai/dsh-agent-instructions` 展示了同类做法：插件持有 `<system-reminder>` 用户消息，并在 `agent/pre-step` 发现表层缺失时补回。
- 表层节点 0 是系统提示词，压缩只保护该节点。

待确认决策：

无。全部决策见 `## Clarifications`。

## Clarifications

### Session 2026-11-20

- [D-001] Q: 注入块保留哪些元数据？ -> A: 块内只有正文；时间作为属性；去掉发送者行与消息 ID 行。
- [D-002] Q: 说明性 system-reminder 用什么载体？ -> A: 独立的 `<system-reminder>` 用户消息，表层缺失时补回。
- [D-003] Q: 「多条连续的只回复一次」由谁实现？ -> A: 只写进提醒文本，插件不合并消息。
- [D-004] Q: 「减少输出的 text 块」具体要求？ -> A: 只写进提醒文本，不设硬性块数约束。
- [D-005] Q: 提醒文本语言？ -> A: 中文。
- [D-006] Q: 压缩覆盖提醒后什么时候补回？ -> A: 下一次 `agent/pre-step`。
- [D-007] Q: 旧版本会话恢复时是否立即补提醒？ -> A: 不兼容旧会话，不考虑该场景。
- [D-008] Q: 提醒文本是否固定为常量？ -> A: 固定文本常量；不为文案写测试。
- [D-009] Q: 提醒与块谁先？ -> A: 提醒先于块。
- [D-010] Q: 提醒作用范围？ -> A: 仅插件桥接会话。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: 模型是否遵守提醒只能人工验收（SC-005）；提醒文案不做逐字测试

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 飞书消息以块注入 (Priority: P1)

用户在与机器人的飞书私聊里发消息。桥接会话中出现一个 `<lark-message message_id="…" time="…">` 块，块内是这条消息的正文。

**Why this priority**: 模型需要稳定、可识别的边界，才能把远程消息与其他用户消息区分开。

**Independent Test**: 向机器人发一条文本消息，检查会话中该用户消息的文本内容。

**Acceptance Scenarios**:

1. **Given** 工作区就绪且收到飞书私聊文本消息，**When** 插件注入，**Then** 会话新增一条用户消息，文本是一个 `<lark-message>` 块，`message_id` 与 `time` 属性来自事件，块内只有正文。
2. **Given** 飞书消息没有文本内容，**When** 插件注入，**Then** 块内保留消息类型占位。
3. **Given** 消息正文含 `</lark-message>` 文本，**When** 插件注入，**Then** 块边界仍唯一。

---

### User Story 2 - 回复规则提醒 (Priority: P1)

桥接会话中有一条 `<system-reminder>`，说明飞书消息块是用户远程发送的消息，回复要走 `lark_notify`。

**Why this priority**: 没有这条说明，模型会把远程消息当成本地消息，回复留在会话里，用户看不到。

**Independent Test**: 新建桥接会话并发一条飞书消息，检查该次模型请求包含提醒且覆盖全部规则。

**Acceptance Scenarios**:

1. **Given** 桥接会话收到第一条飞书消息，**When** 构建模型请求，**Then** 请求含一条说明性 `<system-reminder>`，覆盖 FR-008 到 FR-013 的全部规则。
2. **Given** 本地用户在 GUI 中发消息，**When** 模型回复，**Then** 走普通回复，不调用 `lark_notify`。
3. **Given** 用户连续发两条飞书消息，**When** 模型回复，**Then** 只调用一次 `lark_notify`。

---

### User Story 3 - 压缩后仍有提醒 (Priority: P1)

会话压缩后，表层日志中仍至少有一条该提醒。

**Why this priority**: 提醒一旦被压缩摘要覆盖，后续回复就会丢失规则。

**Independent Test**: 对桥接会话执行一次压缩，再发一条飞书消息，检查下一次模型请求的表层含提醒。

**Acceptance Scenarios**:

1. **Given** 表层中的提醒被压缩替换，**When** 下一次 `agent/pre-step` 运行，**Then** 表层重新出现一条提醒。
2. **Given** 表层已有提醒，**When** 连续多次 `agent/pre-step` 运行，**Then** 提醒数量保持一。

---

### Edge Cases

- 同一条飞书消息重复投递时，只注入一次，现有去重行为不变。
- 会话恢复后表层已有提醒时，不重复注入。
- 提醒补回失败时，记录失败并继续处理飞书消息注入。
- 一次请求中同时有待处理的提醒补回与多条飞书消息时，提醒只补一条。
- 旧版本创建的会话不在支持范围。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 注入的用户消息文本 MUST 是一个 `<lark-message message_id="<消息标识>" time="<YYYY-MM-DD HH:mm:ss>">…</lark-message>` 块，时间按 Asia/Shanghai 显示。
- **FR-002**: 该块 MUST NOT 再被 `<system-reminder>` 帧包裹。
- **FR-003**: `message_id` 属性 MUST 使用事件的消息标识；标识缺失时 MUST 使用事件的 `id` 字段。
- **FR-004**: 块内 MUST 只有消息正文；正文为空时 MUST 使用消息类型占位。
- **FR-005**: 块内 MUST NOT 重复发送者行、消息 ID 行或时间行。
- **FR-006**: 正文中出现 `</lark-message>` 时 MUST 转义，保证块边界唯一。
- **FR-007**: 插件 MUST 为桥接会话注入一条中文说明性 `<system-reminder>`。
- **FR-008**: 提醒 MUST 说明 `<lark-message>` 块是用户通过飞书远程发送的消息。
- **FR-009**: 提醒 MUST 要求通过 `lark_notify` 回复，并说明用户只能看到 `lark_notify` 的内容。
- **FR-010**: 提醒 MUST 要求多条连续的飞书消息只回复一次。
- **FR-011**: 提醒 MUST 要求减少输出的 text 块，理由是该用户看不到会话正文。
- **FR-012**: 提醒 MUST NOT 规定硬性的 text 块数量上限。
- **FR-013**: 提醒 MUST 说明其他来源的用户消息按普通方式回复，并且不使用 `lark_notify`。
- **FR-014**: 桥接会话的表层日志中 MUST 至少存在一条该提醒。
- **FR-015**: 表层缺少该提醒时，插件 MUST 在下一次 `agent/pre-step` 补回一条，使其出现在下一次模型请求中。
- **FR-016**: 表层已存在该提醒时，插件 MUST NOT 重复注入。
- **FR-017**: 提醒不变量 MUST 覆盖新建会话、恢复会话与压缩后的会话。
- **FR-018**: 提醒 MUST 只在插件管理的桥接会话中注入。
- **FR-019**: 非飞书来源的用户消息 MUST NOT 触发提醒补注。
- **FR-020**: 同一次模型请求中，提醒 MUST 出现在 `<lark-message>` 块之前。

### Key Entities *(include if feature involves data)*

- **飞书消息块**：注入到会话的远程消息单元，属性带消息标识与时间，内容只有正文。
- **桥接提醒**：固定的中文说明文本，描述块的含义与回复规则。
- **表层日志**：模型可见的会话节点序列，压缩后由摘要与保留尾部组成。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 单元测试断言注入的用户消息文本匹配 `^<lark-message message_id="[^"]+" time="[^"]+">`，且不含 `<system-reminder>`。
- **SC-002**: 单元测试断言提醒消息存在且来源可识别，不对文案内容做逐字断言。
- **SC-003**: 把表层替换为压缩摘要后触发 `agent/pre-step`，表层中该提醒的条数从零变为一。
- **SC-004**: 提醒已存在时连续触发 `agent/pre-step`，表层中该提醒的条数保持一。
- **SC-005**: 真实宿主上连续发两条飞书消息，人工验收只收到一次 `lark_notify` 回复，会话中的正文输出明显减少。

## Assumptions

- 绑定用户与机器人的对话是私聊，发送者固定为绑定用户。
- 压缩由宿主实现，插件只负责补齐提醒。
- 提醒只在插件管理的桥接会话中生效。
- 发布后新建的会话满足提醒不变量；旧版本会话不在支持范围。
- 提醒文本是固定常量，不提供配置项。
- 模型会遵守提醒文本，插件不做强制拦截。
