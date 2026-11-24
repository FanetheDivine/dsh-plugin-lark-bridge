# Feature Specification: 覆写 session_create 套用工作会话模型

**Feature Branch**: `feat/046-session-create-override`

**Created**: 2026-11-24

**Status**: Waived

**Category**: 插件变更

**Input**: 「044 用 `AsyncLocalStorage`、`tools/execute` 包装与 `agent/created` 事件套用工作会话模型，与预期不符。改为本插件在 `SA-调度会话` 里提供自己的 `session_create`，覆盖 `dsh-plugin-meta-tools` 的同名工具，创建时直接使用配置页里的「工作会话模型」。」

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [D-001] Q: 套用方式？ -> A: `SA-调度会话` 提供自己的 `session_create`，创建时把「工作会话模型」作为默认的 provider、model、effort；不再监听 `tools/execute` 与 `agent/created`，不再使用 `AsyncLocalStorage`。
- [D-002] Q: 044 的旧实现如何处理？ -> A: 删除调用链标记、`tools/execute` 包装、`agent/created` 读标记与其测试；保留配置页、`workerProvider`、`workerModel`、`workerEffort` 与说明文案。
- [D-003] Q: 显式参数？ -> A: 调度会话传入的 provider、model、effort 优先；传入后校验失败照 meta-tools 报错，不回退。
- [D-004] Q: 配置不可用时？ -> A: 配置的 provider、model、effort 校验失败、`llm` 不可用或半组配置时，回退宿主默认并记警告，不阻断创建。
- [D-005] Q: 其余语义？ -> A: 工具名、参数、描述与返回值与 meta-tools 的 `session_create` 一致；其他十项 meta-tools 工具保持原样。
- [D-006] Q: 是否改动默认模型？ -> A: 不改。选择只写入新会话本身。
- [D-007] Q: meta-tools 自身的默认模型配置（`session_provider` 等）？ -> A: 本插件的 `SA-调度会话` 不设置它们。`session_create` 由本插件提供后，这组配置对该工具不再生效，用户改用「工作会话模型」。
- [D-008] Q: 本需求由谁审查？ -> A: 用户经调度会话下达完整需求，未逐项访谈，审查状态记为 Waived。

## Review Record

- 2026-11-24 | Decision: Waived | Scope: current full document | Open items: none | Risks: 需求来自调度会话转述，未经逐项确认；覆写依赖预设补丁关闭 meta-tools 的 `session_create`，见 plan

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 调度创建的工作会话使用配置的模型 (Priority: P1)

用户在「飞书任务与调度会话」配置页选好工作会话模型后，调度会话调用 `session_create` 创建的工作会话直接使用该 provider、模型与 effort。

**Why this priority**: 044 的实现与预期不符，本需求让行为落在工具本身。

**Independent Test**: 配置模型后，让调度会话调用 `session_create`，检查新会话记录的模型选择与首个请求使用的模型。

**Acceptance Scenarios**:

1. **Given** 已配置工作会话模型，**When** 调度会话调用 `session_create` 且未传模型参数，**Then** 新会话使用配置的 provider、模型与 effort。
2. **Given** 已配置工作会话模型，**When** 调度会话显式传入 provider、model 与 effort，**Then** 新会话使用显式值。
3. **Given** 未配置，**When** 调度会话创建工作会话，**Then** 新会话使用宿主默认模型。
4. **Given** 已保存配置，**When** 重启 DSH，**Then** 配置页仍显示该选择，创建行为不变。

---

### User Story 2 - 其余行为不受影响 (Priority: P1)

手动新建会话、宿主默认模型与 meta-tools 的其他工具保持原样。

**Independent Test**: 手动新建 `SA-工作会话`，读取宿主默认模型设置，调用其他 meta-tools 工具。

**Acceptance Scenarios**:

1. **Given** 已配置工作会话模型，**When** 用户手动新建会话，**Then** 新会话使用宿主默认模型。
2. **Given** 已配置工作会话模型，**When** 创建会话后，**Then** 宿主默认模型设置不变。
3. **Given** `SA-调度会话`，**When** 列出其工具，**Then** `session_create` 只有一个，其余十项 meta-tools 工具仍在。

## Edge Cases

- 只设置了 provider 或模型之一时按未配置处理。
- 配置的模型已下线或 effort 不属于该模型时，回退宿主默认并记警告，会话照常创建。
- 显式传入只有 effort 或只有 provider 时，报参数错误，与 meta-tools 一致。
- 调度会话并行创建多个工作会话，每个都使用配置的模型。
- 调度会话未传 `agent_preset` 时，预设为 `sa-worker`；不可用时回退宿主默认预设。
- 配置保存后无需重启，下一次调用生效。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `SA-调度会话` MUST 提供 `session_create` 工具，名称、参数、描述与返回值与 meta-tools 的 `session_create` 一致，且该预设内只存在一个 `session_create`。
- **FR-002**: 未传 provider、model、effort 时，工具 MUST 使用「工作会话模型」创建会话，使新会话的第一次模型请求即使用该模型。
- **FR-003**: 传入显式 provider、model 或 effort 时，工具 MUST 以显式值为准，并按 meta-tools 的规则校验与报错。
- **FR-004**: 配置的模型校验失败、`llm` 不可用或配置不完整时，工具 MUST 回退宿主默认并记录警告，不阻断创建。
- **FR-005**: 工具 MUST NOT 修改宿主默认模型或其他会话的模型。
- **FR-006**: 仓库 MUST 删除 044 的 `AsyncLocalStorage` 标记、`tools/execute` 包装、`agent/created` 监听与对应测试，不与新实现并存。
- **FR-007**: 配置页、`workerProvider`、`workerModel`、`workerEffort` 与说明文案 MUST 保持。
- **FR-008**: 预设补丁 MUST 关闭 meta-tools 的 `session_create`，其余十项工具保持开启。
- **FR-009**: 保存配置后 MUST 无需重启即对下一次调用生效。

### Key Entities

- **工作会话模型**：`lark-super-agent` 行的三个可选字符串 `workerProvider`、`workerModel`、`workerEffort`。provider 与模型成对才成立，effort 只在成对时生效。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 配置后，调度会话未显式传模型时创建的工作会话 100% 使用该模型。
- **SC-002**: 未配置时，创建行为与 044 之前一致。
- **SC-003**: 仓库不再引用 `AsyncLocalStorage`、`tools/execute` 监听与 `agent/created` 监听。

## Assumptions

- 工作会话的预设仍由预设补丁固定为 `sa-worker`。
- 补丁每次加载按组合层生效，改动随插件升级到达已安装的 profile。
