# Feature Specification: 任务会话预设移除 SA-调度会话 选项

**Feature Branch**: `feat/058-task-preset-options`

**Created**: 2026-11-26

**Status**: Waived

**Input**: User description: "「任务会话预设」配置项的可选项里不要出现「SA-调度会话」。找到该配置项的定义和选项来源，移除「SA-调度会话」，使它不再出现在可选项中。同时检查已保存的配置、默认值和其他引用该选项的代码，确保移除后不会报错，也不会让已保存的配置失效。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

无。需求已由用户给出完整验收标准：可选项移除、已保存配置不失效、不报错。

## Clarifications

### Session 2026-11-26

- 无待确认问题。需求描述已包含范围（仅「任务会话预设」）、行为（可选项移除）与约束（已保存配置保持有效）。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 已保存 `taskPreset = sa-dispatch` 的用户会看到当前值显示为「不可用」禁用项，属预期表现。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 任务会话预设可选项不含调度会话 (Priority: P1)

用户打开「调度会话」配置页，展开「任务会话预设」下拉，可选项列表中不出现 `SA-调度会话`，其余宿主预设照常列出。

**Why this priority**: 这是需求的直接目标。

**Independent Test**: 打开「调度会话」配置页并展开「任务会话预设」菜单，检查菜单项列表。

**Acceptance Scenarios**:

1. **Given** 宿主名册中存在 `SA-调度会话`，**When** 展开「任务会话预设」菜单，**Then** 菜单中不出现 `SA-调度会话`。
2. **Given** 宿主名册中存在其他预设，**When** 展开「任务会话预设」菜单，**Then** 其他预设照常列出且可选择。

---

### User Story 2 - 其他预设选择器不受影响 (Priority: P2)

「用飞书和DSH对话」配置页的「预设」选择器行为保持不变，`SA-调度会话` 仍是可选项且保持默认选中。

**Why this priority**: 移除只作用于「任务会话预设」，桥接会话预设不能被误伤。

**Independent Test**: 打开「用飞书和DSH对话」配置页，检查「预设」菜单仍列出 `SA-调度会话`。

**Acceptance Scenarios**:

1. **Given** 宿主名册中存在 `SA-调度会话`，**When** 展开「用飞书和DSH对话」的「预设」菜单，**Then** `SA-调度会话` 仍在可选项中。

---

### User Story 3 - 已保存配置继续生效 (Priority: P3)

用户此前已把「任务会话预设」保存为 `SA-调度会话`。升级后配置读取不报错，新建任务会话仍使用该预设；选择器把已存值显示为禁用的「不可用」项，不静默丢弃或改写已存值。

**Why this priority**: 用户明确要求已保存配置不失效。

**Independent Test**: 在配置中预置 `taskPreset = sa-dispatch`，打开配置页并新建任务会话，检查显示与创建结果。

**Acceptance Scenarios**:

1. **Given** 已保存 `taskPreset = sa-dispatch`，**When** 打开「调度会话」配置页，**Then** 配置读取不报错，选择器显示该值并标注不可用，菜单中该值为禁用项。
2. **Given** 已保存 `taskPreset = sa-dispatch`，**When** 调度会话新建任务会话，**Then** 新会话仍使用 `sa-dispatch` 预设。
3. **Given** 未保存过 `taskPreset`，**When** 打开配置页，**Then** 显示跟随宿主默认，行为与现状一致。

### Edge Cases

- 已存值是被移除的预设时，菜单以禁用项补足该值，用户可保留也可改选其他预设。
- 名册读取失败或宿主预设服务缺失时，选择器沿用现有的加载失败与禁用表现，不因移除逻辑产生新错误。
- 宿主名册不存在 `sa-dispatch` 时，移除逻辑无副作用。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 「调度会话」配置页的「任务会话预设」可选项 MUST 不包含标识为 `sa-dispatch` 的预设。
- **FR-002**: 「用飞书和DSH对话」配置页的「预设」可选项 MUST 保持包含全部宿主预设，含 `sa-dispatch`。
- **FR-003**: 已保存 `taskPreset = sa-dispatch` 时，配置读取、展示与 `session_create` 的新建会话行为 MUST 与现状一致，已存值 MUST NOT 被改写或清除。
- **FR-004**: `taskPreset` 的默认值 MUST 保持为空串，空值仍表示跟随宿主默认。
- **FR-005**: 名册读取失败、宿主预设服务缺失、名册无 `sa-dispatch` 三种情形 MUST 保持现有表现。

### Key Entities *(include if feature involves data)*

- **`taskPreset` 配置字段**: 「调度会话」行配置中的字符串，空值跟随宿主默认；本次变更只影响配置页可选项列表，不改变字段本身。
- **宿主预设名册**: 远程预设服务返回的预设列表；「任务会话预设」在展示层过滤其中一项。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 展开「任务会话预设」菜单时，可选项中 100% 不出现 `SA-调度会话`。
- **SC-002**: 「用飞书和DSH对话」的「预设」菜单仍列出 `SA-调度会话`。
- **SC-003**: 已保存 `taskPreset = sa-dispatch` 的配置在升级后读取与新建任务会话均不报错，且预设仍为 `sa-dispatch`。
- **SC-004**: 全部现有测试与新增测试通过，`check` 与 `test:code` 无失败。

## Assumptions

- 移除在插件前端展示层按预设标识 `sa-dispatch` 过滤实现，不依赖宿主名册的显示名。
- 「任务会话预设」的选项来源与「预设」相同，均为宿主预设名册；差异只在于本配置页多过滤一项。
- 后端 `session_create` 读取 `taskPreset` 的路径保持不变。
