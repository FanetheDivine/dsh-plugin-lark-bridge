# Feature Specification: 调度会话响应策略与上报投递

**Feature Branch**: `feat/069-dispatch-response-policy`

**Created**: 2026-11-26

**Status**: Draft

**Change Category**: 插件变更

**Input**: User description: "1) 改调度提示词：下发指令后立刻响应用户。说明任务会话的报告分「自动发（turn_end）」和「主动发（send_report）」两种；若报告没有明确描述当前状态，或没有需用户确认的点（例如最后一个 turn 恰好是 Background 任务汇报了 text，此时该报告只与那段 text 有关），就向任务会话注入消息，让它重发一次报告；其他情况不要干扰任务会话。2) 用户对调度会话的指令不一定转发给任务会话（例如用户说「某任务会话要等某个值，暂时不用动」，这就不应转发）。3) 对用户也一样：只有实际需要汇报或确认时才向用户发消息，不是只要被注入就发。4) send_report 之后，报告总是缓存成文件到调度会话工作区；向调度会话注入时只注入文件（路径），让调度会话自行去读。5) lark_notify 新增推送卡片能力：不是自动推送，由调度会话主动调用；例如报告特别长时放进卡片，平时收起，展开可看完整 Markdown。6)（仅记录为开放问题）任务会话发出问题后，用户直接与任务会话交互，调度会话不知道这一点。"

## Open Decisions

- [ ] [D-001] 第 4 点由谁读报告文件？草稿按「调度会话自行读取」编写；用户原话是「让任务会话自行去读」，需确认 | Depends on: none | Status: asked
- [ ] [D-002] 「需要重发」的判定条件：建议「报告既没有描述任务当前状态，也没有需用户确认的点」时才重发；两者缺一即重发会让大多数进度报告都被退回 | Depends on: none | Status: asked
- [ ] [D-003] 重发规则适用哪类报告：建议 turn_end 与 send_report 两类都适用，turn_end 是主要场景 | Depends on: D-002 | Status: asked
- [ ] [D-005] 用户消息点名某任务、但只是给调度会话的说明（如「X 在等一个值，暂时不用动」）时，除回复用户外是否用 `task_update` 的 `add_message` 记进该任务的消息列表？建议记录：说明会写入台账与归档，调度会话压缩后仍能查到 | Depends on: none | Status: asked
- [ ] [D-007] 注入调度会话的上报块包含什么：建议保留 `sessionid`、`reportid`、`taskid`、`kind`、`origin` 属性，加报告文件路径与附件副本路径，去掉 `desc` 与 `text` 正文 | Depends on: D-001 | Status: asked
- [ ] [D-009] 卡片内容超过飞书单条卡片上限时如何处理：建议按顺序拆成多张卡片，每张都带总结句与序号；整体失败时返回错误，不自动回落为文本 | Depends on: none | Status: asked
- [ ] [D-010] 卡片模式的 `lark_notify` 在 GUI 中如何呈现：建议沿用 066 的通知卡片，显示总结句、完整 Markdown 原文与所属任务 | Depends on: D-014 | Status: asked
- [ ] [D-011] 上报投递是否补上「轮次刚结束时改为 followup」的兜底？建议纳入：飞书消息注入在 032 修过同类问题，上报投递路径没有同样的处理 | Depends on: none | Status: asked
- [ ] [D-012] 是否新增 `task_send(task_id, text, message_id)`，一次完成「追加任务消息」与「投递给任务会话」？建议本次不纳入，与 D-004「只做主流程」一致 | Depends on: D-005 | Status: asked
- [ ] [D-014] `lark_notify` 关联任务的参数用什么？建议新增可选 `task_id`：插件据此取任务标题与会话，调度提示词一直以任务称呼会话。任务不存在或已结束时返回错误、不发送 | Depends on: none | Status: not asked
- [ ] [D-015] 按任务分开发送是否对文本模式同样生效？建议生效：同一批内容涉及几个任务就发几条，与任务无关的内容单独一条 | Depends on: none | Status: not asked
- [ ] [D-016] 带 `task_id` 的通知如何显示所属任务？建议飞书卡片标题写「<title> (<task id>)」，文本模式在开头加同样的前缀；GUI 卡片的会话入口指向任务会话 | Depends on: D-014 | Status: not asked
- [ ] [D-013] 【待讨论，不写入正文】任务会话发出问题后，用户直接在任务会话中交互，调度会话不知道这一点，任务状态停留在 waiting_user。处理方式待与用户讨论。用户初步想法：维护一份任务日志；在调度会话的 pre-step 阶段，把当前调度会话中还没有的日志条目注入进去；需要区分「全新的会话」与「已有会话」。待其余决策答完后统一讨论 | Depends on: none | Status: deferred

## Clarifications

### Session 2026-11-26

- [D-004] Q: 重发请求是否设次数上限或兜底？ -> A: 只做主流程，假设模型按预期行为，不做次数上限与兜底。
- [D-006] Q: 每条用户消息是否都要回复？ -> A: 每条都回复，用户发来的内容都有意义。
- [D-008] Q: 卡片形态？ -> A: 常显部分是模型写的一句总结，例如「xxx 任务需要确认」「xxx 已完成」；完整 Markdown 默认收起，展开可读。
- [新增] 用户要求调度会话按任务分开通知：每个任务单独发一条，卡片也按任务分开。

### 探索发现

- `lark_notify` 现有参数只有 `text` 与 `reply_to`（`src/tools.ts:38-41`），没有会话或任务参数。
- 成功结果里的 `sessionId` 是调用方会话，也就是调度会话本身（`src/tools.ts:202`）。GUI 通知卡片的会话入口因此指向调度会话（`src/client/notify-card.tsx`）。
- 现有通知与任务没有任何关联，也不能按任务区分。

## Review Record

尚无记录。

## 现状基线

以下结论均有代码证据：

1. 调度提示词 `src/sa-dispatch/prompt.ts` 没有出现 `lark_notify`。经 `lark_notify` 回复的规则只写在桥接提醒 `src/reminder.ts:15-27`，且围绕 `<lark-message>` 编写。
2. 调度提示词只要求新建任务后告知用户（`prompt.ts:23`）。追加消息、回答提问、接管会话、取消任务都没有回执要求。置顶失败要求「in the same reply」说明（`prompt.ts:60`），回应被推到收尾之后。
3. 用户消息一律视为任务消息：属于未结束任务的消息「Append it with task_update and deliver it with session_send」（`prompt.ts:34`、`prompt.ts:70`）。`prompt.ts:35` 的「Answering a task session works the same way」有歧义。
4. 报告一律转述给用户（`prompt.ts:44-45`），没有按内容取舍的规则。
5. 任务会话每个正常结束且未调用 `send_report` 的轮次，都以最后一段助手文本自动上报，`origin="turn_end"`（`src/lark-super-agent/managed/turn-report.ts:109-124`）。后台任务或子代理完成后开启的轮次也会触发，此时文本只与该后台任务有关。
6. `send_report` 与自动上报都已存档到调度工作区：`reports/<taskId>/<reportId>.md` 含 front matter 与正文，附件复制为 `<reportId>-<n>-<文件名>.md`，并做 git 提交（`src/lark-super-agent/reports.ts:149-192`）。
7. 注入调度会话的 `<task_session_message>` 块带完整 `desc`、`text` 与附件副本路径，不带报告文件路径（`src/lark-super-agent/blocks.ts:41-63`、`service.ts:386-405`）。
8. 上报投递直接调用 `agent.steer`（`service.ts:358-364`），没有飞书消息注入所用的轮次结束兜底（`src/sessions.ts:371-381`）。
9. `lark_notify` 只发纯文本，按 15 000 字符分段（`src/tools.ts:113-148`）。
10. 飞书消息到达后逐条立即注入（`src/bridge.ts:268-290`）。`docs/how-it-works.md` 与 `docs/known-risks.md` 仍写着 15 秒静默后整批注入。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 下发指令后立刻得到回应 (Priority: P1)

用户在飞书给调度会话发一条任务。调度会话创建或通知任务会话后，紧接着用 `lark_notify` 告诉用户已派发到哪个工作区、哪个任务，然后才做置顶等收尾。

**Why this priority**: 用户只能通过飞书看到调度会话的动作。回应排在收尾之后，用户会长时间收不到任何反馈。

**Independent Test**: 在调度会话发一条可派发的任务消息，检查轮次事件：成功的 `session_create` 之后的下一步含 `lark_notify`。

**Acceptance Scenarios**:

1. **Given** 用户发来一条新任务，**When** `session_create` 成功，**Then** 下一步调用 `lark_notify` 告知工作区与「<title> (<task id>)」，`session_pin` 与它同步或在其后执行。
2. **Given** 用户补充一条属于未结束任务的消息，**When** 调度会话把它投递给任务会话，**Then** 投递后的下一步用 `lark_notify` 确认已送达哪个任务。
3. **Given** 用户要求取消任务，**When** `task_end` 成功，**Then** 下一步用 `lark_notify` 确认。
4. **Given** 置顶或归档失败，**When** 调度会话已经回应过用户，**Then** 再发一条简短 `lark_notify` 说明失败。

---

### User Story 2 - 报告不充分时请任务会话重发 (Priority: P1)

任务会话的某一轮恰好是后台任务完成后的收尾，最后一段文本只讲了这个后台任务。自动上报因此没有说清任务整体进展，也没有要用户确认的点。调度会话读到这份报告后，向任务会话发一条消息，请它用 `send_report` 重发一份描述当前状态的报告。其他报告不打扰任务会话。

**Why this priority**: 自动上报只取最后一段文本，内容可能与任务整体无关。调度会话把它原样转给用户会误导用户，直接丢弃又会漏掉进展。

**Independent Test**: 构造一份只描述后台任务输出的 turn_end 报告投给调度会话，检查调度会话向该任务会话发了一次重发请求、没有通知用户；再构造一份描述清楚的报告，检查调度会话没有向任务会话发任何消息。

**Acceptance Scenarios**:

1. **Given** 报告不充分（判定见 D-002），**When** 调度会话处理它，**Then** 向对应任务会话发一次重发请求，请求说明要报告任务当前状态与需要用户确认的点。
2. **Given** 报告充分，**When** 调度会话处理它，**Then** 不向任务会话发送确认、转述或任何其他消息。
3. **Given** 调度会话处理任一报告，**When** 它向任务会话发消息，**Then** 消息只能是重发请求或用户本人的话。

---

### User Story 3 - 只在需要时联系用户 (Priority: P1)

调度会话收到报告或失败通知后，先判断是否有需要用户知道或确认的内容。有结果、里程碑、阻塞、失败或提问时通知用户；纯噪声不通知。用户发来的每条消息都回复。

**Why this priority**: 每次注入都通知用户会打扰用户，也让重要通知被淹没。

**Independent Test**: 依次投递一份含提问的报告、一份只写「收到」的 turn_end 报告，检查前者触发 `lark_notify`、后者不触发。

**Acceptance Scenarios**:

1. **Given** 报告含提问，**When** 调度会话处理它，**Then** 用 `lark_notify` 转达提问并把任务设为 `waiting_user`。
2. **Given** 报告含结果、里程碑或阻塞，**When** 调度会话处理它，**Then** 用 `lark_notify` 转达。
3. **Given** 报告只是确认、复述或与上次通知重复，**When** 调度会话处理它，**Then** 不通知用户，任务状态照常更新。
4. **Given** 同一批输入含多个任务的报告，**When** 调度会话需要通知，**Then** 每个任务单独发一条 `lark_notify`，各自带该任务的 `task_id`；同一任务的内容合并为一条。
5. **Given** 用户发来任意一条消息，**When** 调度会话处理它，**Then** 回复该消息，包括「好的」「收到」这类简短消息（D-006）。

---

### User Story 4 - 用户的话不一定转发给任务会话 (Priority: P2)

用户对调度会话说「某任务在等一个值，暂时不用动」。调度会话判断这是给自己的说明，不是给任务会话的指令，因此不转发，只记录并回应用户。

**Why this priority**: 把这类说明转发给任务会话会让它开新一轮，产生无谓的工作与自动上报。

**Independent Test**: 发一条点名未结束任务、内容是「暂时不用动」的消息，检查调度会话没有调用 `session_send`，并按 D-005 记录与回应。

**Acceptance Scenarios**:

1. **Given** 用户消息点名某任务，内容是要求任务会话执行、补充或回答，**When** 调度会话处理它，**Then** 追加到任务并投递给任务会话。
2. **Given** 用户消息点名某任务，内容只是给调度会话的说明，**When** 调度会话处理它，**Then** 不投递给任务会话，按 D-005 记录并回应用户。
3. **Given** 调度会话无法判断是否需要转发，**When** 处理该消息，**Then** 询问用户。

---

### User Story 5 - 调度会话自己读报告文件 (Priority: P2)

任务会话上报后，报告存成调度工作区里的文件。调度会话收到的注入块只给出报告标识与文件路径，它按需读取文件内容。

**Why this priority**: 报告正文直接进入调度会话上下文，会让长报告反复占用上下文、触发压缩；读文件让调度会话决定读多少、何时读。

**Independent Test**: 让被管理会话调用一次带长正文与附件的 `send_report`，检查调度工作区出现报告文件与附件副本，注入块含文件路径且不含正文。

**Acceptance Scenarios**:

1. **Given** 被管理会话调用 `send_report`，**When** 上报成功，**Then** 报告文件写入调度工作区，注入块按 D-007 只带标识与路径。
2. **Given** 一轮自动上报，**When** 上报成功，**Then** 存档与注入方式和 `send_report` 相同。
3. **Given** 调度会话收到注入块，**When** 需要报告内容，**Then** 读取块中的报告文件与附件。
4. **Given** 存档后 git 提交失败，**When** 注入已完成，**Then** 行为与现状一致：上报仍算送达，工具结果附带 warning。

---

### User Story 6 - 长内容以可折叠卡片发给用户 (Priority: P2)

报告很长时，调度会话调用 `lark_notify` 的卡片模式。用户在飞书看到一张卡片：模型写的一句总结常显，例如「xxx 任务需要确认」「xxx 已完成」；完整 Markdown 默认收起，展开后可读。每个任务各发一张卡片。

**Why this priority**: 长报告以纯文本推送会刷屏并被拆成多条；卡片让用户先看摘要，需要时再展开。

**Independent Test**: 在调度会话以卡片模式调用 `lark_notify`，检查飞书收到一张卡片，完整内容默认收起，展开后 Markdown 完整。

**Acceptance Scenarios**:

1. **Given** 调度会话以卡片模式调用 `lark_notify`，**When** 发送成功，**Then** 用户收到一张卡片，常显一句总结，完整 Markdown 默认收起。
2. **Given** 调度会话以默认模式调用 `lark_notify`，**When** 发送，**Then** 行为与现状一致，只发纯文本。
3. **Given** 卡片模式带 `reply_to`，**When** 发送，**Then** 卡片引用该用户消息。
4. **Given** 卡片内容超过单张上限，**When** 发送，**Then** 按 D-009 处理。
5. **Given** 任何会话，**When** 没有调用卡片模式，**Then** 插件不自动发卡片。
6. **Given** 调用带 `task_id`，**When** 发送成功，**Then** 通知按 D-016 显示所属任务。

### Edge Cases

- 报告到达时调度会话正在运行：报告并入当前轮次处理，回应规则不变。
- 报告在调度会话轮次刚结束时到达：按 D-011 处理，不应停留到下一条用户消息才被处理。
- 重发请求会让任务会话开新一轮。按 D-004，本次假设任务会话按请求调用 `send_report`，不设次数上限与兜底。
- `task_id` 指向不存在或已结束的任务：按 D-014 处理。
- 报告文件被用户手动删除或移动：调度会话读取失败时如实告诉用户，并给出报告标识。
- 失败通知 `<task_session_failure>` 与归档通知 `<task_session_archived>` 的投递格式保持现状。
- 卡片模式发送失败：工具返回失败结果；调度会话按桥接提醒把完整内容留在正文，并改用文本模式或说明失败。
- 卡片中的 Markdown 含飞书卡片不支持的语法：显示可能与网页不同，内容不丢失。
- 用户引用一张卡片回复：被引消息按现有引用读取流程呈现。

## Requirements *(mandatory)*

### Functional Requirements

**回应时机**

- **FR-001**: 调度提示词 MUST 写明用户只能看到 `lark_notify` 的内容，调度会话的正文不会送达用户。
- **FR-002**: `session_create`、`session_send`、`session_manage`、`session_unmanage` 或 `task_end` 成功后，调度会话 MUST 在下一步调用 `lark_notify` 回应用户。置顶等收尾 MUST 与该通知同步执行或排在其后。
- **FR-003**: 收尾操作失败时，调度会话 MUST 另发一条简短 `lark_notify` 说明。
- **FR-004**: 调度会话 MUST 按任务分开通知：同一批输入里每个任务的内容合并为一条 `lark_notify` 并带该任务的 `task_id`，不同任务分开发送；与任务无关的内容单独一条。在通知之后到达的消息 MUST 单独回应。桥接提醒的「连续消息只回复一次」MUST 改为同一口径（D-015）。
- **FR-005**: 调度会话转达与某个任务相关的内容时 SHOULD 用该任务最近一条用户消息作 `reply_to`；为此创建任务与追加消息时 MUST 传入用户消息的 `message_id`。

**报告分类与重发**

- **FR-006**: 调度提示词 MUST 说明报告有两类来源：`origin="turn_end"` 是轮次结束时自动取最后一段文本发出，`origin="send_report"` 是任务会话主动发出。
- **FR-007**: 报告不充分（D-002）时，调度会话 MUST 向对应任务会话发一次重发请求，要求用 `send_report` 报告任务当前状态与需要用户确认的点。适用范围见 D-003。本次不设次数上限与兜底（D-004）。
- **FR-008**: 调度会话 MUST NOT 向任务会话发送对报告的确认、转述或自身回复。发往任务会话的消息 MUST 只有两类：用户本人的指令、补充或回答，以及 FR-007 的重发请求。
- **FR-009**: `prompt.ts:35` 的歧义表述 MUST 改为：用户回答任务提问时，追加回答并投递给任务会话。

**联系用户**

- **FR-010**: 调度会话 MUST 只在有需要用户知道或确认的内容时通知用户：结果、里程碑、阻塞、失败或提问。报告只是确认、复述或与上次通知重复时 MUST NOT 通知。
- **FR-011**: 无论是否通知，调度会话 MUST 按报告类型更新任务状态：`progress` 设为 `in_progress`，`question` 设为 `waiting_user`。
- **FR-012**: 任务会话轮次失败时，调度会话 MUST 把任务设为 `failed` 并通知用户一次；用户要求后才重试。
- **FR-013**: 调度会话 MUST 回复用户发来的每一条消息（D-006）。

**转发判断**

- **FR-014**: 调度会话 MUST 先判断点名任务的用户消息是否是给任务会话的指令，再决定是否转发。给调度会话自己的说明 MUST NOT 转发，按 D-005 处理。
- **FR-015**: 无法判断是否转发时，调度会话 MUST 询问用户。

**报告存档与注入**

- **FR-016**: `send_report` 与自动上报 MUST 都把报告存成调度工作区的文件，附件同样复制到调度工作区。现状已满足，本次保持。
- **FR-017**: 注入调度会话的上报块 MUST 按 D-007 只带标识与文件路径，不带报告正文。
- **FR-018**: 调度提示词 MUST 要求调度会话处理报告时读取报告文件，需要时读取附件。
- **FR-019**: 上报投递 MUST 保证调度会话及时处理：轮次刚结束时投递的报告不得停留到下一次唤醒（D-011）。

**卡片通知**

- **FR-020**: `lark_notify` MUST 新增可选的卡片模式，未选择时行为保持现状。
- **FR-021**: 卡片模式 MUST 常显调用方提供的一句总结，完整 Markdown 默认收起，展开后可读（D-008）。
- **FR-022**: 卡片模式 MUST 支持 `reply_to`，超长内容按 D-009 处理，失败时返回与现有一致的失败结果。
- **FR-023**: 插件 MUST NOT 自动发卡片；卡片只由调度会话主动调用。调度提示词 MUST 说明何时使用卡片，例如报告特别长时。
- **FR-024**: 卡片模式的成功通知在 GUI 中 MUST 按 D-010 呈现。
- **FR-028**: `lark_notify` MUST 新增关联任务的可选参数（D-014），文本模式与卡片模式都可使用。带该参数时，通知 MUST 按 D-016 显示所属任务。不带时行为保持现状。

**文档与测试**

- **FR-025**: `README.md` MUST 说明 `lark_notify` 的卡片模式与调度会话的回应规则。
- **FR-026**: `docs/how-it-works.md` 与 `docs/known-risks.md` MUST 更新上报注入、卡片通知与飞书消息立即注入的描述，删除 15 秒批量注入的过时内容。
- **FR-027**: `tests/` MUST 覆盖：上报块只含标识与路径、上报投递兜底、卡片模式与任务参数的校验与发送命令、提示词与桥接提醒的关键规则。

### Key Entities

- **报告**：任务会话的一次上报，来源为 `turn_end` 或 `send_report`，类型为 `progress` 或 `question`，存为调度工作区 `reports/<taskId>/<reportId>.md`。
- **上报块**：注入调度会话的 `<task_session_message>`，携带报告标识与文件路径。
- **重发请求**：调度会话发给任务会话的一条消息，要求用 `send_report` 报告当前状态与待确认点。
- **卡片通知**：`lark_notify` 卡片模式发出的飞书卡片，含常显的一句总结与默认收起的完整 Markdown，可关联一个任务。
- **任务**：`message-task-status.json` 中的未结束任务，状态取 `in_progress`、`waiting_user` 或 `failed`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 在派发、补充、取消三类场景的实机验收中，每次成功的下发调用之后，下一步都含 `lark_notify`。
- **SC-002**: 在充分报告的验收场景中，调度会话向任务会话发送的消息数为 0。
- **SC-003**: 在不充分报告的验收场景中，调度会话向任务会话发出重发请求，任务会话随后用 `send_report` 报告当前状态。
- **SC-004**: 在只含确认或重复内容的报告场景中，用户收到的飞书消息数为 0。
- **SC-005**: 「暂时不用动」类消息的验收场景中，`session_send` 调用数为 0。
- **SC-006**: 单元测试断言：注入调度会话的上报块不含报告正文，含可读取的报告文件路径。
- **SC-007**: 卡片模式发出的飞书消息是一张卡片，完整内容默认收起；默认模式的发送命令与现状一致。
- **SC-008**: 轮次刚结束时投递的报告，在不发新用户消息的情况下被调度会话处理。
- **SC-009**: 一批输入含两个任务的报告时，用户收到两条通知，每条只含一个任务的内容。
- **SC-010**: 实机验收中，用户发来的每条消息都得到回复。

## Assumptions

- 调度会话、任务会话、`send_report`、自动上报、失败通知与归档通知的其余行为保持现状。
- 报告充分与否由调度会话按提示词判断，插件不在代码中判定。
- 卡片使用 `lark-cli im +messages-send` 与 `+messages-reply` 的 interactive 消息发送，沿用现有 bot 身份与 `im:message:send_as_bot` 权限。
- 卡片不含交互按钮，不需要订阅卡片回调事件。
- 桥接提醒对所有桥接会话生效；调度会话专属的回应规则写在调度提示词中，桥接提醒只保留通用规则。
- D-013 记录的「用户直接与任务会话交互」不在本次范围。
