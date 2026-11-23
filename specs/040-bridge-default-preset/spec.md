# Feature Specification: 桥接会话默认预设

**Feature Branch**: `feat/040-bridge-default-preset`

**Created**: 2026-11-23

**Status**: Draft

**Input**: User description: "把dsh-plugin-lark-bridge的“预设”配置 默认值改为sa-调度会话"

## Open Decisions

无。

## Clarifications

### Session 2026-11-23

- [D-001] Q: 默认值写入预设 id 还是显示名？ -> A: 写入预设 id `sa-dispatch`，与 `cordis.patch.yml` 的 `preset-sa-dispatch` 一致。
- [D-002] Q: 配置页是否保留清空为「跟随宿主默认」的选项？ -> A: 移除。菜单只列可用预设；空值保留为运行时的宿主默认回退与旧配置遗留。
- [D-003] Q: 已保存预设值的现有配置如何处理？ -> A: 保持原值，包括空值与 `sa-worker`，升级不改写。
- [D-004] Q: 测试范围？ -> A: 不做实机验证；只把断言当前默认值的现有测试更新为新默认值，不新增用例。

### 探索发现

- 配置项 `sessionPreset` 的缺省值定义在两处：`src/config.ts` 的 `Config` schema 与 `DEFAULT_CONFIG`。
- `cordis.patch.yml` 的主行不写 `sessionPreset`，缺省值由 schema 提供。
- 配置页表单初始值来自宿主传入的配置；用户保存后会在 profile 的 `cordis.patch.yml` 写入 `sessionPreset`。
- `presetOf` 把空白视为未配置，`resolvePreset` 在名册缺失、读取失败或候选不可用时回退宿主默认并记录警告。
- `tests/plugin.test.ts` 断言缺省值为空串；`tests/client.test.ts`、`tests/config-form.test.ts`、`tests/preset-defaults.test.ts`、`tests/sessions.test.ts` 使用显式预设值或空值。
- `README.md` 第 47 行要求用户把预选手动选为 `SA-调度会话`；`docs/known-risks.md` 第 140 行有同样的手动步骤说明。
- 宿主文本字段把空文本当作清除；保存后值回到 schema 缺省值，默认值生效后清空项失去效果。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 已有用户保持旧预设；预设行停用时回退宿主默认；配置页首屏默认值取决于宿主对 schema 缺省值的传递，计划阶段验证

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新装后直接使用调度预设 (Priority: P1)

用户安装本插件并完成飞书授权，从未保存过预设配置。用户打开配置页，预设已选中 `SA-调度会话`；用户直接发送飞书私聊消息，桥接会话以该预设创建。

**Why this priority**: 默认值决定开箱行为，是本次变更的全部价值。

**Independent Test**: 在未保存过配置的新 profile 中启用插件，打开配置页，再从飞书发送一条消息，检查新建会话的预设。

**Acceptance Scenarios**:

1. **Given** 插件已安装且用户未保存过预设，**When** 打开配置页，**Then** 预设选择器显示 `SA-调度会话`。
2. **Given** 插件已安装且用户未保存过预设，**When** 用户从飞书发送消息，**Then** 新建的桥接会话使用 `SA-调度会话`。

---

### User Story 2 - 用户仍可改用其他预设 (Priority: P2)

用户希望桥接会话使用别的预设，或交回宿主的默认选择。

**Why this priority**: 默认值改变不应剥夺用户的选择权。

**Independent Test**: 在配置页改选另一个预设并保存，发送消息后检查新会话预设。

**Acceptance Scenarios**:

1. **Given** 默认预设为 `SA-调度会话`，**When** 用户在配置页改选其他预设并保存，**Then** 新建桥接会话使用所选预设。
2. **Given** 默认预设为 `SA-调度会话`，**When** 用户打开预设菜单，**Then** 菜单只列出宿主名册中的可用预设，没有清空项。

### Edge Cases

- 默认预设未出现在宿主预设名册中时，新建会话回退宿主默认并记录警告。
- 宿主不提供预设名册服务时，新建会话回退宿主默认。
- 用户升级前已保存空值时，界面显示「跟随宿主默认」，新建会话跟随宿主默认；改选任一预设后退出该状态。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件配置的 `sessionPreset` 缺省值 MUST 为 `sa-dispatch`，对应 `SA-调度会话`。
- **FR-002**: 用户未保存过预设时，配置页预设选择器 MUST 显示 `SA-调度会话`。
- **FR-003**: 用户未保存过预设时，新建桥接会话 MUST 使用 `SA-调度会话`。
- **FR-004**: 用户 MUST 能改选名册中的其他预设，新建会话使用所选预设。
- **FR-005**: 配置页预设菜单 MUST 只列出名册中的可用预设，不提供清空为「跟随宿主默认」的选项。
- **FR-006**: 已保存预设值的配置 MUST 保持原值，升级不改写用户的选择。
- **FR-007**: 预设不可用或名册不可读时，新建会话 MUST 回退宿主默认，并记录警告。
- **FR-008**: README 与已知风险文档 MUST 删除「手动把预设选为 `SA-调度会话`」的要求。

### Key Entities

- **预设配置项**：新建桥接会话使用的预设标识；空值表示跟随宿主默认。
- **预设名册**：宿主提供的可用预设列表，配置页据此展示选项，会话据此校验候选。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 未保存过配置的新 profile 中，配置页预设选择器首屏显示 `SA-调度会话`，无需用户操作。
- **SC-002**: 未保存过配置的新 profile 中，用户从飞书发送一条消息即可得到 `SA-调度会话` 创建的会话。
- **SC-003**: 已保存空值或其他预设的配置升级后，配置页显示与新建会话行为保持一致。

## Assumptions

- `SA-调度会话` 的预设标识为 `sa-dispatch`，与 `cordis.patch.yml` 的 `preset-sa-dispatch` 声明一致。
- `cordis.patch.yml` 不写 `sessionPreset`，缺省值由插件配置 schema 提供。
- 显式保存空值的旧配置继续显示「跟随宿主默认」，新建会话跟随宿主默认。
- 本次变更不涉及版本发布与范围外的配置项。
