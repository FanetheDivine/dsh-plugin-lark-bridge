# Feature Specification: send_report completed 取值说明

**Feature Branch**: `docs/052-report-completed-hint`

**Created**: 2026-11-25

**Status**: Approved

**Input**: User description: "对 send_report 的 kind：completed 增加描述 这是一个非常重要的值 确保在用户没有后续指示 或对当前结果没有疑问的情况下 再以这个进行汇报"

## Open Decisions

无。

## Clarifications

### Session 2026-11-25

- [D-001] Q: 改动范围 -> A: 只改 `send_report` 工具 `kind` 参数的 description，`SA-工作会话` 提示词保持不变。
- [D-002] Q: 描述内容 -> A: `completed` 条目标明是非常重要的值，并给出使用前提；另加一条「平常的汇报用 `progress` 即可」。措辞沿用现有英文，由完整规格审查确认。
- [D-003] Q: 是否加测试断言 -> A: 不加。

## Review Record

- 2026-11-25 | Decision: Approved | Scope: current full document | Open items: none | Risks: none。用户同时免除 plan 与 tasks 阶段，直接实现。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 工作会话谨慎使用 completed (Priority: P1)

工作会话读取 `send_report` 的 `kind` 说明时，得知 `completed` 是极其重要的取值。工作会话仅在用户没有后续指示、也对当前结果没有疑问时，才以 `completed` 汇报。

**Why this priority**: `completed` 会让调度会话结束任务并归档工作会话。过早上报会中断用户仍在进行的沟通。

**Independent Test**: 读取 `send_report` 工具定义，`kind` 参数描述包含「非常重要」「用户无后续指示」「用户对结果无疑问」「平常的汇报用 progress」四个要点。

**Acceptance Scenarios**:

1. **Given** 工作会话加载 `send_report` 定义，**When** 读取 `kind` 的描述，**Then** `completed` 条目标明该值非常重要，并给出使用前提。
2. **Given** 用户对结果仍有疑问或有后续指示，**When** 工作会话选择 `kind`，**Then** 描述引导其使用 `progress` 或 `question`。

### Edge Cases

- 描述变长后，`progress`、`question`、`abandoned` 的原有语义保持不变。
- 参数校验、`REPORT_KINDS` 取值与调度会话处理逻辑保持不变。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `send_report` 的 `kind` 描述 MUST 标明 `completed` 是非常重要的值。
- **FR-002**: `kind` 描述 MUST 说明仅当用户没有后续指示、且对当前结果没有疑问时才使用 `completed`。
- **FR-003**: `kind` 描述中 `progress`、`question`、`abandoned` 的语义与「只有 completed 与 abandoned 结束任务」的说明 MUST 保持。
- **FR-004**: `kind` 描述 MUST 另有一条说明：平常的汇报使用 `progress`。
- **FR-005**: `kind` 的枚举取值、校验与上报流程 MUST 保持不变。

### Key Entities

- **send_report.kind**: 上报类型，取值 `progress`、`question`、`completed`、`abandoned`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `send_report` 工具定义的 `kind` 描述包含 FR-001、FR-002 与 FR-004 的全部要点。
- **SC-002**: 现有测试全部通过，`pnpm run check` 无新增问题。

## Assumptions

- 改动面向工作会话的模型读者，描述沿用现有英文。
- `SA-工作会话` 提示词与测试保持不变。

## 描述草案

```text
progress: a milestone or a requirement change. question: a decision the user must make. completed: the task is done. This is a very important value: send it only when the user has no follow-up instructions and no doubts about the current result. abandoned: the task is given up. Only completed and abandoned end the task. Use progress for routine reports.
```
