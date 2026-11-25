# Feature Specification: 任务边界与上报规则

**Feature Branch**: `fix/049-task-boundary`

**Created**: 2026-11-25

**Status**: Approved

**Category**: 插件变更

**Input**: User description: 「用户切换为『在电脑前』后工作会话不再汇报，调度会话无法感知之前的结果。调度会话有时把两个独立任务的上下文混在一起。任务结束判定不准：有的不该结束却结束了，有的该结束却一直不结束。」

## Open Decisions

无。

### 探索结论

- 工作会话提示词规定本机模式下普通对话不上报，只上报需求变更、完成与放弃。
- 调度会话提示词只写「work is complete」时结束任务，没有定义完成依据。
- 调度会话按语义区分新任务、进度追问与补充，没有「默认新任务」的硬规则。
- 上报按 `findTaskBySession` 归到该会话最近更新的未归档任务。
- 已完成任务的状态不能再改，`completed` 没有出向转换。

## Clarifications

### Session 2026-11-25

- 讨论阶段：问题 1「本机不上报」与问题 2「任务串扰」只收紧提示词。
- 讨论阶段：问题 3 采用 C1，工作会话报完成即结束并归档，不经用户验收。
- [D-001] Q: 完成信号怎么表达？ -> A: `send_report` 新增必填 `kind`，取值 `progress`、`question`、`completed`、`abandoned`。
- [D-002] Q: 任务状态由谁按 `kind` 更新？ -> A: 调度会话按提示词调用 `task_update`，服务只把 `kind` 透传给调度会话。
- [D-003] Q: 工作会话上报放弃时任务如何处理？ -> A: 与完成相同，标记完成并归档会话，放弃原因随上报转达用户。
- [D-004] Q: 在电脑前时哪些内容要上报？ -> A: 与远程模式相同，另外在正文与用户对话。
- [D-005] Q: 变更类别？ -> A: 插件变更。
- [D-006] Q: 用户引用已结束任务的消息追问时如何处理？ -> A: 新建任务，首条要求只带被引原文与本次追问。
- [D-007] Q: 在电脑前时工作会话已在正文提问并上报，调度会话怎么转达？ -> A: 照常在正文转达完整问题，用户在任一会话作答都可以。

## Review Record

- 2026-11-25 | Decision: Approved | Scope: current full document | Open items: none | Risks: 归类与结束规则依赖模型遵守提示词，需实机验收；引用定位只靠调度会话上下文

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 在电脑前时调度会话仍掌握任务进展 (Priority: P1)

用户在电脑前直接与工作会话对话。工作会话照常向调度会话上报，调度会话的任务笔记保持最新。

**Why this priority**: 调度会话收不到上报时，任务状态停滞，后续追问与结束判定全部失效。

**Independent Test**: 在场状态设为在电脑旁，派发任务，在工作会话正文与其对话直到完成，检查调度会话收到的上报。

**Acceptance Scenarios**:

1. **Given** 在场状态为在电脑旁，**When** 工作会话完成任务，**Then** 它在正文告诉用户结果，并发出 `kind: completed` 的上报。
2. **Given** 在场状态为在电脑旁，**When** 工作会话需要用户决定，**Then** 它在正文提问，并发出 `kind: question` 的上报；调度会话在正文转达完整问题。
3. **Given** 在场状态为在电脑旁，**When** 工作会话达到一个里程碑，**Then** 它发出 `kind: progress` 的上报。
4. **Given** 任务进行中用户切换在场状态，**When** 工作会话之后取得结果，**Then** 上报规则与切换前一致。

---

### User Story 2 - 独立任务互不串扰 (Priority: P1)

用户连续发出两条无关的指令。调度会话为它们分别建任务、分别派发，第二个任务的要求里没有第一个任务的内容。

**Why this priority**: 上下文混入会让工作会话做错事，且错误难以察觉。

**Independent Test**: 先派发任务 A，A 进行中再发一条与 A 无关、也未引用 A 的指令，检查调度会话新建的任务与发给新工作会话的首条要求。

**Acceptance Scenarios**:

1. **Given** 任务 A 进行中，**When** 用户发出未引用、未点名 A 的新指令，**Then** 调度会话新建任务 B，B 的首条要求只含这条指令与目标工作区信息。
2. **Given** 任务 A 进行中，**When** 用户引用属于 A 的消息补充要求，**Then** 补充追加到 A，并发往 A 的工作会话。
3. **Given** 任务 A 进行中，**When** 用户点名 A 的标题或 id 追问进度，**Then** 追问追加到 A，调度会话按笔记回答。
4. **Given** 调度会话无法判断一条消息是否属于已有任务，**When** 它处理该消息，**Then** 它先问用户再行动。
5. **Given** 任务 A 已结束，**When** 用户引用 A 的消息追问，**Then** 调度会话新建任务，首条要求只含被引原文与本次追问。

---

### User Story 3 - 任务按上报类型结束 (Priority: P1)

工作会话上报 `completed` 或 `abandoned` 时，调度会话转达结果、标记完成并归档会话。其他类型的上报不结束任务。

**Why this priority**: 过早结束会停掉仍在工作的会话；不结束会让任务和会话积压。

**Independent Test**: 让工作会话依次发出四种类型的上报，检查任务状态与会话归档。

**Acceptance Scenarios**:

1. **Given** 任务进行中，**When** 工作会话发出 `progress` 上报，**Then** 任务状态为 `in_progress`，工作会话保持运行。
2. **Given** 任务进行中，**When** 工作会话发出 `question` 上报，例如询问「是否提交」，**Then** 任务状态为 `waiting_user`，工作会话保持运行。
3. **Given** 任务进行中，**When** 工作会话发出 `completed` 上报，**Then** 调度会话转达结果，标记任务完成，并归档任务记录的会话。
4. **Given** 任务进行中，**When** 工作会话发出 `abandoned` 上报，**Then** 调度会话转达放弃原因，标记任务完成，并归档任务记录的会话。
5. **Given** 调用 `send_report` 时缺少 `kind` 或取值不合法，**When** 工具执行，**Then** 工具报参数错误，不存档也不投递。

### Edge Cases

- 工作会话同时有结果和待决问题时，上报 `question`，任务保持未完成。
- 用户在工作会话里直接改需求时，工作会话发出 `progress` 上报说明变更，调度会话追加到任务笔记。
- 处于 `waiting_user` 的任务收到 `progress` 上报时，回到 `in_progress`。
- 工作会话失败通知 `<work_session_failure>` 不结束任务，处理方式保持现状。
- 同一会话被用户要求复用于新任务时，上报归属规则保持现状。
- 用户回复调度会话发出的通知时，调度会话按被引通知内容判断所属任务。
- 用户一次发出多条互不相关的指令时，调度会话按指令拆成多个任务。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `send_report` MUST 有必填参数 `kind`，取值为 `progress`、`question`、`completed`、`abandoned`。
- **FR-002**: 投递给调度会话的上报块与上报存档 MUST 带 `kind`。
- **FR-003**: `SA-工作会话` MUST 在两种在场状态下都用 `send_report` 上报里程碑进度、提问、需求变更、完成与放弃。
- **FR-004**: 在场状态 MUST 只决定 `SA-工作会话` 是否另外在正文与用户对话。
- **FR-005**: `SA-调度会话` MUST 按 `kind` 调用 `task_update` 更新状态：
  - `progress` 对应 `in_progress`。
  - `question` 对应 `waiting_user`。
  - `completed` 与 `abandoned` 对应 `completed`，随后按现有流程归档任务记录的会话。
- **FR-006**: `SA-调度会话` MUST 只在 `completed` 或 `abandoned` 上报时结束任务。
- **FR-007**: `SA-调度会话` MUST 把每条用户消息默认归为新任务；只有引用了属于未结束任务的消息，或明确点名未结束任务的标题或 id 时，才归入该任务。
- **FR-008**: `SA-调度会话` 无法判断归属时 MUST 先问用户。
- **FR-009**: `SA-调度会话` 发给新工作会话的首条要求 MUST 只包含本任务的消息与目标工作区信息。
- **FR-010**: 用户引用已结束任务的消息时，`SA-调度会话` MUST 新建任务，首条要求只带被引原文与本次消息。
- **FR-011**: 在电脑旁时，`SA-调度会话` MUST 在正文转达 `question` 上报的完整问题。
- **FR-012**: 提示词、README 与文档 MUST 与新的上报和结束规则一致。

### Key Entities

- **上报**：工作会话经 `send_report` 发给调度会话的消息，含 `kind`、正文与附件。
- **任务**：`message-task-status.json` 中的一条记录，含状态、工作区、会话 id 与用户消息。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在电脑旁完成的任务，调度会话都收到 `completed` 上报。
- **SC-002**: 两个互不引用的指令产生两个任务，第二个任务的首条要求不含第一个任务的内容。
- **SC-003**: 只有 `completed` 或 `abandoned` 上报使任务结束。
- **SC-004**: 缺少或非法 `kind` 的 `send_report` 调用全部被拒绝。
- **SC-005**: 现有测试与新增测试全部通过。

## Assumptions

- 上报仍由 `send_report` 投递，归属仍按 `findTaskBySession` 判定。
- 任务状态取值保持 `in_progress`、`waiting_user`、`failed`、`completed`。
- 服务不按 `kind` 修改任务状态。
- 引用定位只靠调度会话的上下文判断，程序不记录机器人消息 id。
- 提示词规则的执行效果需要实机验收。
