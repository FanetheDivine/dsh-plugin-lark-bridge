# Feature Specification: 飞书通知关联会话与跳转

**Feature Branch**: `feat/068-notify-session-link`

**Created**: 2026-11-26

**Status**: Waived

**Input**: User description: "lark_notify 需要 session_id 关联到具体会话。已归档的加特殊标记，未归档的可以点击跳转到会话。"

**Change Category**: 插件变更

## Open Decisions

- 无。会话标识来源与归档状态表现由现有宿主能力确定。

## Clarifications

### Session 2026-11-26

- 原始需求与归档会话日志已恢复。旧会话只完成代码库与宿主能力调研，未生成规格或实现。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: none | Reason: 用户要求自动推进，无需中途确认。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 从通知进入来源会话 (Priority: P1)

用户在 DSH 中查看一次成功的 `lark_notify` 通知，点击通知中的会话入口，进入产生该通知的会话。

**Why this priority**: 会话入口让用户直接回到通知的上下文。

**Independent Test**: 为一次成功通知关联有效的未归档会话，点击入口后选中该会话并展示其内容。

**Acceptance Scenarios**:

1. **Given** 一次成功通知关联有效的未归档会话，**When** 用户查看通知，**Then** 通知显示可操作的会话入口。
2. **Given** 通知显示会话入口，**When** 用户点击入口，**Then** DSH 进入该入口关联的会话。

---

### User Story 2 - 识别已归档的来源会话 (Priority: P2)

用户查看来源会话已归档的通知，通过明确标记识别会话状态，并保留会话标识文字。

**Why this priority**: 归档标记解释入口不可用的原因，并保留追溯信息。

**Independent Test**: 为一次成功通知关联已归档会话，通知显示归档标记和会话标识，且没有可点击入口。

**Acceptance Scenarios**:

1. **Given** 一次成功通知关联已归档会话，**When** 用户查看通知，**Then** 通知显示归档标记和会话标识文字。
2. **Given** 来源会话已归档或已失效，**When** 用户查看通知，**Then** 通知不提供跳转操作。

### Edge Cases

- 历史通知缺少会话标识时只显示通知正文。
- 来源会话已删除或无法查询时按不可跳转状态展示。
- 通知正文包含多段、Unicode 或 Markdown 记号时保持现有正文展示行为。
- 会话状态加载期间显示不可点击的会话标识，状态确定后更新入口。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 每次成功的 `lark_notify` 调用 MUST 关联调用所在的当前会话标识。
- **FR-002**: 会话标识 MUST 由系统从调用上下文取得，调用方无需填写 `session_id` 参数。
- **FR-003**: 通知 MUST 在正文之外展示来源会话标识。
- **FR-004**: 来源会话未归档且有效时，通知 MUST 提供跳转到该会话的入口。
- **FR-005**: 来源会话已归档时，通知 MUST 显示明确的归档标记，并仅展示会话标识文字。
- **FR-006**: 来源会话已删除、无法查询或标识缺失时，通知 MUST 保持正文可读，且不提供无效跳转。
- **FR-007**: 现有通知正文、分段发送与回复行为 MUST 保持不变。

### Key Entities

- **通知**：一次成功的 `lark_notify` 调用，包含正文与来源会话标识。
- **来源会话**：产生通知的 DSH 会话，具有标识与归档状态。
- **会话入口**：有效且未归档的来源会话对应的跳转操作。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% 新生成的成功通知携带调用所在会话的标识。
- **SC-002**: 未归档来源会话的通知入口在 1 次点击内进入对应会话。
- **SC-003**: 已归档来源会话的通知 100% 显示归档标记，且没有跳转操作。
- **SC-004**: 缺少或无法解析来源会话的历史通知继续完整显示正文，现有通知测试全部通过。

## Assumptions

- 当前会话是通知的唯一来源，无需支持跳转到其他会话。
- 已删除或无法查询的会话沿用已归档通知的只读展示方式。
- 会话归档状态由 DSH 宿主提供的会话数据判定。
