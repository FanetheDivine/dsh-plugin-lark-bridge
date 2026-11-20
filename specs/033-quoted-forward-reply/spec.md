# Feature Specification: 引用与聊天记录呈现、精确回复

**Feature Branch**: `feat/033-quoted-forward-reply`

**Created**: 2026-11-21

**Status**: Approved

**Input**: User description: "引用在lark-message内渲染为块<quote>；文本消息 内联 聊天记录放id；一般来说 本地有lark-cli以user身份读聊天记录 没什么问题；lark_notify增加一个回复功能 属性reply_to(message_id) 用来精确回复用户的消息 非必填 这一点加入system-reminder中"

## Open Decisions

探索结论（来自代码与 lark-cli 契约）：

- 事件 `im.message.receive_v1` 除 `content` 外还提供 `reply_to`、`root_id`、`thread_id`；插件目前只用 `content`，未读取 `reply_to`。
- 该事件的 `content` 由 lark-cli 预渲染为可读文本，但不含被引消息正文；被引消息只能按 `reply_to` 用 `im +messages-mget` 读取。
- `merge_forward`（合并转发聊天记录）的正文是占位，形如 `[Merged forward: N messages]`；子消息需按消息 ID 另行读取。
- 本地 lark-cli 可用 bot 身份或 user 身份调用 `im +messages-mget`，返回 `msg_type`、`content`、`sender.name` 与 `reply_to`；`im +messages-reply` 接受 `--message-id`、`--text -`、`--as bot` 与 `--idempotency-key`。
- 现有注入单元是一条飞书事件对应一条 `<lark-message>` 块；块内只有正文，块边界与属性值转义。
- `lark_notify` 目前只接受 `text`，通过 `im +messages-send` 发送到 owner 私聊，并按 15 000 字符分段。
- 桥接提醒 `BRIDGE_REMINDER` 说明块含义与「只调用 lark_notify」的回复规则，由 `agent/pre-step` 在表层缺少时补注。
- README 只有标题、徽章、一句简介与「前置」，没有工具章节；机制归属文档是 `docs/how-it-works.md`。

待确认决策：无，全部决策见 `## Clarifications`。

## Clarifications

### Session 2026-11-21

- [D-001] Q: 读取被引消息用哪个身份？ -> A: user 优先，bot 兜底。
- [D-002] Q: `<lark-message>` 与 `<quote>` 各带哪些属性？ -> A: `<lark-message>` 增加 `reply_to`；`<quote>` 带 `message_id`、`from`、`time`。
- [D-003] Q: 聊天记录在块内怎么呈现？ -> A: `<forwarded_messages message_id="om_…"/>`。
- [D-004] Q: 引用正文长度上限？ -> A: 500 字符，超出标「（已截断）」。
- [D-005] Q: 用户引用一条聊天记录并回复时，`<quote>` 块内容怎么渲染？ -> A: `quote` 内只放 `<forwarded_messages message_id="om_…"/>`，不读取子消息。
- [D-006] Q: `lark_notify` 对 `reply_to` 做多少校验？ -> A: 不校验，直接交给飞书 API。
- [D-007] Q: `reply_to` 交给 API 后发现无法回复时怎么处理？ -> A: 返回 `ok:false` 与错误，不回落为普通发送。
- [D-008] Q: 文本超过单条上限分段发送时，哪些段带回复关系？ -> A: 仅首段。
- [D-009] Q: system-reminder 新增条目是否采纳草稿？ -> A: 采纳读取规则一条，另加三条：
  1. 填入 `reply_to` 可以让你的消息引用该消息。
  2. 回复用户时引用用户的消息以增加准确性。
  3. 用户在移动端远程与你通信，你的回复要简洁，不涉及细节。
  4. `<quote>` 是用户引用的原消息；`<forwarded_messages>` 只给记录 id，需要内容时用 `lark-cli im +messages-mget --as user --message-ids <id>` 读取。
- [D-010] Q: 被引正文从哪里来？ -> A: 按 `reply_to` 用 `im +messages-mget` 读取并内联；8 秒超时，失败时 `quote` 只留 id 与失败说明。
- [D-011] Q: 文档同步范围？ -> A: `CHANGELOG.md` 与 `docs/how-it-works.md` 的消息、通知两节；README 不改。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: README 不改与宪章 III 的用户可见行为同步要求有偏离，需在 plan 记录

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 引用回复保留被引内容 (Priority: P1)

用户在飞书里引用自己早先的一条消息并回复，模型收到本条消息时同时看到被引原文。

**Why this priority**: 引用是用户省略背景的常见方式；缺了被引内容，模型只能猜测或反复追问。

**Independent Test**: 引用一条已知文本消息回复后，检查注入的 `<lark-message>` 块含 `<quote>` 块与被引原文。

**Acceptance Scenarios**:

1. **Given** 用户存在一条文本消息，**When** 用户引用它并回复新内容，**Then** `<quote>` 块包含被引原文与被引消息 ID，且位于回复正文之前。
2. **Given** 被引文本超过 500 字符，**When** 用户引用它并回复，**Then** `<quote>` 正文被截断并标「（已截断）」。
3. **Given** 被引消息是图片或文件，**When** 用户引用它并回复，**Then** `<quote>` 内是类型占位说明。
4. **Given** 被引消息无法读取，**When** 消息注入，**Then** 本条回复正文照常注入，`<quote>` 只含消息 ID 与失败说明。
5. **Given** 用户引用的是机器人自己发送的消息，**When** 用户回复，**Then** `<quote>` 的 `from` 标明来自机器人，并包含该消息正文。
6. **Given** 被引消息本身也是引用回复，**When** 注入，**Then** `<quote>` 只呈现被引消息自身正文，不递归展开更早的消息。

---

### User Story 2 - 通知精确回复用户消息 (Priority: P2)

模型回复用户时，把回复挂在用户发来的那条消息下，用户在飞书中看到明确的引用关系。

**Why this priority**: 用户连续发来多条消息时，只有引用关系能表明模型在回复哪一条。

**Independent Test**: 调用一次带 `reply_to` 的通知，检查飞书私聊中该消息显示为对目标消息的回复。

**Acceptance Scenarios**:

1. **Given** 模型收到一条用户消息，**When** 调用 `lark_notify` 并带上其 message_id 作为 `reply_to`，**Then** 飞书中的通知显示为该消息的回复。
2. **Given** 模型未提供 `reply_to`，**When** 调用 `lark_notify`，**Then** 发送行为与返回结构与现状一致。
3. **Given** 准备发送的文本超过单条上限，**When** 提供 `reply_to`，**Then** 首段显示为回复，其余段为普通消息。
4. **Given** `reply_to` 指向不存在或无权回复的消息，**When** 调用 `lark_notify`，**Then** 返回 `ok:false` 与错误，不发送任何分段。

---

### User Story 3 - 聊天记录只给消息 ID (Priority: P3)

用户转发一段聊天记录给机器人时，注入块只带该记录的 message_id，不展开子消息正文。

**Why this priority**: 聊天记录可能很长；按需读取比一次性展开更省上下文，也不改变注入结构。

**Independent Test**: 转发一段聊天记录后，检查注入块内只有消息 ID 与占位，无子消息正文。

**Acceptance Scenarios**:

1. **Given** 用户转发一段聊天记录，**When** 消息注入，**Then** 块内包含 `<forwarded_messages message_id="om_…"/>`。
2. **Given** 注入块已含聊天记录 ID，**When** 模型需要内容，**Then** 可按 ID 用本地 lark-cli 读取并继续对话。
3. **Given** 聊天记录转发来自机器人不可见的来源，**When** 注入，**Then** 块内仍是 ID 与占位，不出现读取错误。

---

### User Story 4 - 提醒引导精确回复 (Priority: P3)

模型在桥接会话里看到提醒，知道用 `reply_to` 引用用户消息，并知道引用块与聊天记录块怎么读。

**Why this priority**: 提醒是模型唯一可见的规则来源；缺了它，`reply_to` 不会被使用。

**Independent Test**: 桥接会话首个请求的 system-reminder 含 `reply_to` 与读取规则条目。

**Acceptance Scenarios**:

1. **Given** 桥接会话收到第一条飞书消息，**When** 模型发起请求，**Then** 提醒内含 `reply_to` 用途、引用准确性、回复简洁与 ID 读取方式四条。
2. **Given** 表层提醒被压缩覆盖，**When** 下一次模型请求前，**Then** 提醒被补回且内容与当前版本一致。

---

### Edge Cases

- 引用了一条已被撤回或已删除的消息。
- 引用的是聊天记录消息，聊天记录自身只给 ID。
- 引用链有多层：被引消息本身也是引用回复。
- 被引消息属于机器人不在的群聊，user 与 bot 身份都读不到。
- `reply_to` 指向的消息不在当前私聊，或机器人无权回复。
- 通知分段后首段发送成功、后续段失败。
- 引用读取超时，用户仍期待正常回复。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 收到引用回复消息时，`<lark-message>` 块 MUST 在回复正文之前包含一个 `<quote>` 块。
- **FR-002**: `<quote>` MUST 带 `message_id`、`from`、`time` 属性；`from` MUST 区分用户与机器人。
- **FR-003**: `<lark-message>` MUST 在存在引用时带 `reply_to` 属性，取值等于被引消息的 message_id。
- **FR-004**: `<quote>` 正文 MUST 是被引消息的正文；非文本消息 MUST 使用类型占位。
- **FR-005**: `<quote>` 正文 MUST 截断到 500 字符，截断时 MUST 标「（已截断）」。
- **FR-006**: 被引消息本身是引用回复时，`<quote>` MUST 只呈现被引消息自身正文，不递归展开。
- **FR-007**: 被引消息 MUST 用 `im +messages-mget` 读取，身份先用 user，失败再试 bot。
- **FR-008**: 读取 MUST 在 8 秒内结束；超时或失败时 MUST 照常注入本条消息，`<quote>` 只含消息 ID 与失败说明。
- **FR-009**: 聊天记录消息 MUST 只以 `<forwarded_messages message_id="om_…"/>` 呈现，MUST NOT 展开子消息正文。
- **FR-010**: 引用内容与转发内容 MUST 按现有规则转义，并作为数据呈现，不改变块的嵌套边界。
- **FR-011**: `lark_notify` MUST 接受可选参数 `reply_to`，取值为用户消息的 message_id。
- **FR-012**: 提供 `reply_to` 时 MUST 用 `im +messages-reply` 以 bot 身份发送；MUST NOT 预先校验该 ID，可回复性由飞书 API 判定。
- **FR-013**: `reply_to` 无法回复时 MUST 返回 `ok:false` 与错误，MUST NOT 回落为普通发送。
- **FR-014**: 未提供 `reply_to` 时 MUST 保持现有发送行为与返回结构。
- **FR-015**: 分段发送时 MUST 只用首段携带回复关系。
- **FR-016**: 桥接提醒 MUST 加入四条：`reply_to` 引用该消息、回复时引用用户消息提高准确性、移动端回复要简洁不涉及细节、`<quote>` 与 `<forwarded_messages>` 的读取方式。
- **FR-017**: 引用与聊天记录的读取 MUST 不阻塞其他消息注入；失败 MUST 记录日志并降级。
- **FR-018**: 行为变化 MUST 同步 `CHANGELOG.md` 与 `docs/how-it-works.md` 的消息、通知两节。

### Key Entities

- **`<lark-message>` 块**：一条飞书事件的注入单元，含 `message_id`、`time` 与可选的 `reply_to`。
- **`<quote>` 块**：引用回复中被引消息的呈现，含 `message_id`、`from`、`time` 与截断后的正文。
- **`<forwarded_messages/>`**：聊天记录消息的呈现，只含容器消息的 `message_id`。
- **`reply_to` 参数**：`lark_notify` 的可选参数，指定要回复的用户消息。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 引用回复注入后，模型在第一轮即可说出被引原文的要点，无需额外工具调用。
- **SC-002**: 带 `reply_to` 的通知在飞书中显示为目标消息的回复，引用关系可见。
- **SC-003**: 聊天记录注入后，块内不出现任何子消息正文。
- **SC-004**: 引用读取失败或超时时，消息仍在本次注入内送达，会话不中断。
- **SC-005**: 一条飞书事件仍只产生一条会话消息；去重窗口与注入路径不变。
- **SC-006**: 桥接会话首个请求的提醒包含 `reply_to` 与读取规则条目。

## Assumptions

- 仅处理 owner 私聊；群聊与话题消息不在范围。
- 转发单条消息在事件中与原消息同构，插件不区分、不标注。
- 引用内容总是内联，即使被引消息已出现在会话历史中。
- 被引消息通过本机 lark-cli 读取，不新增网络依赖。
- 引用块与聊天记录块都属于 `<lark-message>` 块内部，不新增独立的会话消息。
- 飞书事件不含被引消息正文，读取是呈现引用内容的唯一途径。