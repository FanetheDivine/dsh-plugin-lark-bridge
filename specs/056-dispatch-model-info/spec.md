# Feature Specification: 调度会话模型信息查询工具

**Feature Branch**: `feat/056-dispatch-model-info`

**Created**: 2026-11-26

**Status**: Approved

**Input**: User description: "给调度会话增加一个「获取当前全部模型信息」的 tool（返回当前 DSH 中可用的全部 provider/model 等信息），使调度会话能查询所有可用模型，并可用于 session_create 的 provider/model 参数选择。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

none

## Clarifications

### Session 2026-11-26

- [D-001] Q: 新工具的名称用什么？ -> A: `list_models`。
- [D-002] Q: 返回信息包含哪些字段？ -> A: provider id、model id、该路由支持的 reasoning effort；不含显示名、描述等其他元数据。
- [D-004] Q: 宿主 llm 服务不可用时工具返回什么？ -> A: 返回指明模型目录暂不可用的错误。
- [D-005] Q: 工具是否需要查询参数？ -> A: 无参数，一次返回全部信息。
- [D-006] Q: 某个 provider 的模型目录查询失败时工具整体怎么表现？ -> A: 跳过该 provider，其余照常返回。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 单个 provider 目录失败被跳过时结果可能不完整，由结果内标注缓解（用户指示「继续执行即可」）

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 查询全部可用模型 (Priority: P1)

用户在飞书里问调度会话「当前有哪些模型可用」。调度会话调用 `list_models`，得到当前 DSH 中全部 provider 及其 model 清单，并把结果转述给用户。

**Why this priority**: 这是本功能的核心能力；没有查询结果，后续的模型选择都无从谈起。

**Independent Test**: 在调度会话中调用 `list_models`，能返回包含当前宿主全部 provider 与 model 的结构化结果，且与宿主实际可用模型一致。

**Acceptance Scenarios**:

1. **Given** 宿主模型服务正常，**When** 调度会话调用 `list_models`，**Then** 返回当前 DSH 全部可用 provider 及每个 provider 下的 model 列表与各路由支持的 reasoning effort。
2. **Given** 用户更换了模型配置或新增了 provider，**When** 调度会话再次调用 `list_models`，**Then** 返回更新后的清单，与宿主当前状态一致。

---

### User Story 2 - 为 session_create 选择模型 (Priority: P2)

用户要求「用某家 provider 的某个模型开一个任务会话」。调度会话先调用 `list_models`，确认 provider/model/effort 存在，再把它们作为 `session_create` 的 `provider`、`model`、`effort` 参数传入；用户给的目标模型不存在时，调度会话据实告知并给出可用选项。

**Why this priority**: 查询结果的直接用途；保证传给 `session_create` 的路由有效，避免会话创建后才失败。

**Independent Test**: 用 `list_models` 结果中的 provider/model 调用 `session_create` 能成功创建会话并应用该模型；用不存在的 model 调用时，调度会话在创建前即能识别。

**Acceptance Scenarios**:

1. **Given** 查询结果包含目标 provider/model，**When** 调度会话将其传给 `session_create`，**Then** 会话创建成功并使用该模型。
2. **Given** 查询结果不包含用户指定的 model，**When** 调度会话核对其请求，**Then** 不发起 `session_create`，并回复用户可用选项。

---

### User Story 3 - 查询失败时给出可理解结果 (Priority: P3)

宿主模型服务不可用或某个 provider 的目录查询失败时，调度会话调用 `list_models` 得到明确的结果：服务不可用收到错误；单个 provider 失败则其余照常返回并标注被跳过的 provider。调度会话据实转述，而不是收到含糊或看似完整的答案。

**Why this priority**: 异常路径，保证失败可感知、可重试，不影响主流程。

**Independent Test**: 在模型服务不可用的状态下调用 `list_models`，返回明确的错误信息；在单个 provider 目录失败的状态下调用，返回其余 provider 的结果并标注跳过项。

**Acceptance Scenarios**:

1. **Given** 宿主模型服务不可用，**When** 调度会话调用 `list_models`，**Then** 收到指明模型目录暂不可用的错误，工具不返回空清单冒充成功。
2. **Given** 某个 provider 的目录查询失败且其余正常，**When** 调度会话调用 `list_models`，**Then** 调用成功，结果包含其余 provider 并标注被跳过的 provider。

---

### Edge Cases

- 宿主没有任何已注册 provider 时，`list_models` 返回空清单。
- 某个 provider 存在但没有可选 model 时，结果中该 provider 的 model 列表为空。
- 模型目录在两次调用之间发生变化时，结果始终反映调用时刻的最新状态。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 调度会话 MUST 能通过名为 `list_models` 的工具查询当前 DSH 中全部可用的 provider 与 model 信息。
- **FR-002**: 返回结果 MUST 覆盖宿主当前已注册的全部 provider，及每个 provider 下的全部 model。
- **FR-003**: 每个 model 条目 MUST 包含 provider id、model id 与该路由支持的 reasoning effort id 列表。
- **FR-004**: 返回结果 MUST 采用结构化数据，字段取值可被 `session_create` 的 `provider`、`model`、`effort` 参数直接使用。
- **FR-005**: 工具 MUST 在每次调用时返回宿主的当前状态，不使用过期缓存。
- **FR-006**: 宿主 llm 服务不可用时，工具 MUST 返回指明模型目录暂不可用的错误。
- **FR-007**: 单个 provider 的目录查询失败时，工具 MUST 跳过该 provider 并在结果中标注跳过项，其余 provider 照常返回。
- **FR-008**: 工具不接受任何查询参数，一次调用返回全部信息。
- **FR-009**: 工具 MUST 仅在 SA-调度会话预设的会话中可用，注册方式与现有调度工具一致。

### Key Entities *(include if feature involves data)*

- **Provider**: DSH 中一个已注册的模型提供方，以 provider id 标识。
- **Model**: 某个 provider 下的一个可选模型，以 model id 标识，附带该路由支持的 reasoning effort id 列表。
- **模型目录**: 宿主维护的 provider 与 model 的全集，是本工具返回数据的唯一来源。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 调度会话一次 `list_models` 调用即可获得当前全部 provider/model 信息，无需多轮调用或人工补充。
- **SC-002**: 依据查询结果传入 `session_create` 的 provider/model/effort 组合全部有效，不出现因查询遗漏导致的无效路由。
- **SC-003**: 模型服务不可用时，调度会话在单次调用内得到明确的失败信息。
- **SC-004**: 单个 provider 目录失败时，调用仍返回其余 provider 的结果，且跳过项可被调度会话识别。

## Assumptions

- 宿主 llm 服务是模型目录的唯一数据源，插件只做读取与契约转换，不自行维护模型清单。
- 工具面向调度会话的 Agent 使用，飞书用户不直接调用工具。
- 返回结构中保留宿主原始 id 拼写，供 `session_create` 参数直接复用。
- 代码库探索确认：调度工具在 SA-调度会话预设作用域注册，新工具沿用同一注册路径即可满足 FR-009。
