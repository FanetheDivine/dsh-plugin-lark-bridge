# Feature Specification: 修复桥接会话创建请求

**Feature Branch**: `fix/034-session-create-request`

**Created**: 2026-11-21

**Status**: Approved

**Input**: User description: "我安装了最新的插件 但是我发消息dsh没新会话"

## Open Decisions

| ID | 问题 | 建议 | 理由 | 依赖 | 状态 |
| --- | --- | --- | --- | --- | --- |
| D-004b | 真实宿主验证是否执行 | 不执行，记录为豁免风险 | 用户明确选择不验证；单元测试覆盖请求形状 | none | answered |

## Clarifications

### Session 2026-11-21

- [D-001] Q: 新建桥接会话时向宿主传 workspaceId 还是 cwd？ -> A: 只传 workspaceId，由宿主按注册工作区路径创建并挂载会话。
- [D-002] Q: 预设与模型怎么落地？ -> A: 预设随创建请求传入；模型先经 `llm.resolveCallConfig` 校验，创建后写入 `agent.model.select`。
- [D-003] Q: 创建失败的告知渠道是否维持只写宿主日志？ -> A: 维持只写宿主日志，界面不暴露插件内部错误。
- [D-004] Q: 本缺陷的验证范围？ -> A: 以创建请求形状的单元测试验收，不新增 lark-cli 事件通道。
- [D-004b] Q: 是否在真实宿主上验证？ -> A: 不验证，用户豁免。
- [D-005] Q: 状态文件指向已归档会话时是否保留旧记录？ -> A: 保留旧记录，新会话创建成功后覆盖。
- [D-006] Q: 未使用的 `lastError` 怎么处理？ -> A: 保留现状，删除属于独立清理。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 已失败批次的消息不会重投；宿主缺少 sessionController 时走 agents.create 分支
- 2026-11-21 | Decision: Approved | Scope: current full document after the D-004 verification change | Open items: none | Risks: 未在真实宿主验证；已失败批次的消息不会重投；宿主缺少 sessionController 时走 agents.create 分支

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 归档旧会话后收到消息能新建会话 (Priority: P1)

用户归档了上一次的桥接会话，随后在飞书私聊机器人发送一条消息。插件新建桥接会话，把消息注入该会话，会话出现在桥接工作区。

**Why this priority**: 没有新会话就没有任何注入，插件对用户完全失效。

**Independent Test**: 让状态文件指向一个已归档会话，投递一条 owner 私聊消息，检查桥接工作区新增会话且消息已注入。

**Acceptance Scenarios**:

1. **Given** 状态文件指向已归档会话，**When** 收到 owner 私聊消息，**Then** 插件新建会话并注入该消息。
2. **Given** 状态文件指向可恢复会话，**When** 收到 owner 私聊消息，**Then** 插件复用该会话且不新建。

---

### User Story 2 - 新会话沿用配置的预设与模型 (Priority: P2)

新建的桥接会话按配置使用预设与模型；配置不可用时按宿主默认运行并记录警告。

**Why this priority**: 用户配置了固定预设与模型，新建会话必须与配置一致。

**Independent Test**: 配置可用预设与模型后触发新建，检查新会话记录的预设与模型选择。

**Acceptance Scenarios**:

1. **Given** 配置了可用预设与模型，**When** 插件新建会话，**Then** 新会话使用该预设与模型。
2. **Given** 配置的预设或模型不可用，**When** 插件新建会话，**Then** 会话按宿主默认创建并记录警告，消息照常注入。

---

### User Story 3 - 创建失败可从宿主日志定位 (Priority: P3)

新建会话失败时，维护者从宿主日志看到失败原因与本次批次的消息标识，监听继续运行。

**Why this priority**: 本次缺陷只能靠日志定位，缺少日志会延长排查时间。

**Independent Test**: 构造宿主拒绝创建请求的条件，检查日志内容与监听状态。

**Acceptance Scenarios**:

1. **Given** 宿主拒绝创建请求，**When** 注入批次，**Then** 日志含失败原因与该批消息标识，监听继续运行。

---

### Edge Cases

- 状态文件缺失或工作区路径变化时，插件新建会话。
- 会话创建成功、注入前失败时，状态文件保持原值。
- 同一静默窗口内收到多条消息，插件只创建一次会话。
- 工作区未注册或目录不可访问时，注入失败并记录原因。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 新建桥接会话 MUST 只向宿主传已注册工作区标识，不传目录。
- **FR-002**: 使用宿主创建结果时 MUST 采用返回的会话标识。
- **FR-003**: 新建会话 MUST 应用配置的预设与模型、写入固定标题、挂到注册工作区并置顶。
- **FR-004**: 状态文件 MUST 只在新建成功后写入会话标识、工作区路径与标题。
- **FR-005**: 会话不可恢复或已归档时 MUST 新建会话。
- **FR-006**: 创建失败 MUST 只记录宿主日志并保持事件监听。
- **FR-007**: 同一批消息 MUST 只触发一次会话创建。
- **FR-008**: 恢复已有会话 MUST 保持原有模型与预设。
- **FR-009**: 配置的预设 MUST 随创建请求传给宿主；配置的模型 MUST 在校验通过后写入新会话，且不改变宿主默认模型。

### Key Entities

- **桥接状态文件**：会话标识、归一化工作区路径、标题与去重窗口。
- **桥接会话**：飞书消息注入的目标会话，带固定标题与置顶属性。
- **注册工作区**：宿主注册表中与桥接配置路径一致的目录。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 归档旧桥接会话后发送一条 owner 私聊消息，60 秒内桥接工作区出现标题为固定标题的置顶会话，消息以 `lark-bridge` 来源的用户消息落盘。
- **SC-002**: 配置可用预设与模型时，新会话的预设与模型记录与配置一致。
- **SC-003**: 创建请求只包含一个定位字段，可由单元测试断言请求形状。
- **SC-004**: 创建失败时宿主日志包含失败原因与批次消息标识。

## Assumptions

- 宿主为 `0.2.2-rc.5`，`sessionController.create` 要求 `workspaceId` 与 `cwd` 互斥。
- 桥接工作区已在宿主注册且目录可访问。
- 插件只处理 owner 的私聊消息。