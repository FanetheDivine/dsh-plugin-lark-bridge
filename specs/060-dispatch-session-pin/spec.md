# Feature Specification: 调度提示词规定任务会话的置顶与归档

**Feature Branch**: `fix/060-dispatch-session-pin`

**Created**: 2026-11-26

**Status**: Approved

**Change Category**: 缺陷修复

**Input**: User description: "调度会话的提示词没有要求在创建任务会话或把现有会话纳入管理之后置顶该会话，session_pin 能力未规定何时使用。任务结束时会话归档，取消管理不归档。只改提示词。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- Q: 任务结束时会话是否归档？ → A: 任务结束时要求归档会话；取消管理时不归档。
- Q: 改动范围是否包含代码逻辑？ → A: 只改提示词。
- [D-001] Q: `session_unmanage` 之后是否取消该会话的置顶？ → A: 保持置顶。
- [D-002] Q: 以 `cancelled` 结束的任务是否同样归档会话？ → A: 同样归档。
- [D-003] Q: 归档仍在运行的会话用哪种方式？ → A: `session_archive` 传 `stop_activity: true`。
- [D-004] Q: 置顶或归档失败时提示词要求如何回应？ → A: 在同一回复中说明失败并继续。
- [D-005] Q: `task_end` 与 `session_unmanage` 的工具描述是否同步调整？ → A: 只删除与新规则冲突的政策措辞，保留行为事实。
- [D-006] Q: 文档更新范围？ → A: `docs/how-it-works.md` 与 `CHANGELOG.md`。
- [D-007] Q: 用户手动取消置顶后，调度会话的后续操作是否重新置顶？ → A: 不重新置顶；用户明确要求时再调用 `session_pin`。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 置顶与归档只能由提示词约束，插件没有代码兜底

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新建任务会话后置顶 (Priority: P1)

用户在飞书派发任务，调度会话用 `session_create` 建出任务会话后置顶该会话，用户在会话列表顶部即可看到正在执行的任务。

**Why this priority**: 派发是主要入口，新建的任务会话不置顶时容易与其他会话混在一起。

**Independent Test**: 在真实宿主上派发一个任务，检查新会话出现在置顶区。

**Acceptance Scenarios**:

1. **Given** 调度会话收到一条新任务请求，**When** `session_create` 成功返回会话 id，**Then** 调度会话对同一会话执行 `session_pin` 后才算完成派发。
2. **Given** `session_pin` 返回失败，**When** 调度会话回复用户，**Then** 回复中说明置顶失败，任务照常执行。

---

### User Story 2 - 接管已有会话后置顶 (Priority: P2)

用户给出现有会话 id，调度会话用 `session_manage` 把它纳入管理后置顶该会话。

**Why this priority**: 接管路径与派发路径同样产生被管理任务，行为需要一致。

**Independent Test**: 用 `session_manage` 接管一个未置顶的会话，检查它出现在置顶区。

**Acceptance Scenarios**:

1. **Given** 用户要求接管一个已有会话，**When** `session_manage` 成功返回，**Then** 调度会话对同一会话执行 `session_pin`。
2. **Given** 该会话已被置顶，**When** 调度会话再次置顶，**Then** 调用成功且置顶结果不变。

---

### User Story 3 - 任务结束时归档会话，取消管理时不归档 (Priority: P3)

任务结束时调度会话归档该任务的会话，会话从常规列表移出；用户取消管理时会话保留在原处并保持置顶。

**Why this priority**: 结束的任务会话继续占据列表；归档让列表回到只有进行中任务的状态。

**Independent Test**: 分别结束一个任务与取消管理一个会话，检查前者进入归档列表、后者仍在常规列表且保持置顶。

**Acceptance Scenarios**:

1. **Given** 用户确认任务完成或要求取消任务，**When** 调度会话调用 `task_end` 成功，**Then** 调度会话接着以 `stop_activity: true` 归档该任务的会话。
2. **Given** 用户要求停止管理一个会话，**When** `session_unmanage` 成功返回，**Then** 该会话不进入归档列表，置顶保留。
3. **Given** 会话仍有未结束的工作，**When** 调度会话归档它，**Then** 归档成功且该会话的工作被停止。
4. **Given** 会话已被用户手动取消置顶，**When** 调度会话向它投递消息或改任务状态，**Then** 不再置顶。

### Edge Cases

- 用户自己归档了会话，插件已把任务归档：不再重复归档。
- 任务记录的会话已不存在：结束任务即可，归档没有对象。
- 会话已被归档且用户要求置顶：宿主拒绝置顶，回复中说明。
- 同一任务重复置顶：幂等，会话仍只出现一次。
- 取消管理后用户要求继续任务：重新接管并再次置顶。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 调度提示词 MUST 要求 `session_create` 成功后对返回的会话 id 执行 `session_pin`。
- **FR-002**: 调度提示词 MUST 要求 `session_manage` 成功后对同一会话执行 `session_pin`。
- **FR-003**: 调度提示词 MUST 要求 `task_end` 成功后归档该任务的会话，`completed` 与 `cancelled` 都归档。
- **FR-004**: 调度提示词 MUST 要求归档传 `stop_activity: true`，使仍在运行的会话也能归档。
- **FR-005**: 调度提示词 MUST 说明 `session_unmanage` 不归档会话，且该会话保持置顶。
- **FR-006**: 调度提示词 MUST 改写「结束任务不归档会话」的表述，使全文对结束任务与会话归档的说明一致。
- **FR-007**: 调度提示词 MUST 说明归档同时移除置顶，不需要再为已归档会话调用 `session_pin`。
- **FR-008**: 调度提示词 MUST 只在派发与接管时置顶；用户手动取消置顶后不补置顶，用户明确要求时按 `session_pin` 执行。
- **FR-009**: 置顶或归档失败时，调度提示词 MUST 要求在同一回复中说明失败并继续。
- **FR-010**: 上述要求 MUST 只以提示词文本实现，`session_create`、`session_manage`、`task_end` 与 `session_unmanage` 的代码行为 MUST 保持不变。
- **FR-011**: `task_end` 与 `session_unmanage` 的工具描述 MUST 删除与新规则冲突的政策措辞，并保留行为事实。

### Key Entities *(include if feature involves data)*

- **任务会话**：任务唯一对应的会话，被管理期间置顶。
- **置顶集合**：宿主的全局置顶会话集合，按置顶时间排序；归档会话时宿主同时移除其置顶。

## Success Criteria *(mandatory)*

- **SC-001**: 在真实宿主上派发一个任务，新任务会话出现在置顶区。
- **SC-002**: 接管一个未置顶的会话后，该会话出现在置顶区。
- **SC-003**: 结束一个任务后，该会话进入归档列表；取消管理一个会话后，该会话仍在常规列表且保持置顶。
- **SC-004**: `pnpm run check` 通过，提示词测试覆盖新增的置顶与归档要求。

## Assumptions

- 宿主已提供 `session_pin` 与 `session_archive`，调度预设已开启，无需新增工具。
- 提示词是唯一改动点，模型是否执行置顶由提示词约束，插件不做代码兜底。
- 宿主在归档的同时移除该会话的置顶，对已归档会话调用 `session_pin` 会报错；两条行为见宿主 `0.2.2-rc.5` 的 `dsh-workspace` 源码。

## Root Cause

调度提示词列举了任务生命周期，唯独没有规定会话置顶，`session_pin` 因此长期未被使用；提示词还明确写着结束任务不归档会话，与用户期望的会话管理方式相反。
