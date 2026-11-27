# Feature Specification: 任务会话消息不含会话元信息

**Feature Branch**: `feat/076-task-message-metadata`

**Created**: 2026-11-27

**Status**: Waived

**Change Category**: 插件变更

**Input**: User description: "改下系统提示词 要求调度会话往任务会话发消息时 不得暴露任务会话的元信息 例如「你的模型被我切换为xxx」「上一轮因模型服务拦截失败」「你的工作区是xxx」（dsh的工作区机制已经说明这一点了）"

## Open Decisions

None。决策按推荐写回，用户授权免确认自行推进。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 禁止范围是绝对禁止，还是用户明确要求转达时放行？ -> A: 绝对禁止。调度会话自己的措辞不写任务会话的元信息；用户原文按 D-003 处理。
- [D-002] Q: 「会话元信息」包含哪些具体项？ -> A: 模型路由与切换动作、上一轮失败原因（含模型服务拦截）、工作区标识与工作目录路径、会话 id。
- [D-003] Q: 用户指令原文本身提到工作区、模型或失败原因时如何处理？ -> A: 作为用户内容照转。
- [D-004] Q: 任务真正需要的具体文件路径是否照常给出？ -> A: 照常给出，例如调度工作区的报告与附件路径。
- [D-005] Q: `session_create` 的 `prompt` 是否去掉目标工作区？ -> A: 去掉。`prompt` 只装任务请求，目标工作区由 `workspace_id` 参数表达。
- [D-006] Q: 用 `task_update` 记录的指令文字是否同样受约束？ -> A: 同口径遵守。
- [D-007] Q: 本次只改提示词，还是增加代码层过滤？ -> A: 只改提示词与测试断言，不做运行期文字过滤。
- [D-008] Q: 文档落点与残余风险的记录位置？ -> A: `docs/how-it-works.md` 同步新约束；「模型可能违反提示词约束」记入 `docs/known-risks.md`。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 约束靠提示词与测试固定，模型仍可能违反；用户原文含元信息时照转。 | Reason: 用户选择「都按推荐，免确认自行推进」。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 首个任务消息只写任务内容 (Priority: P1)

用户在飞书派发新任务，调度会话建立任务会话并把任务交过去。任务会话收到的首条消息只描述要做的事，任务会话从宿主提供的环境信息自行得知自己的工作区。

**Why this priority**: 大多数任务都走这条路径；首条消息里的元信息会影响整个任务会话的上下文。

**Independent Test**: 派发一个任务，检查任务会话收到的首条消息正文，确认其中没有工作区路径、模型路由与会话标识。

**Acceptance Scenarios**:

1. **Given** 用户派发一个任务且 `workspaces.json` 只有一个匹配工作区，**When** 调度会话用 `session_create` 建立会话，**Then** 首条消息正文只含任务请求，没有工作区路径或工作区 id。
2. **Given** 任务需要指定模型，**When** 调度会话用 `session_create` 传入 `provider` 与 `model`，**Then** 首条消息正文不写模型名，任务会话由宿主的模型变更提示得知路由变化。

---

### User Story 2 - 补充指令与回答只写指令本身 (Priority: P1)

用户给未结束任务追加指令，或回答任务会话提出的问题。调度会话把这段内容投递给任务会话，正文就是用户要表达的内容。

**Why this priority**: 补充指令是任务会话继续工作的主要输入，元信息会污染它的判断。

**Independent Test**: 追加一条指令，检查任务会话收到的消息正文与用户表达的内容一致。

**Acceptance Scenarios**:

1. **Given** 任务处于进行中，**When** 用户追加一条指令，**Then** 投递消息正文只含该指令。
2. **Given** 任务处于 `waiting_user`，**When** 用户回答问题，**Then** 投递消息正文只含该回答。

---

### User Story 3 - 失败后的重试消息不解释失败原因 (Priority: P2)

任务会话的上一轮失败，用户要求重试。调度会话把重试请求发给任务会话，正文只写要做什么。

**Why this priority**: 失败原因属于调度会话掌握的运维信息，写进任务会话会引出与任务无关的讨论。

**Independent Test**: 构造一次失败通知，让用户要求重试，检查投递消息正文。

**Acceptance Scenarios**:

1. **Given** 调度会话收到 `task_session_failure`，**When** 用户要求重试，**Then** 投递消息正文只含重试要做的事，没有失败原因或模型服务拦截的说明。

---

### User Story 4 - 切换模型只改路由并告知用户 (Priority: P2)

用户要求把任务会话的模型换成另一个。调度会话调用 `session_model`，并向用户说明新路由；任务会话不被通知。

**Why this priority**: 模型切换是调度会话一侧的动作，任务会话由宿主的模型变更提示得知。

**Independent Test**: 切换任务会话模型，检查任务会话收到的消息中没有切换通知。

**Acceptance Scenarios**:

1. **Given** 任务会话已存在，**When** 用户要求换模型，**Then** `session_model` 生效、用户收到新路由说明，任务会话没有收到新消息。

---

### User Story 5 - 重发请求只写要报告的内容 (Priority: P3)

任务上报没有说明当前状态或待确认点，调度会话请求任务会话重发一次报告。请求正文只写要报告的内容。

**Why this priority**: 重发请求是唯一一种调度会话主动发给任务会话的消息，同样不得夹带元信息。

**Independent Test**: 构造不清楚的上报，检查重发请求正文。

**Acceptance Scenarios**:

1. **Given** 一份既不说明任务状态也不含待确认点的上报，**When** 调度会话发出重发请求，**Then** 请求正文只含「报告当前状态与需要用户确认的点」。

---

### Edge Cases

- 用户在指令原文里自己提到工作区路径、模型名或失败原因时，这段文字作为用户内容照转。
- 任务需要读调度工作区的报告或附件时，具体文件路径照常给出。
- 任务会话在提问里问自己用的是哪个模型时，调度会话让任务会话自查，或把这问题告诉用户。
- 任务由 `session_manage` 接管，工作区由用户选定且调度会话不知情时，投递消息同样不写工作区。
- 任务恢复（`session_restore`）后的补充指令与普通补充指令同样处理。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 调度会话写入任务会话的每段文字 MUST 只表达该任务要做的事、用户的原话，或需要任务会话回答的问题。
- **FR-002**: 调度会话自己的措辞 MUST NOT 描述任务会话的模型路由、模型切换动作、上一轮失败原因、模型服务拦截、工作区标识、工作目录路径与会话 id。
- **FR-003**: 模型切换、失败原因与环境信息这些事实只在调度会话与用户之间流转。
- **FR-004**: `session_create` 的 `prompt` MUST 只装任务请求；目标工作区由 `workspace_id` 参数表达。
- **FR-005**: 用 `task_update` 的 `add_message` 记录的指令文字 MUST 与投递文字同口径遵守 FR-001 与 FR-002。
- **FR-006**: 调度会话通知用户时 MUST 继续表达任务、工作区与新路由这些调度会话自己掌握的事实。
- **FR-007**: 调度提示词 MUST 说明元信息的事实来源由宿主提供：会话在系统提示词里得知自己的工作目录，模型切换由宿主写入 `[model changed: ...]` 提示。
- **FR-008**: `docs/how-it-works.md` 的调度提示词段落 MUST 与新约束一致。
- **FR-009**: `tests/sa-dispatch.test.ts` MUST 用断言固定新约束，防止提示词回退。
- **FR-010**: 用户原文 MUST 照转，包括原文提到工作区、模型或失败原因的情况。
- **FR-011**: 任务需要的具体文件路径 MUST 照常给出，例如调度工作区的报告与附件路径。

### Key Entities

- **调度提示词**：`src/sa-dispatch/prompt.ts` 的 `SA_DISPATCH_PROMPT`，本次约束的落点。
- **任务会话消息**：`session_create` 的首条 `prompt` 与 `session_send` 的 `text`，两者都由调度模型书写。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 提示词中「Start a task」与「Add messages to a task」两段各含一条可断言的元信息约束，测试用例逐条命中。
- **SC-002**: 提示词全文不再出现 `its target workspace` 这类要求把工作区写进任务消息的文字。
- **SC-003**: `docs/how-it-works.md` 的调度提示词段落写出的约束与提示词逐条对应。
- **SC-004**: 派发、追加指令、重试、切换模型、重发请求五条路径各有一条验收场景可单独构造。

## Assumptions

- 宿主的系统提示词向每个会话给出自己的工作目录，调度会话无须重复。
- 宿主的模型选择在下一步写入 `[model changed: ...]` 提示，切换方无须重复。
- 本次约束靠提示词与测试固定，插件不做运行期文字过滤。

## 现状基线

1. 调度提示词的落点是 `src/sa-dispatch/prompt.ts` 的 `SA_DISPATCH_PROMPT`，由 `src/sa-dispatch/index.ts` 用 `ctx.systemPrompt.section` 注册。
2. 调度会话写入任务会话只有两条路径：`session_create` 的首条 `prompt`（`src/sa-dispatch/session-create.ts` 调用 `agent.steer`）与 meta-tools 的 `session_send`（模型写 `text`，插件在 `src/lark-super-agent/managed/dispatch-message.ts` 只做包装）。
3. 现状提示词第 35 行要求 `prompt` 写「this task's request and its target workspace」，第 37 行与第 61 行只限制了消息的来源，没有限制消息的元信息内容。
4. 宿主在模型切换后的下一步写入 `[model changed: ...]` 提示，见 `@deepseek-ai/dsh-agent` 的 `modelSwitchNotice`。
5. 会话的 `cwd` 由会话元信息给出，宿主的系统提示词包含当前工作目录。
6. 失败原因只出现在调度会话一侧的 `task_session_failure` 注入块。