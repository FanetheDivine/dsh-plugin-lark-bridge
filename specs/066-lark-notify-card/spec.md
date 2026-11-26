# Feature Specification: lark_notify 正文卡片与上报卡片正文色

**Feature Branch**: `feat/066-lark-notify-card`

**Created**: 2026-11-26

**Status**: Draft

**Change Category**: 插件变更

**Input**: User description: "为lark_notify增加与send_report类似的特殊ui。上报的ui也要改下，要和正文一样是黑色。本次只改ui，lark-notify的ui只展示输出的文本。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-001] Q: `lark_notify` 正文按什么形态呈现？ -> A: 按纯文本保留换行，与用户在飞书收到的内容一致。
- [D-002] Q: 是否显示发送回执、分段数或 `messageId`？ -> A: 不显示。通知 UI 只展示输出的文本。
- [D-003] Q: 是否修改调度提示词、桥接提醒与在场提醒？ -> A: 不修改。本次只改 UI。
- [D-004] Q: 是否移除在场机制或调整提问拦截？ -> A: 不调整，全部保持现状。
- [D-005] Q: 上报卡片还要改什么？ -> A: `send_report` 卡片的内容文字与宿主对话正文一样使用正文前景色，不呈现为次要灰色。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: 此前包含统一通知渠道的完整版本 | Open items: none | Risks: 该批准已被后续范围调整取代。
- 待审查当前纯 UI 版本。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - lark_notify 成功内容以正文卡片展示 (Priority: P1)

用户在 GUI 查看桥接会话。`lark_notify` 成功后，对话中出现一张只含发送正文的卡片。用户无需展开工具行即可读到完整内容。

**Why this priority**: 当前对话里只有「已发送给用户（N 条）」一行，发送内容不可见。这是唯一新增能力。

**Independent Test**: 在桥接会话调用一次 `lark_notify` 发送带换行的文本，在 GUI 查看该轮。

**Acceptance Scenarios**:

1. **Given** 一次成功的 `lark_notify`，**When** 用户查看该轮，**Then** 卡片只显示这次 `text` 的完整内容。
2. **Given** 正文含换行与 Markdown 记号，**When** 用户查看卡片，**Then** 换行保留，Markdown 记号按原文显示。
3. **Given** 一张通知卡片，**When** 用户查看，**Then** 没有标题、回执、分段数、`reply_to` 或 `messageId` 等额外字段。
4. **Given** 该轮过程分组已折叠，**When** 用户查看，**Then** 正文卡片默认可见。
5. **Given** 历史轮次同时加载到成功结果与调用参数，**When** 用户查看，**Then** 同样显示正文卡片。

---

### User Story 2 - 上报与通知正文和对话正文同色 (Priority: P1)

用户查看 `send_report` 上报卡片与 `lark_notify` 正文卡片时，主要内容使用与宿主对话正文相同的前景色。

**Why this priority**: 卡片承载给用户的主要内容，颜色弱于正文会让用户误以为它们是辅助信息。

**Independent Test**: 在 GUI 并排查看普通助手正文、上报卡片和通知卡片，对比内容文字颜色。

**Acceptance Scenarios**:

1. **Given** 一张含正文、任务简介与附件的上报卡片，**When** 用户查看，**Then** 正文、任务简介与附件名和宿主对话正文使用相同前景色。
2. **Given** 一张通知卡片，**When** 用户查看，**Then** 通知正文和宿主对话正文使用相同前景色。
3. **Given** 宿主切换明暗主题，**When** 用户查看两类卡片，**Then** 内容文字继续跟随宿主正文前景令牌。

---

### User Story 3 - 未送达的调用保持默认展示 (Priority: P2)

进行中、失败与中断的 `lark_notify` 沿用宿主默认工具行，不出现正文卡片。

**Why this priority**: 卡片只表示成功发送，其他状态必须沿用现状。

**Independent Test**: 分别触发一次失败与一次成功的 `lark_notify`，对比展示形态。

**Acceptance Scenarios**:

1. **Given** `lark_notify` 正在执行，**When** 用户查看，**Then** 显示宿主默认工具行，无正文卡片。
2. **Given** `lark_notify` 返回失败结果，**When** 用户查看，**Then** 显示宿主默认工具行与错误信息，无正文卡片。
3. **Given** `lark_notify` 被中断，**When** 用户查看，**Then** 显示宿主默认中断样式，无正文卡片。

---

### Edge Cases

- 长文本被拆成多段发送：一次调用仍只显示一份完整 `text`。
- 同一轮多次调用 `lark_notify`：每次成功各显示一张正文卡片。
- 历史窗口只有成功结果、没有调用参数时，不显示空卡片；宿主默认工具行仍保留。
- 停用 `lark-super-agent` 行时，普通桥接会话的通知卡片照常工作。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 一次成功的 `lark_notify` MUST 在对话中显示专用正文卡片，卡片内容仅为该次调用的完整 `text`。
- **FR-002**: 通知正文 MUST 按纯文本保留换行，不作 Markdown 渲染。
- **FR-003**: 通知卡片 MUST 位于轮次层级，不进入过程分组，轮次折叠后默认可见。
- **FR-004**: 通知卡片 MUST 只包含正文区域，不显示标题、回执、分段数、`reply_to` 或 `messageId`。
- **FR-005**: 进行中、失败与中断的 `lark_notify` MUST 沿用宿主默认工具行，不显示卡片。
- **FR-006**: 历史消息同时加载出成功结果与调用参数时 MUST 显示正文卡片；缺少调用参数时 MUST 保留默认工具行且不产生空卡片。
- **FR-007**: `send_report` 卡片的正文、任务简介与附件名 MUST 使用宿主对话正文的主前景色；卡片容器 MUST 向 Markdown 正文提供同一前景色。
- **FR-008**: 通知正文 MUST 使用与 FR-007 相同的主前景色。
- **FR-009**: `lark_notify` 的参数、校验、分段、发送行为、结果 render 与返回结构 MUST 保持现状。
- **FR-010**: `send_report` 的参数、投递行为、卡片结构与 Markdown 渲染方式 MUST 保持现状；本次只改颜色。
- **FR-011**: 调度提示词、桥接提醒、在场提醒、全局在场状态与被管理会话的提问拦截 MUST 保持现状。
- **FR-012**: 用户可见行为变化 MUST 同步 `README.md`、`docs/how-it-works.md` 与变更日志。

### Key Entities

- **通知正文卡片**: 一次成功 `lark_notify` 的对话内展示，只含该次调用的 `text`。
- **上报卡片**: 一次成功 `send_report` 的既有展示；本次只调整内容文字颜色。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 实机触发一次成功的 `lark_notify`，截图显示卡片只含完整正文，换行保留，轮次结束后无需点击即可见；失败与进行中沿用默认工具行。
- **SC-002**: 实机截图中，`send_report` 卡片正文、任务简介、附件名与 `lark_notify` 卡片正文的颜色和宿主对话正文一致。
- **SC-003**: `pnpm full-check` 全部通过；除颜色断言外，`send_report` 既有行为用例零修改通过。
- **SC-004**: 调度提示词、桥接提醒、在场机制与两个工具的后端代码无变更。

## Assumptions

- 卡片沿用上报卡片的外框与轮次层级展示方式，但通知卡片内部只有正文。
- 「和正文一样是黑色」指使用宿主正文前景令牌，随明暗主题变化，不写死颜色值。
- 上报卡片的回执、类型标签与附件完整路径等辅助信息保留现有视觉层级。
- 成功结果仍由前端根据现有工具结果识别；该识别只决定是否展示卡片，不向卡片增加任何回执内容。
- 验证沿用 `real-device-test` 技能，只覆盖卡片渲染、颜色与可见性。
