# Feature Specification: 上报卡片折叠开关

**Feature Branch**: `feat/073-report-card-collapse`

**Created**: 2026-11-27

**Status**: Waived

**Change Category**: 插件变更

**Input**: User description: "GUI 中所有「报告」（上报卡片，即 report-card 一类的展示）都增加「折叠」开关，且默认展开。要求：1. 先定位 GUI 里所有渲染「报告」的位置（含各类 kind：progress / question 等，以及任何其它形式的报告展示），确保全部覆盖，不遗漏。2. 每个报告增加折叠/展开开关；默认展开；折叠后只保留标题/摘要行与开关，展开恢复完整内容。3. 样式遵循现有设计令牌（--dsw-alias-* 等）与组件风格，注意此前已修复的上报正文颜色规则（`.dsh-lark-report-body > [data-markdown-variant=\"compact\"]` 用 primary）不要回退；键盘可访问（按钮语义、aria-expanded）。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: GUI 中有哪些渲染「报告」的位置？ -> A: 代码库检索确认：
  1. 任务会话中的上报卡片由 `src/client/report-card.tsx`（`ReportCard`）统一渲染，注册在 `conversation.chat.node` 的 `lark-report` 键；节点由 `src/client/report-node.ts` 从 `send_report` 的调用与成功结果生成，覆盖 `progress`、`question`、未知自定义 `kind` 及空 `kind` 的全部卡片。
  2. 被管理会话的提问拦截（`ask_intercept`）与轮次结束自动上报（`turn_end`）不产生 `send_report` 工具调用事件，直接存档并投递给调度会话；调度会话收到的 `<task_session_message>`、`<task_session_failure>`、`<task_session_archived>` 与 `<task_log_entry>` 为非用户消息，由宿主内置 `ContextInjectionRow` / `TurnTriggerNodeView` 渲染，本身已具备折叠能力。
  3. 调度会话的通知正文卡片由 `src/client/notify-card.tsx`（`NotifyCard`）渲染，用于展示发往飞书的 `lark_notify` 通知（卡片模式已有 `<details>` 折叠），不属于上报卡片。
  因此 GUI 中所有上报卡片均汇聚于 `ReportCard` 一处。
- [D-002] Q: 折叠开关放在什么位置，折叠后保留哪些信息？ -> A: 开关放在卡片头部（`.dsh-lark-report-head`）右侧；卡片头部保留图标、「上报」标题、类型标签（`progress` / `question` / 其他）、当 `desc` 非空且处于折叠态时显示的只读单行任务摘要预览、送达回执与 `reportId`，以及折叠/展开按钮。折叠后隐藏下方的任务简介详情行（`.dsh-lark-report-desc`）、Markdown 正文（`.dsh-lark-report-body`）与附件列表（`.dsh-lark-report-files`）；展开后完整恢复。
- [D-003] Q: 默认展开状态如何管理？ -> A: 组件挂载时默认展开（`expanded = true`），点击开关按钮在展开与折叠之间切换。
- [D-004] Q: 开关按钮的无障碍与文案规范是什么？ -> A: 使用原生 `<button type="button">`，设置 `aria-expanded={expanded}`、`aria-controls={bodyId}`、`aria-label` 与 `title`（展开时为「收起」/ `Collapse`，折叠时为「展开」/ `Expand`），内置 `IconChevronDownOutlineRegular` 图标并随展开状态旋转，支持键盘聚焦（`:focus-visible` 焦点环）与 Enter / Space 触发。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 折叠状态保存在组件本地 state，虚拟列表卸载重建或页面刷新后回到默认展开状态。 | Reason: 用户授权自由推进，免中途提问确认。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 折叠与展开上报卡片 (Priority: P1)

用户在任务会话 GUI 中查看一条已送达的上报卡片（无论是 `progress`、`question` 还是其他类型）。卡片默认展开显示全部内容；用户点击卡片头部的折叠按钮后，卡片收起正文、简介块与附件列表，只保留头部标题/摘要行与开关；再次点击开关后恢复完整内容。

**Why this priority**: 长篇进度或提问报告会占据大量对话纵向空间，用户需要在阅读后收起报告并随时重新展开。

**Independent Test**: 渲染各类 `kind` 的 `ReportCard`，验证初始展开、点击收起、再次点击展开时的 DOM 结构与属性。

**Acceptance Scenarios**:

1. **Given** 任意 `kind`（`progress`、`question`、自定义或空）的上报卡片，**When** 初次渲染，**Then** 卡片默认处于展开状态，`aria-expanded="true"`，任务简介、Markdown 正文与附件列表按数据正常显示。
2. **Given** 处于展开状态的上报卡片，**When** 用户点击折叠开关，**Then** `aria-expanded="false"`，卡片隐藏 `.dsh-lark-report-desc`、`.dsh-lark-report-body` 与 `.dsh-lark-report-files`，只保留头部行与开关；若 `desc` 非空，头部显示单行省略的摘要预览。
3. **Given** 处于折叠状态的上报卡片，**When** 用户再次点击开关，**Then** `aria-expanded="true"`，完整内容恢复显示。

---

### User Story 2 - 键盘无障碍与主题样式兼容 (Priority: P1)

用户通过键盘 Tab 聚焦到上报卡片的折叠按钮并按 Enter 或 Space 切换状态；在明暗主题与紧凑 Markdown 模式下，上报正文保持主前景色（`--dsw-alias-label-primary`），开关与卡片遵循宿主 `--dsw-*` 设计令牌。

**Why this priority**: 保证无障碍可访问性，同时不回退已修复的正文主前景色规则。

**Independent Test**: 检查按钮语义、`aria-expanded`、`aria-label`、中英文文案回退，以及 `report-card.css` 的颜色与焦点环规则。

**Acceptance Scenarios**:

1. **Given** 上报卡片渲染完成，**When** 检查折叠控件，**Then** 控件为 `<button type="button">`，具备 `aria-expanded` 与随状态切换的 `aria-label`（中文「收起」/「展开」，英文 `Collapse` / `Expand`）。
2. **Given** 展开状态下的上报卡片，**When** 检查样式规则，**Then** `.dsh-lark-report-body > [data-markdown-variant="compact"]` 保持 `color: var(--dsw-alias-label-primary)`。

### Edge Cases

- 只有正文、没有 `desc` 与 `files` 的报告：折叠后同样只保留头部行与开关。
- 只有 `files`、没有 `text` 的报告：折叠后隐藏附件列表，展开后恢复。
- 调用不在已加载窗口内（`desc`、`text`、`files` 均为空）：头部开关仍可正常切换状态，不渲染空内容区。
- 翻译函数缺失时：开关文案回退为英文 `Collapse` / `Expand`。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `ReportCard` MUST 为所有 `kind`（`progress`、`question`、未知值与空值）提供折叠/展开开关按钮。
- **FR-002**: `ReportCard` MUST 默认处于展开状态（`expanded = true`）。
- **FR-003**: 折叠状态下，`ReportCard` MUST 只保留头部行（图标、标题、类型标签、可选单行任务摘要预览、送达回执与 `reportId`、折叠开关），隐藏任务简介详情行、Markdown 正文与附件列表。
- **FR-004**: 展开状态下，`ReportCard` MUST 完整显示存在的任务简介详情行、Markdown 正文与附件列表。
- **FR-005**: 折叠开关 MUST 使用原生 `<button type="button">`，携带准确的 `aria-expanded` 与国际化 `aria-label` / `title`（`report.collapse` 与 `report.expand`）。
- **FR-006**: 样式 MUST 使用 `--dsw-*` 设计令牌，并保留 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 的 `color: var(--dsw-alias-label-primary)` 规则。
- **FR-007**: 中英文字典 `src/client/locales.ts` MUST 同步包含 `report.collapse` 与 `report.expand`，且缺省回退字典包含英文默认值。

### Key Entities

- **上报卡片 (`ReportCard`)**: 展示单次成功 `send_report` 的 Chat 节点组件，包含头部摘要栏、本地展开/折叠状态与可折叠主体区域。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 单元测试覆盖 `ReportCard` 默认展开、点击折叠隐藏主体并显示头部摘要、再次点击展开恢复主体、各 `kind` 表现一致，以及中英文文案与回退。
- **SC-002**: 样式测试确认 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 主前景色规则未回退。
- **SC-003**: `pnpm check` 与 `pnpm build` 全部通过。

## Assumptions

- 折叠状态为视图层瞬态交互状态，无需持久化到会话事件日志或后端存储。
