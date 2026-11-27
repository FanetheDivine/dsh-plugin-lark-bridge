# Feature Specification: 接管会话的任务名基于会话标题生成

**Feature Branch**: `fix/081-managed-task-naming`

**Created**: 2026-11-27

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "修改系统提示词：当调度会话通过 session_manage 把一个已有会话加入管理时，新建任务的名称要读取该会话的 title 作为任务名（现在任务名是会话 id，如「session-xxxx」）。请在调度会话系统提示词中补充这条规则，并按需调整相关代码或文档。" 后续修正："改为「基于 title」作为任务名（即任务名基于会话 title 生成，而不是直接读取 title 当任务名）。"

## Open Decisions

无。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 任务名的来源是什么 -> A: 会话标题是生成任务名的依据。`session_manage` 返回会话标题，调度会话据此生成简短任务名，不机械照抄标题，也不用会话 id。
- [D-002] Q: 会话标题由谁读取 -> A: 插件从宿主 `sessionTitle` 服务读取会话最新标题，把换行折叠为一个空格并去掉首尾空白；服务不可用或标题为空时回退会话 id。
- [D-003] Q: 建任务时的初始标题是什么 -> A: 用会话标题作初始标题，标题缺失时用会话 id；调度会话随后用 `task_update` 写入生成的任务名。
- [D-004] Q: 新规则写在提示词哪里 -> A: 写在 `## Manage existing sessions` 小节；命名与置顶在同一执行步骤完成，`lark_notify` 的既有顺序不变。
- [D-005] Q: `session_manage` 的工具结果是否变化 -> A: 保持 `sessionId`、`taskId`、`title` 三个字段，`title` 表示会话标题，标题缺失时为会话 id。
- [D-006] Q: 会话没有标题时如何命名 -> A: 调度会话按用户对会话的描述生成任务名；无法判断时询问用户。会话 id 只作初始兜底，不作为任务名。
- [D-007] Q: 文档与变更记录范围 -> A: 更新 `docs/how-it-works.md` 的调度预设说明与接管条目，`CHANGELOG.md` 增加 Unreleased 条目；README 不描述该话术细节，保持不变。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 任务名由调度会话生成，遵循程度依赖提示词，无代码兜底 | 用户指示：自行实现 + 合并 PR

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 接管有标题的会话后任务名来自该标题 (Priority: P1)

用户在网页里开了一个会话并完成了初步工作，要求调度会话接管它。任务建立后，任务名依据该会话的标题生成，用户和调度会话都能用名称认出这个任务。

**Why this priority**: 任务名是台账、通知与任务匹配的主键。当前任务名退化为会话 id，用户无法从名称认出任务。

**Independent Test**: 对一个标题为 `T` 的未管理会话执行 `session_manage`，检查任务初始标题为 `T`，工具返回 `title` 为 `T`；按提示词用 `task_update` 改名后，台账标题为新任务名。

**Acceptance Scenarios**:

1. **Given** 一个未管理、标题为 `T` 的会话，**When** 调度会话调用 `session_manage`，**Then** 任务初始标题为 `T`，工具结果的 `title` 为 `T`。
2. **Given** `session_manage` 返回标题 `T`，**When** 调度会话回复用户，**Then** 它基于 `T` 生成任务名并用 `task_update` 写入，任务名不使用会话 id。
3. **Given** 任务名已写入，**When** 调度会话通知用户，**Then** 通知中的任务提及使用新任务名。

---

### User Story 2 - 会话无标题时任务仍有可用名称 (Priority: P1)

用户接管一个还没有标题的会话。任务初始标题回退为会话 id，调度会话按用户对会话的描述生成任务名。

**Why this priority**: 无标题会话是接管路径的边界情况，任务名不能永久停留在会话 id。

**Independent Test**: 对一个没有标题的会话执行 `session_manage`，工具结果的 `title` 为会话 id；按提示词生成任务名后，台账标题不同于会话 id。

**Acceptance Scenarios**:

1. **Given** 会话没有标题，**When** 执行 `session_manage`，**Then** 任务初始标题为会话 id，接管照常成功。
2. **Given** 工具返回的标题等于会话 id，**When** 调度会话为该任务命名，**Then** 它按用户描述的会话内容生成任务名；无法判断时询问用户。

---

### User Story 3 - 标题读取覆盖宿主真实存储与格式 (Priority: P2)

会话标题保存在会话日志的 `session/title` 事件里，插件从宿主服务读取，并规范化为单行文本。

**Why this priority**: 读取来源错误会让所有接管任务退回会话 id；标题含换行会破坏台账行校验。

**Independent Test**: 分别用有标题、标题含换行、无标题与宿主服务缺失的会话执行 `session_manage`，检查任务初始标题。

**Acceptance Scenarios**:

1. **Given** 会话的最新标题含换行，**When** 执行 `session_manage`，**Then** 任务标题把换行折叠为一个空格并去掉首尾空白。
2. **Given** 宿主没有 `sessionTitle` 服务，**When** 执行 `session_manage`，**Then** 任务标题回退为会话 id，接管成功。

---

### Edge Cases

- 会话标题只有空白字符时按无标题处理，回退会话 id。
- 同一会话取消管理后再次管理时，重新读取当前标题，任务名重新生成。
- 会话标题自身含括号、空格或较长文本时，任务名由调度会话缩短，台账按单行保存。
- `session_manage` 失败时保持现有错误行为，不建立任务，也不涉及命名。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `session_manage` MUST 读取被管理会话的最新标题作为任务初始标题。标题来源为宿主 `sessionTitle` 服务对会话日志的折叠结果。
- **FR-002**: 标题中的换行 MUST 折叠为一个空格，首尾空白 MUST 去掉。
- **FR-003**: 标题为空、只有空白或读取服务不可用时，任务初始标题 MUST 为会话 id。
- **FR-004**: 调度提示词 MUST 要求调度会话在 `session_manage` 成功后，基于返回的会话标题生成简短任务名，并用 `task_update` 写入。任务名 MUST NOT 为会话 id。
- **FR-005**: 返回标题等于会话 id 时，调度会话 MUST 按用户描述的会话内容生成任务名；无法判断时询问用户。
- **FR-006**: 命名与 `session_pin` 置顶 MUST 在 `session_manage` 成功后的同一执行步骤完成；`lark_notify` 的既有顺序 MUST 保持不变。
- **FR-007**: `session_manage` 的工具结果 MUST 保持 `sessionId`、`taskId`、`title` 字段与现有错误文案。
- **FR-008**: 测试 MUST 覆盖标题读取、换行折叠、空白与无服务回退，以及提示词中的命名规则。
- **FR-009**: `docs/how-it-works.md` MUST 补充首行标题来源与命名规则；`CHANGELOG.md` MUST 增加 Unreleased 条目。

### Key Entities

- **会话标题**: 会话日志中最新 `session/title` 事件的文本，经宿主服务折叠后读取。
- **任务台账记录**: `message-task-status.json` 中任务的 `title` 字段，保存初始标题与调度会话生成的任务名。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 对有标题的会话执行 `session_manage`，100% 的任务初始标题等于会话标题；台账中由接管产生的任务标题不出现会话 id（标题缺失的会话除外）。
- **SC-002**: 调度提示词包含基于标题生成任务名的规则，相关测试全部通过。
- **SC-003**: `pnpm format && pnpm check` 通过。

## Assumptions

- 宿主 `sessionTitle.get(session)` 返回该会话的最新标题快照，标准预设已装载该服务。
- 会话标题已概括会话内容，调度会话能据此生成保留含义的简短任务名。
- 任务名由调度会话生成，插件内不调用模型生成名称。
- 任务台账格式与上报文件格式不变。
