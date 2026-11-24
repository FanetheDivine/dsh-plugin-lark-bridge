# Feature Specification: 工作会话模型配置

**Feature Branch**: `feat/044-worker-session-model`

**Created**: 2026-11-24

**Status**: Waived

**Input**: User description: "在「飞书任务与调度会话」配置页新增 SA-调度会话创建工作会话时所用的模型和 effort 配置，交互与「用飞书和DSH对话」配置页的模型选择一致。"

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [D-001] Q: 配置放在哪里？ -> A: 「飞书任务与调度会话」行的配置页，新增「工作会话模型」一项。
- [D-002] Q: 选择交互与数据来源？ -> A: 复用「用飞书和DSH对话」配置页的官方 `ModelSelect`、模型目录与草稿持久化，provider、模型与 effort 在同一个选择器中联动。
- [D-003] Q: 页面如何区分两种模型？ -> A: 说明文字写明此处配置工作会话；调度会话自身的模型在「用飞书和DSH对话」配置页的「模型」。
- [D-004] Q: 何时生效？ -> A: `SA-调度会话` 经 `session_create` 创建 `SA-工作会话` 时，新会话使用该模型。
- [D-005] Q: 未配置或配置不可用时？ -> A: 保持原有默认行为：新会话使用宿主默认模型，不阻断创建。
- [D-006] Q: 调度会话显式传入 provider、model 或 effort 时？ -> A: 显式参数优先。
- [D-008] Q: 如何精确识别调度会话创建的会话？ -> A: 按 `session_create` 的异步调用链识别，不用时间窗口；无法识别时不生效。
- [D-009] Q: 是否改动默认模型？ -> A: 不改。选择只写入新会话本身，宿主默认模型与「用飞书和DSH对话」配置页的模型保持原样。
- [D-007] Q: 本需求由谁审查？ -> A: 用户经调度会话下达完整需求，未逐项访谈，审查状态记为 Waived。

## Review Record

- 2026-11-24 | Decision: Waived | Scope: current full document | Open items: none | Risks: 需求来自调度会话转述，未经逐项确认；同一配置页另有分支 043 同时修改，合并时需处理冲突

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 为工作会话指定模型 (Priority: P1)

用户在「飞书任务与调度会话」配置页选择工作会话使用的 provider、模型与 effort，保存后调度会话新建的工作会话都使用它。

**Why this priority**: 调度会话适合用便宜或快速的模型，工作会话需要更强的模型。

**Independent Test**: 配置模型后，让调度会话调用 `session_create` 创建 `SA-工作会话`，检查新会话记录的模型选择。

**Acceptance Scenarios**:

1. **Given** 已配置模型与 effort，**When** 调度会话创建工作会话，**Then** 新会话使用该模型与 effort。
2. **Given** 已保存配置，**When** 重启 DSH，**Then** 配置页仍显示该选择且创建行为不变。
3. **Given** 调度会话显式传入 provider 与 model，**When** 创建工作会话，**Then** 新会话使用显式值。

---

### User Story 2 - 区分调度会话与工作会话的模型 (Priority: P2)

用户在配置页读到说明，知道这里配置的是工作会话的模型，调度会话自身的模型在另一个配置页。

**Why this priority**: 两个配置页各有一个模型选择，用户容易配错。

**Independent Test**: 打开配置页，检查标签与说明文字。

**Acceptance Scenarios**:

1. **Given** 打开「飞书任务与调度会话」配置页，**When** 查看模型项，**Then** 标签为「工作会话模型」，说明指向「用飞书和DSH对话」配置页的「模型」。

---

### Edge Cases

- 未配置时，工作会话沿用宿主默认模型。
- 配置的模型已下线或 effort 不属于该模型时，创建照常进行并按宿主默认模型运行，宿主日志记录警告。
- 只设置了 provider 或模型之一时按未配置处理。
- 选择器切换模型后，不属于新模型的 effort 被清除。
- 非调度会话创建的 `SA-工作会话`（用户手动新建、恢复历史会话）不受影响。
- 调度会话并行创建多个工作会话时，每个都使用该模型。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 「飞书任务与调度会话」配置页 MUST 提供「工作会话模型」选择器，可选 provider、模型与 effort。
- **FR-002**: 选择器 MUST 复用「用飞书和DSH对话」配置页的官方模型选择器与模型目录，effort 选项 MUST 只含所选模型支持的取值。
- **FR-003**: 配置页 MUST 说明此处是工作会话的模型，调度会话自身的模型在「用飞书和DSH对话」配置页的「模型」。
- **FR-004**: 配置 MUST 随该行的配置保存，重启后保留。
- **FR-005**: 调度会话经 `session_create` 创建 `SA-工作会话` 时，新会话 MUST 使用已配置的模型与 effort。
- **FR-006**: 未配置或配置不完整时，创建行为 MUST 与未引入本功能时一致。
- **FR-007**: 配置的 provider、模型与 effort 在创建时 MUST 经宿主校验；校验失败 MUST 回退宿主默认并记录警告，不阻断创建。
- **FR-008**: 调度会话传入显式 provider、model 或 effort 时 MUST 以显式值为准。
- **FR-009**: 保存后 MUST 无需重启即对下一次创建生效。
- **FR-010**: 配置页文案 MUST 提供中文与英文。

### Key Entities

- **工作会话模型**：`lark-super-agent` 行的三个可选字符串 `workerProvider`、`workerModel`、`workerEffort`。provider 与模型成对才成立，effort 只在成对时生效。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 配置后，调度会话创建的工作会话 100% 使用该模型。
- **SC-002**: 未配置时，创建工作会话的行为与现状一致。

## Assumptions

- 工作会话的预设仍由 `cordis.patch.yml` 的 `session_preset: sa-worker` 固定。
