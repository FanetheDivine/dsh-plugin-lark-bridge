# Feature Specification: 调度会话更名与任务类型模型配置

**Feature Branch**: `feat/054-dispatch-task-type-models`

**Created**: 2026-11-26

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "“飞书任务与调度会话” 更名为 “调度会话” desc改为“用调度会话统一管理其他任务会话”
session_create增加任务类型 common/complex 要求调度会话在用户未要求时总是传空值(即 按默认值)。任务会话模型改为两个配置：普通任务模型/复杂任务模型 且允许用户设置哪种任务是默认任务。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

无。

## Clarifications

### Session 2026-11-26

- [D-001] Q: `session_create` 的显式模型参数 `provider`、`model`、`effort` 是否保留？ -> A: 保留 `provider`、`model`、`effort` 参数，显式传入时优先于任务类型对应的模型。
- [D-002] Q: 默认任务类型的初始默认值及配置页设置方式？ -> A: 初始默认为 `common`（普通任务）；在「普通任务模型」与「复杂任务模型」标题旁显示「默认」/「设为默认」切换。
- [D-003] Q: 所选任务类型对应的模型未配置时如何回退？ -> A: 直接使用宿主默认模型，不在普通任务模型与复杂任务模型之间互相回退。
- [D-004] Q: 任务类型是否写入 `message-task-status.json` 的任务记录或 `session_create` 返回值？ -> A: 仅在 `session_create` 创建会话时用于选择模型，不写入任务记录，也不改变返回值。
- [D-005] Q: `session_create` 描述对任务类型与 `provider`/`model`/`effort` 的说明要求？ -> A: 说明任务类型对应用户预先设定的模型配置，而 `provider`/`model`/`effort` 会将其覆盖；除非用户明确说明，否则都不需要传（传空值/省略）。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document（补充 D-005 后用户授权自行推进后续阶段、PR、合并与 release） | Open items: none | Risks: 旧配置键 `taskProvider`、`taskModel`、`taskEffort` 不迁移

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 行更名为「调度会话」并配置普通/复杂任务模型与默认任务类型 (Priority: P1)

用户在插件页看到 `lark-super-agent` 行的标题为「调度会话」，描述为「用调度会话统一管理其他任务会话」。在该行配置页，用户分别设置「普通任务模型」与「复杂任务模型」，并通过模型标题旁的「默认」/「设为默认」控件设置哪种任务类型作为默认任务。

**Why this priority**: 配置项与文案是用户设置分档任务模型和理解调度会话职责的入口。

**Independent Test**: 打开插件页与「调度会话」配置页，确认标题与描述文案已更新，能够分别选择并保存普通任务模型、复杂任务模型以及切换默认任务类型，刷新后配置保持不变。

**Acceptance Scenarios**:

1. **Given** 用户打开插件页，**When** 查看 `lark-super-agent` 行，**Then** 标题显示为「调度会话」，描述显示为「用调度会话统一管理其他任务会话」。
2. **Given** 用户首次打开「调度会话」配置页，**When** 查看两个任务模型配置项，**Then** 「普通任务模型」标记为「默认」，「复杂任务模型」标题旁显示「设为默认」按钮。
3. **Given** 用户在「调度会话」配置页，**When** 分别设置「普通任务模型」、「复杂任务模型」并点击「设为默认」将默认任务切换为复杂任务后保存，**Then** 配置持久化保存并即时生效。

---

### User Story 2 - 调度会话创建任务会话时按任务类型或默认类型选择模型 (Priority: P1)

用户向调度会话派发任务。当用户未指定任务类型与具体模型时，调度会话调用 `session_create` 不传或传空值，插件按用户配置的默认任务类型选择对应模型创建会话；当用户明确指定普通任务或复杂任务时，调度会话传入 `common` 或 `complex`，插件按指定任务类型对应的模型创建会话；当用户明确要求特定模型并传入 `provider`、`model`、`effort` 时，显式模型参数覆盖任务类型的预设模型。

**Why this priority**: 让不同复杂度的任务使用各自匹配的模型，同时在用户未声明时遵循用户设定的默认类型。

**Independent Test**: 分别配置不同的普通任务模型和复杂任务模型；在未指定任务类型、`common`、`complex` 以及显式传 `provider`/`model` 四种情况下调用 `session_create`，验证新建会话使用的模型与配置一致。

**Acceptance Scenarios**:

1. **Given** 默认任务类型已设置且对应模型已配置，**When** 用户未要求任务类型、调度会话调用 `session_create` 传空值或省略任务类型，**Then** 新建会话使用默认任务类型对应的模型。
2. **Given** 普通任务模型与复杂任务模型已配置，**When** 用户明确要求普通任务或复杂任务、调度会话调用 `session_create` 传入 `common` 或 `complex`，**Then** 新建会话使用所传任务类型对应的模型。
3. **Given** 普通任务模型与复杂任务模型已配置，**When** 调用 `session_create` 显式传入 `provider` 与 `model`，**Then** 新建会话使用显式传入的模型覆盖任务类型模型配置。
4. **Given** 调度会话提示词与 `session_create` 工具说明已加载，**When** 查看描述，**Then** 明确说明任务类型对应用户预先设定的模型配置，`provider`/`model`/`effort` 会覆盖该配置，除非用户明确说明否则都不传（传空值）。

### Edge Cases

- 所选任务类型（或默认任务类型）对应的模型未配置或校验失败时，新建会话直接使用宿主默认模型，不在普通任务模型与复杂任务模型之间互相回退。
- `session_create` 收到 `common`、`complex` 与空值以外的非法任务类型时，工具返回参数校验错误且不创建会话。
- 显式传入的 `provider` 与 `model` 不成对或校验失败时，保持现有报错行为且不创建会话。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `lark-super-agent` 行元数据、配置页文案与文档 MUST 将「飞书任务与调度会话」更名为「调度会话」，行描述改为「用调度会话统一管理其他任务会话」，并同步更新英文资源。
- **FR-002**: 「调度会话」配置页 MUST 将单一「任务会话模型」拆分为「普通任务模型」与「复杂任务模型」两个独立模型选择器。
- **FR-003**: 「调度会话」配置页 MUST 在「普通任务模型」与「复杂任务模型」标题旁提供默认任务类型切换（当前默认项显示「默认」，另一项显示「设为默认」），初始默认任务类型为 `common`（普通任务）。
- **FR-004**: `session_create` 工具 MUST 新增可选任务类型参数，支持 `common`、`complex` 及空值（省略或空串表示使用默认任务类型），同时保留显式 `provider`、`model`、`effort` 参数。
- **FR-005**: `session_create` 工具描述与 `SA-调度会话` 提示词 MUST 说明：任务类型对应用户预先设定的普通/复杂任务模型配置，`provider`、`model`、`effort` 则将其覆盖；除非用户明确要求，否则任务类型（传空值）与 `provider`、`model`、`effort` 都不传。
- **FR-006**: `session_create` 创建会话时的模型优先级 MUST 为：显式 `provider`/`model`/`effort` 参数 > 任务类型（为空时取配置的默认任务类型）对应的配置模型 > 宿主默认模型；对应任务类型的模型未配置或校验失败时，直接使用宿主默认模型，不在两种任务模型之间互相回退。
- **FR-007**: 任务类型 MUST 仅在 `session_create` 创建会话时用于解析模型，不写入 `message-task-status.json` 的任务记录，也不改变 `session_create` 的返回结构。

### Key Entities

- **任务类型**: 区分任务复杂度的枚举，取值为 `common`（普通任务）或 `complex`（复杂任务）。
- **普通任务模型**: 任务类型为 `common` 时新建任务会话所用的模型与推理等级配置。
- **复杂任务模型**: 任务类型为 `complex` 时新建任务会话所用的模型与推理等级配置。
- **默认任务类型**: 用户设置的默认任务类型（`common` 或 `complex`，默认 `common`），当 `session_create` 任务类型为空时生效。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 元数据、前端字典与文档中，原「飞书任务与调度会话」标题及描述全部更新为「调度会话」与「用调度会话统一管理其他任务会话」。
- **SC-002**: `session_create` 在传入 `common`、`complex`、空值及显式模型参数时，100% 按优先级和对应配置解析出目标模型。
- **SC-003**: 现有测试与新增测试全部通过，`pnpm check` 无错误。

## Assumptions

- 旧配置键 `taskProvider`、`taskModel`、`taskEffort` 不迁移、不兼容读取（沿用 spec 053 D-012 / FR-034 惯例）。
- 「任务会话预设」与「调度会话自身的模型」配置保持现有行为不变。
- 仅在 `session_create` 创建新会话时按任务类型选择模型；手动管理已有会话时不改变已有会话的模型。
