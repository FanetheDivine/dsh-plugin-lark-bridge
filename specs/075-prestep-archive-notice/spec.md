# Feature Specification: 归档通知改为 pre-step 注入并补充调度信号分层文档

**Feature Branch**: `feat/075-prestep-archive-notice`

**Created**: 2026-11-27

**Status**: Waived

**Change Category**: 插件变更

**Input**: User description: "task_session_archived 也放到 prestep。因为『会话归档』本来就是用户操作，不需要调度模型时刻响应。系统提示词有这部分内容的话，需要改掉。关于这一点也拆个文档出来，包括：紧急消息（需要立刻响应）、重要消息（需要注入调度会话但不需要立刻响应）、日志消息（不注入调度会话，按需读取）。"

## Open Decisions

None。逐条决策见 Clarifications。

## Clarifications

### Session 2026-11-27

- [D-001] Q: `<task_session_archived>` 的投递时机是什么？ -> A: 放到调度会话的 pre-step。归档时不再向调度会话发即时消息。
- [D-002] Q: 为什么这样改？ -> A: 归档会话是用户自己的操作，调度模型不需要在归档时刻响应；等调度会话下一次运行时一并看到即可。
- [D-003] Q: 提示词是否要改？ -> A: 要改。调度会话提示词里与归档通知即时响应相关的文字必须改为与新投递方式一致。
- [D-004] Q: 待注入通知如何送达调度会话？ -> A: 照任务日志的既有链路：持久化待注入记录，调度会话下一次 `agent/pre-step` 注入。
- [D-006] Q: 这套分层是否需要单独文档？ -> A: 需要。按「紧急、重要、日志」三类写一份文档，说明定义、成员与投递方式。
- [D-010] Q: 失败通知 `task_session_failure` 属于哪类？ -> A: 紧急类，保持即时投递。
- [D-005] Q: 归档通知与任务日志是否合并成同一条注入消息？ -> A: 并入任务日志注入消息，顺序为任务快照、日志条目、归档通知。
- [D-007] Q: 已注入如何判定，注入请求失败后如何处理？ -> A: 以调度会话事件日志中出现的归档通知标记判定已注入；记录保留到标记出现，未出现时下次继续注入。
- [D-008] Q: 已归档任务经 `session_restore` 恢复后，待注入记录如何处理？ -> A: 删除该任务的待注入记录。
- [D-009] Q: 调度会话提示词中归档通知那一段改成什么？ -> A: 改为「不要因它通知用户：这是用户自己的操作」，并说明它随下一次注入到达。
- [D-011] Q: 待注入记录持久化在哪里？ -> A: 调度工作区文件，与任务台账同一目录、同一串行写入队列。
- [D-012] Q: 分层文档的成员划分与文件名？ -> A: 新建 `docs/dispatch-signals.md`，成员按本 spec 的信号分层表。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 归档通知在调度会话下次运行前不可见；工作区切换后旧工作区的待注入记录不再注入。 | Reason: 用户明确要求「都按推荐，自行推进至合并 PR」，免中途确认。

## 现状基线

2026-11-27，分支基于 `origin/main` 的 `e462036`。

1. 宿主归档会话后触发 `workspace/session-archived`，插件监听后立即调用 `service.notifyArchived`（`src/lark-super-agent/managed/index.ts:176-182`）。
2. `notifyArchived` 先以 `session_archived` 结束任务，再把 `<task_session_archived>` 交给当前调度会话（`src/lark-super-agent/service.ts:769-782`）。
3. 投递走 `deliver`，内部调用 `agent.steer`（`service.ts:485-497`）；调度会话空闲时因此开始一轮，模型立即被唤起。
4. 归档块正文为 `<task_session_archived sessionid="…" taskid="…"/>`（`src/lark-super-agent/blocks.ts:130-132`），消息来源 `source.kind = "lark-super-agent"`（`service.ts:486-489`）。
5. 调度会话提示词把该块列在「Other messages from the service」，并要求告知用户（`src/sa-dispatch/prompt.ts:22`、`:106`）。
6. pre-step 注入先例：任务日志由调度会话每次 pre-step 合成注入，来源 `lark-task-log`，位置在桥接提醒之后、本批第一条 `<lark-message>` 之前，并靠扫描事件日志去重（`src/lark-super-agent/managed/task-log-injector.ts`、`docs/how-it-works.md:339`）。
7. 用户直接发到任务会话的消息不注入任务会话，由宿主作为普通用户消息处理；插件把它写入任务日志文件并等待下一次 pre-step 注入调度会话（`src/lark-super-agent/managed/task-log-observer.ts`、`src/lark-super-agent/task-log.ts`）。
8. 现有测试断言归档瞬间投递（`tests/lark-super-agent-service.test.ts:447`）与提示词文案（`tests/sa-dispatch.test.ts:539`）。
9. `session_restore` 会把归档任务迁回台账并删除归档目录（`src/lark-super-agent/notes.ts:444-505`）。

## 信号分层

按「是否需要调度会话立即响应」划分：

| 类别 | 定义 | 投递方式 | 成员 |
| --- | --- | --- | --- |
| 紧急 | 调度会话需要立刻响应 | `steer` 注入并唤起一轮 | 飞书用户消息 `<lark-message>`、上报 `<task_session_message>`、轮次失败 `<task_session_failure>` |
| 重要 | 注入调度会话，无需立刻响应 | 持久化记录，下一次 `agent/pre-step` 注入 | `<task_session_archived>`、`<task_log_entry>`、首次会话的 `<task_snapshot>` |
| 日志 | 不注入调度会话 | 文件，调度会话按需读取 | 报告存档 `reports/` 与 `archive/<taskId>/reports/`、任务日志 `task-logs/`、任务台账 `message-task-status.json`、工作区笔记 `workspaces.json` |

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 归档会话不唤醒调度模型 (Priority: P1)

用户在 GUI 归档一个被管理会话。插件立刻以 `session_archived` 结束对应任务，但不向调度会话发消息，也不唤醒空闲的调度模型。用户下次在飞书发消息或调度会话因其他原因运行时，才看到归档通知。

**Why this priority**: 归档是用户自己的操作，结果用户已知；即时投递会白白唤起一轮模型请求。

**Independent Test**: 播种一个被管理会话与任务，触发 `workspace/session-archived`，断言任务已归档、调度 agent 的 `steer` 未被调用。

**Acceptance Scenarios**:

1. **Given** 调度会话空闲、被管理会话有未结束任务，**When** 用户归档该会话，**Then** 任务以 `session_archived` 结束，调度会话未收到任何即时消息，也没有新的模型请求。
2. **Given** 已归档的会话，**When** 调度会话随后因其他原因进入下一轮，**Then** 该轮 pre-step 的注入里出现这条归档通知。

---

### User Story 2 - 下次 pre-step 补注且只注一次 (Priority: P1)

调度会话下一次运行时收到之前积压的归档通知。通知与任务日志、桥接提醒一样属于非用户消息，模型据此知道任务因归档结束。压缩覆盖上下文或插件重启后，同一条通知不重复出现。

**Why this priority**: 延迟投递必须可信；重复通知会让模型重复告知用户已归档。

**Independent Test**: 归档两个会话后连续触发两次 pre-step，断言第一次出现两条归档块，第二次不出现；压缩后再次 pre-step 也不出现。

**Acceptance Scenarios**:

1. **Given** 两次归档发生在调度会话两次运行之间，**When** 调度会话下一次 pre-step，**Then** 注入里按归档时间列出两条通知。
2. **Given** 上一次 pre-step 已注入通知，**When** 再次 pre-step 或表层被压缩，**Then** 不再出现同一条通知。
3. **Given** 插件重启，**When** 调度会话下一次 pre-step，**Then** 未注入的通知仍然出现，已注入的不出现。

---

### User Story 3 - 恢复会话后通知失效 (Priority: P2)

用户在调度会话下次运行前用 `session_restore` 恢复了刚归档的会话。任务重新成为未结束任务，之前排队的归档通知必须删除，避免模型把仍在进行的任务说成已归档。

**Why this priority**: 恢复与归档都可能发生在两次调度会话运行之间，顺序会改变结论。

**Independent Test**: 归档会话后立即恢复，触发 pre-step，断言没有该任务的归档通知且任务在台账中未结束。

**Acceptance Scenarios**:

1. **Given** 某任务刚被归档、通知尚未注入，**When** 用户恢复该会话，**Then** 待注入的归档通知被删除，pre-step 不再出现它。

---

### User Story 4 - 三类信号文档 (Priority: P2)

维护者需要从一处文档看清调度会话收到的全部信号：哪些会立刻唤起模型，哪些只在下一次 pre-step 注入，哪些只落文件按需读取。`<task_session_archived>` 明确属于第二类。

**Why this priority**: 新增延迟投递后，如果分类只留在代码与提示词里，后续改动容易再次把非紧急信号塞进即时投递。

**Independent Test**: 按文档的三类成员逐条核对代码链路，确认每一类成员的投递方式与文档一致。

**Acceptance Scenarios**:

1. **Given** 文档列出三类信号及成员，**When** 维护者按表核对 `steer` 与 pre-step 注入路径，**Then** 每条成员与实际投递方式一致。
2. **Given** `AGENTS.md` 的文档索引，**When** 维护者查找调度信号说明，**Then** 能从索引进入该文档。

---

### Edge Scenarios

- 调度会话本身被归档，插件按既有规则重建调度会话；新调度会话首次 pre-step 不重放全部历史归档通知。
- 被归档的会话没有对应任务：不产生通知。
- 同一会话在两次 pre-step 之间被归档、恢复、再次归档：只保留最后一次的通知。
- 归档通知的记录已写入但调度会话在注入前被删除：记录保留到下一个调度会话。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 用户归档被管理会话时，插件 MUST 立即以 `session_archived` 结束对应任务，并 MUST NOT 向调度会话发送即时消息或唤起模型。
- **FR-002**: 归档时插件 MUST 在调度工作区持久化一条待注入记录，内容为被归档会话、任务标识、归档时间与唯一标记（D-011）。
- **FR-003**: 调度会话下一次 `agent/pre-step` MUST 把积压的归档通知注入本批消息；标记已进入调度会话事件日志后 MUST 删除对应记录。
- **FR-004**: 注入的内容 MUST 保持 `<task_session_archived sessionid="…" taskid="…"/>` 的块形态，并 MUST 带可判定已注入的标记。
- **FR-005**: 已注入的归档通知 MUST NOT 再次注入，包括表层被压缩后与插件重启后；未进入事件日志的通知 MUST 在下次 pre-step 再次注入（D-007）。
- **FR-006**: 多条待注入通知 MUST 按归档时间升序排列，并随「重要消息」的注入一并到达（依 D-005 决策）。
- **FR-007**: 归档通知 MUST 只注入当前调度会话；其他会话 MUST NOT 收到。
- **FR-008**: 任务被 `session_restore` 恢复时，插件 MUST 删除该任务尚未注入的记录（依 D-008 决策）。
- **FR-009**: 被归档会话没有对应任务时，插件 MUST NOT 产生记录。
- **FR-010**: 调度会话提示词 MUST 去掉「收到归档通知即告知用户」的即时响应要求，改为说明它随注入到达、无需因此通知用户。
- **FR-011**: `docs/how-it-works.md` MUST 同步归档任务的结束时机与通知注入时机；`docs/known-risks.md` MUST 记录归档通知在调度会话下次运行前不可见的取舍。
- **FR-012**: 新增 `docs/dispatch-signals.md` MUST 按紧急、重要、日志三类列出定义、成员与投递方式；`AGENTS.md` 的文档索引与 `docs/how-it-works.md` MUST 链接到它（D-012）。

### Key Entities

- **归档通知**：一条 `<task_session_archived sessionid taskid/>` 块，记录会话被归档导致任务结束。
- **待注入记录**：持久化的未注入归档通知，含会话、任务与归档时间，供 pre-step 注入。
- **信号分层**：紧急、重要、日志三类调度信号的划分，含每类的成员与投递方式。

## Success Criteria *(mandatory)*

- **SC-001**: 触发会话归档后，调度 agent 的 `steer` 调用数为 0，任务台账中该任务以 `session_archived` 结束（单测断言）。
- **SC-002**: 归档后调度会话下一次 pre-step 的注入包含该归档块；连续两次 pre-step 只出现一次（单测断言）。
- **SC-003**: 压缩表层后再次 pre-step 不重复出现该归档块；重建插件实例后未注入的通知仍然出现，已注入的不出现（单测断言）。
- **SC-004**: 调度会话提示词不含「归档后立刻告知用户」的要求，且说明归档通知随注入到达（单测断言）。
- **SC-005**: 被归档后被恢复的会话不产生归档通知，任务仍在台账的未结束集合中（单测断言）。
- **SC-006**: 新增文档列出三类信号的全部成员；逐条核对代码，投递方式一致（人工核对）。

## Assumptions

- 归档事件与任务结束的既有顺序不变；`workspace/session-archived` 仍是唯一入口。
- 调度会话每次运行前都有 `agent/pre-step`，注入机会不缺失。
- 用户接受归档通知在调度会话下次运行前不可见。
- 归档通知不是上报，不修改任务状态，不产生报告文件。
- 飞书用户消息与上报、失败通知保持即时投递，不受本变更影响。