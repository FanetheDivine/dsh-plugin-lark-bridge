# Feature Specification: 修复多行任务消息导致 task_update 报 task not found

**Feature Branch**: `fix/057-task-message-multiline`

**Created**: 2026-11-26

**Status**: Waived

**Change Category**: 插件变更

**Input**: User description: "调度会话经 session_manage 接管已有会话后，对该任务调用 task_update 均返回 task not found，而台账文件中存在该任务。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

None.

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 调度会话委托直接修复，跳过完整审查。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 接管首条消息含换行的会话 (Priority: P1)

调度会话接管首条用户消息为多行文本的会话后，可对任务调用 `task_update` 与 `task_end`。

**Independent Test**: 接管首条消息含换行的会话，再调用 `task_update` 追加消息、改状态与改标题，均成功。

**Acceptance Scenarios**:

1. **Given** 会话首条用户消息含换行，**When** 调用 `session_manage`，**Then** 台账通过校验，`task_update` 可找到该任务。
2. **Given** 会话标题含换行，**When** 调用 `session_manage`，**Then** 任务标题把换行折叠为空格。
3. **Given** 台账校验不通过，**When** 调用 `task_update` 或 `task_end`，**Then** 返回台账校验失败的错误。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 任务消息正文 MUST 允许多行，且非空。
- **FR-002**: `session_manage` MUST 把会话标题中的换行折叠为空格。
- **FR-003**: 台账校验不通过时，`task_update` 与 `task_end` MUST 报告台账校验失败。

## Success Criteria *(mandatory)*

- **SC-001**: 回归测试覆盖多行首条消息、多行标题与台账校验失败三种情形。

## Root Cause

台账 schema 对消息正文要求单行。`manageSession` 把会话首条用户消息写入任务，多行文本使整个台账校验失败。`readTaskState` 把失败台账按空处理，`task_update` 因此返回 `task not found`。
