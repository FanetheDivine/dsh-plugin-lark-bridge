# Feature Specification: 修复 send_report 卡片不显示报告内容

**Feature Branch**: `fix/061-send-report-card`

**Created**: 2026-11-26

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "send_report 的特殊 UI 只显示一行「上报 已送达 report-…」，desc、text、files 都没有渲染。上报失败沿用默认工具结果展示；上报成功展示 kind、描述、正文与文件列表，风格与宿主工具卡片一致；必须在真实 DSH Web GUI 里触发一次 send_report，确认卡片正确渲染且默认展开可见。"

## Open Decisions

None.


## Clarifications

### Session 2026-11-26

- [D-001] Q: 成功卡片放在哪里，是否保留默认工具行？ -> A: 插件不再接管 `send_report` 工具行；进行中、失败、中断由宿主默认行显示。成功结果另生成一种上报卡片节点，位于轮次层级，不进过程分组，不受轮次折叠影响。
- [D-002] Q: 文件列表是否可点击打开？ -> A: 每个文件显示为可点击路径，点击在右侧栏打开；相对路径按该会话工作目录解析。
- [D-003] Q: 实机测试用哪个宿主？ -> A: 按 `real-device-test` 起隔离 profile 的 `dsh web`（同宿主版本、插件链到本分支构建产物），成功与失败各测一次并截图。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 成功上报在过程分组里仍会留下宿主默认工具行；卡片依赖宿主 `conversation.chat.node` 扩展点，宿主升级后需回归。

## 根因

排查结论，均有实机数据或宿主源码佐证：

1. 渲染器注册的工具名正确。`tool.call.toolview` 按 `send_report` 命中，实机截图里出现的「上报 已送达 …」就是本插件卡片的输出。
2. 结果数据结构不匹配，这是内容缺失的直接原因。卡片从 `block.argsRaw` 读参数。宿主只在 `start` 阶段的块上提供 `argsRaw`；`result` 阶段的块是 `ToolResultNode`，参数在 `block.call.argsRaw` 与 `block.args`。结果阶段读到空参数，kind、desc、text、files 全部为空，只剩标题与回执。
3. 折叠逻辑会收起卡片。工具行属于过程内容：
   - 宿主把连续的工具行归入「过程分组」，紧凑与标准模式下分组默认收起。
   - 轮次结束后，宿主把整个过程折叠到「已处理 N 秒」后面。
   - 本机 profile 的对话视图为 `compact`。
   因此即使修好数据读取，卡片放在工具行里也默认不可见。
4. 键控工具视图拿不到宿主默认行。宿主对注册了键的工具只渲染插件组件，不把默认行传给插件，插件无法按「失败时用默认行」逐次切换。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 成功的上报在对话里直接可读 (Priority: P1)

用户打开任务会话，看到这次上报的类型、任务简介、正文与附件，不需要展开任何折叠。

**Why this priority**: 这是缺陷本身。

**Independent Test**: 在被管理会话里成功调用一次 `send_report`，传入 kind、desc、text 与 files，在 GUI 中查看该轮。

**Acceptance Scenarios**:

1. **Given** 一次成功的 `send_report`，**When** 用户查看该轮，**Then** 卡片显示类型标签、任务简介、Markdown 正文与文件列表。
2. **Given** 该轮已结束且对话视图为紧凑或标准，**When** 页面加载完成，**Then** 卡片可见且展开，不在任何收起的分组或轮次折叠之内。
3. **Given** 上报只有 text 或只有 files，**When** 用户查看，**Then** 卡片只显示存在的部分，不显示空标题。
4. **Given** 页面刷新或从历史重新加载会话，**When** 用户滚到该轮，**Then** 卡片内容与首次显示一致。

---

### User Story 2 - 失败的上报沿用默认工具行 (Priority: P1)

非被管理会话调用 `send_report` 会失败。用户看到宿主默认的工具行与错误信息。

**Independent Test**: 在普通会话里调用一次 `send_report`。

**Acceptance Scenarios**:

1. **Given** `send_report` 返回错误，**When** 用户查看该轮，**Then** 显示宿主默认工具行，含错误摘要与可展开的输入输出，不显示上报卡片。
2. **Given** `send_report` 被用户中断，**When** 用户查看该轮，**Then** 显示宿主默认的中断样式。

---

### User Story 3 - 进行中的上报 (Priority: P2)

上报尚未返回时，用户看到宿主默认工具行的进行中状态。

**Acceptance Scenarios**:

1. **Given** 模型正在生成或执行 `send_report`，**When** 用户查看，**Then** 显示宿主默认工具行，结果返回成功后出现上报卡片。

### Edge Cases

- 结果对应的 `tool/call` 不在已加载窗口内：成功结果仍显示卡片，参数缺失的部分不显示。
- 参数 JSON 无法解析或字段类型不对：忽略该字段，不抛错。
- kind 不是 `progress` 或 `question`：原样显示该值。
- 正文很长：卡片不截断正文，使用宿主 Markdown 渲染。
- 同一轮多次上报：每次成功上报各有一张卡片，按调用顺序排列。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 成功结果 MUST 从结果块携带的调用参数读取 kind、desc、text、files。
- **FR-002**: 成功上报 MUST 显示上报卡片，含类型标签、任务简介、Markdown 正文、文件列表与报告编号。
- **FR-003**: 上报卡片 MUST 在页面加载后默认可见且展开，不受过程分组与轮次折叠影响，所有对话视图模式一致。
- **FR-004**: 失败、中断、准备与执行中的 `send_report` MUST 使用宿主默认工具行。
- **FR-005**: 卡片 MUST 使用宿主主题变量，边框、圆角、底色、字号与宿主工具详情卡片一致，明暗主题都可读。
- **FR-006**: 卡片文案 MUST 走插件字典，中英文齐全。
- **FR-007**: 卡片位置 MUST 紧跟该次上报所在的位置，多次上报按调用顺序排列。

### Key Entities

- **上报卡片**: 一次成功 `send_report` 的展示。字段为 kind、desc、text、files、reportId。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 单元测试覆盖结果阶段从 `call.argsRaw` 取参，四个字段全部渲染。
- **SC-002**: 单元测试覆盖失败结果不产生上报卡片。
- **SC-003**: 实机在真实 DSH Web GUI 中成功触发一次 `send_report`，截图显示卡片内容完整，轮次结束后无需任何点击即可见。
- **SC-004**: `pnpm check` 与 `pnpm build` 通过。

## Assumptions

- 宿主版本为 `@deepseek-ai/dsh` 0.2.2-rc.5，Chat 与 Conversation 的扩展接口以该版本源码为准。
- 本次只改前端展示。`send_report` 的参数、返回值与投递行为不变。
