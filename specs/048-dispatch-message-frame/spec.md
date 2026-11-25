# Feature Specification: 调度消息去掉 system-reminder 嵌套

**Feature Branch**: `fix/048-dispatch-message-frame`

**Created**: 2026-11-25

**Status**: Approved

**Category**: 插件变更

**Input**: User description: 「`<dispatch_session_message>` 里还包了一个 `<system-reminder>`，确定更改。」

## Open Decisions

无。

### 探索结论

- 变更类别为插件变更。`tests/sa-worker.test.ts` 明确断言了当前的双层结构，现有实现符合原设计。
- meta-tools 0.1.7 的 `session_send` 生成一个文本块，内容为 `<system-reminder>\n正文\n</system-reminder>`，正文已去首尾空白，闭标签转义为 `<\/system-reminder>`。
- `session_create` 首条任务是一个不带帧的文本块。

## Clarifications

### Session 2026-11-25

- [D-001] Q: 内层 `<system-reminder>` 如何处理？ -> A: 剥掉这层帧，只保留正文，并还原正文中被转义的 `<\/system-reminder>`。
- [D-002] Q: 什么情况下剥离？ -> A: 消息只有一个文本块，且该文本恰好是一个完整的 `<system-reminder>` 帧时剥离；其他情况原样包装。
- [D-004] Q: 调度模型把飞书原文的 `<lark-message>`、`<quote>` 块贴进 `session_send` 时是否处理？ -> A: 不处理，正文内容由调度会话决定。
## Review Record

- 2026-11-25 | Decision: Approved | Scope: current full document | Open items: none | Risks: 依赖 meta-tools 0.1.7 的帧格式；调度模型贴入飞书原文块时仍有内容级嵌套

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 工作会话收到单层调度消息 (Priority: P1)

调度会话经 `session_send` 给 `SA-工作会话` 发消息时，工作会话看到的是一层 `<dispatch_session_message>`，里面直接是正文。

**Why this priority**: 双层标记增加噪声，且与首条任务格式不一致。

**Independent Test**: 构造 `dsh-plugin-meta-tools` 来源、正文为 `<system-reminder>` 帧的消息，经工作会话的 `agent/pre-step` 处理后检查文本。

**Acceptance Scenarios**:

1. **Given** 一条 `dsh-plugin-meta-tools` 来源、文本为 `<system-reminder>\n继续\n</system-reminder>` 的消息，**When** 工作会话处理该消息，**Then** 模型收到 `<dispatch_session_message>\n继续\n</dispatch_session_message>`。
2. **Given** `session_create` 发出的首条任务，**When** 工作会话处理该消息，**Then** 格式与场景 1 相同。

---

### User Story 2 - 其他消息不受影响 (Priority: P2)

本机消息、其他插件来源的消息与已包装的消息保持原样。

**Independent Test**: 分别传入 `user`、其他来源与已包装消息，检查结果。

**Acceptance Scenarios**:

1. **Given** `user` 来源消息，**When** 工作会话处理，**Then** 消息不变。
2. **Given** 已带 `<dispatch_session_message>` 开标签的消息，**When** 工作会话处理，**Then** 消息不变。

### Edge Cases

- 正文含转义的 `<\/system-reminder>` 时，剥离后还原为 `</system-reminder>`。
- 正文只有部分是 `<system-reminder>` 帧时，原样包装。
- 消息含多个内容块或非文本块时，原样包装。
- 剥离后的正文含 `</dispatch_session_message>` 时，仍按现有规则转义。
- 正文里的 `<lark-message>`、`<quote>` 等其他块保持原样。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `SA-工作会话` MUST 把 `dsh-plugin-meta-tools` 来源的消息包装为单层 `<dispatch_session_message>`。
- **FR-002**: 消息只有一个文本块且该文本恰好是一个完整的 `<system-reminder>` 帧时，包装前 MUST 去掉该帧并还原正文中的转义闭标签。
- **FR-003**: 消息含多个内容块、含非文本块或文本不构成完整帧时，MUST 原样包装。
- **FR-004**: 包装 MUST 保留原消息 id 与 `source`。
- **FR-005**: 其他来源与已包装的消息 MUST 保持原样。
- **FR-006**: `SA-工作会话` 提示词与文档 MUST 与新的消息格式一致。

### Key Entities

- **调度消息**：`source.kind` 为 `dsh-plugin-meta-tools` 的用户消息，来自 `session_create` 首条任务或 `session_send`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `session_send` 发出的调度消息在工作会话中只有一层 XML 帧。
- **SC-002**: `session_create` 首条任务与 `session_send` 消息的帧结构相同。
- **SC-003**: 现有本机消息、其他来源消息相关测试全部通过。

## Assumptions

- meta-tools `session_send` 的帧格式保持 `<system-reminder>\n正文\n</system-reminder>`，正文中的闭标签转义为 `<\/system-reminder>`。
- GUI 上仍显示 `<dispatch_session_message>` 标签，已列入 known-risks。
