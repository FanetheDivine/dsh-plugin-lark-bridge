# Feature Specification: 优化上报与通知卡片 GUI 悬停与点击热区

**Feature Branch**: `feat/078-refine-report-gui`

**Created**: 2026-11-27

**Status**: Approved

**变更类别**: 插件变更

**Input**: User description: "参考 dsh 的 section.hSzSIW_root 的 DOM 结构，优化当前 report 的 GUI：hover 时整体变色，分隔线上方的部分作为点击热区。" 追加需求："顺便优化下 lark_notify 的 UI"。

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: 悬停时卡片整体变色的触发范围是什么？ -> A: 鼠标悬停在卡片任意位置（`.dsh-lark-report:hover`）时卡片整体变色，文件按钮同时保留自身的悬停样式。
- [D-002] Q: 展开状态下，任务简介（`desc`）与分隔线、点击热区的关系是什么？ -> A: 展开态下任务简介（`desc`）位于分隔线上方，包含在点击热区 `button` 内部，点击标题行或任务简介均切换折叠。
- [D-003] Q: `lark_notify` 通知卡片的优化采用哪种结构？ -> A: 完整同构上报卡片。顶部热区 `button` 点击切换正文展开/折叠：卡片模式热区显示总结（默认折叠），文本模式热区显示「通知」标题（默认展开）；正文位于分隔线下方；任务与会话行常显在卡片底部，会话链接独立点击；移除现有 `<details>`「完整内容」折叠。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: 上报卡片规格全文（D-001、D-002 写回后的版本） | Open items: none | Risks: none
- 2026-11-27 | Decision: Approved | Scope: 扩展后全文（含 `lark_notify` 通知卡片 UI 优化，D-003 已写回） | Open items: none | Risks: none
- 2026-11-27 | 用户授权：后续阶段自行推进并合并 PR，plan 及之后的审查按 Waived 记录，决策由 Agent 依据代码库事实自决并逐条留痕。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 分隔线上方热区切换折叠与悬停整体变色 (Priority: P1)

用户在会话中查看 `send_report` 成功上报卡片时，将鼠标移入卡片可看到卡片整体背景变色反馈，点击分隔线上方的热区即可切换卡片的展开与折叠状态。

**Why this priority**: 该交互直接决定上报卡片在会话流中的视觉一致性与折叠操作体验。

**Independent Test**: 在会话中渲染一条包含类型、任务简介、正文和文件列表的上报卡片，验证悬停在卡片上时卡片整体变色，点击分隔线上方的标题行或任务简介可切换展开与折叠，点击分隔线下方的正文与文件区域保持展开状态。

**Acceptance Scenarios**:

1. **Given** 会话中展示上报卡片，**When** 用户将鼠标悬停在卡片任意区域，**Then** 卡片容器（`section.dsh-lark-report`）整体背景切换为悬停态颜色。
2. **Given** 上报卡片处于展开状态且包含任务简介，**When** 用户点击分隔线上方的标题行或任务简介区域，**Then** 卡片收起为折叠状态，标题行内联显示单行任务简介摘要。
3. **Given** 上报卡片处于折叠状态，**When** 用户点击卡片的点击热区，**Then** 卡片展开显示任务简介、正文与文件列表。
4. **Given** 上报卡片处于展开状态，**When** 用户点击分隔线下方的正文或文件按钮，**Then** 卡片保持展开状态，文件按钮触发打开文件回调。

---

### User Story 2 - 通知卡片与上报卡片视觉交互一致 (Priority: P2)

用户在会话中查看 `lark_notify` 成功通知卡片时，看到与上报卡片一致的外框、悬停整体变色与分区布局，会话跳转入口保持独立可点击。

**Why this priority**: 通知卡片与上报卡片同列会话流，视觉与交互一致减少认知成本；依赖上报卡片确立的结构模式。

**Independent Test**: 渲染文本模式与卡片模式（含 `summary`）的通知卡片，验证悬停整体变色、顶部热区切换正文折叠、两种模式的默认展开状态、会话链接跳转与已归档标签。

**Acceptance Scenarios**:

1. **Given** 会话中展示通知卡片，**When** 用户将鼠标悬停在卡片任意区域，**Then** 卡片容器（`section.dsh-lark-notify`）整体背景切换为悬停态颜色。
2. **Given** 卡片模式通知卡片（有 `summary`）默认折叠，**When** 用户点击显示总结的顶部热区，**Then** 分隔线下方展开完整正文，再次点击收起。
3. **Given** 文本模式通知卡片（无 `summary`）默认展开，**When** 用户点击显示「通知」标题的顶部热区，**Then** 正文收起，再次点击展开。
4. **Given** 通知卡片带有效会话标识，**When** 用户点击会话链接，**Then** 触发 `openSession` 跳转，卡片展开状态不变。
5. **Given** 通知卡片的会话已归档，**When** 用户查看会话行，**Then** 显示已归档标签，会话标识以不可点击文本呈现。

---

### Edge Cases

- 当上报卡片仅含正文或仅含文件列表时，展开详情区仅渲染对应区块与顶部分隔线，点击热区正常切换折叠。
- 当上报卡片缺失正文且缺失文件列表时，点击热区仍可切换展开态与折叠态的任务简介展示。
- 当上报卡片缺失任务简介（`desc` 为空）时，折叠态与展开态的热区仅渲染标题行。
- 键盘聚焦点击热区按钮时显示聚焦轮廓，按 `Enter` 或 `Space` 切换展开与折叠。
- 通知卡片缺失任务标识与会话标识时，不渲染对应信息行，卡片布局保持紧凑。
- 通知卡片折叠且无任务与会话行时，不渲染分隔线，热区占据整卡。
- 通知卡片正文为空时不产出卡片（沿用 `notify-node.ts` 现有判定）。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 上报卡片容器 `section.dsh-lark-report` MUST 采用与 DSH `TurnTriggerNodeView`（`section.hSzSIW_root`）一致的分区结构，由顶部点击热区 `button.dsh-lark-report-head` 与下方展开详情区各自承担内边距。
- **FR-002**: 外层容器 `section.dsh-lark-report` 在 `@media (hover: hover)` 悬停时 MUST 整体切换背景色为 `var(--dsw-alias-turn-trigger-bg-hover, var(--dsw-alias-interactive-bg-hover))`，并配置背景色过渡与 `prefers-reduced-motion: reduce` 降级。
- **FR-003**: 点击热区 `button.dsh-lark-report-head` MUST 覆盖分隔线上方的完整卡片宽度与上、左、右内边距区域，包含标题行及展开态下的任务简介（`.dsh-lark-report-desc`）。
- **FR-004**: 分隔线下方的展开内容区域（`.dsh-lark-report-body` 与 `.dsh-lark-report-files`）MUST 位于点击热区 `button` 之外，各自带顶部分隔线与内边距，点击该区域保持卡片展开状态。
- **FR-005**: 文件列表按钮 `.dsh-lark-report-file` MUST 独立响应点击打开文件操作，并在启用状态下保留自身的悬停背景与文件名下划线样式。
- **FR-006**: 点击热区 `button.dsh-lark-report-head` MUST 维护 `type="button"`、`data-dsh-lark-report-toggle=""`、`aria-expanded` 与 `aria-label` 属性。
- **FR-007**: 通知卡片容器 `section.dsh-lark-notify` MUST 采用与上报卡片一致的分区结构：外层不设容器级内边距，由内部各区块承担内边距。
- **FR-008**: 通知卡片在 `@media (hover: hover)` 悬停时 MUST 整体切换背景色，令牌与过渡规则和 FR-002 相同。
- **FR-009**: 通知卡片顶部 MUST 为覆盖分隔线上方完整区域的 `button` 点击热区，点击切换正文展开/折叠：卡片模式（有 `summary`）热区显示总结且默认折叠；文本模式（无 `summary`）热区显示「通知」标题且默认展开。正文位于分隔线下方，现有 `<details>`「完整内容」折叠结构移除。
- **FR-010**: 通知卡片新增文案 MUST 同时提供中英文字典条目，并保留英文回退。
- **FR-011**: 任务行与会话行 MUST 常显在通知卡片底部、点击热区之外，与上方内容以分隔线分隔；会话链接独立响应 `openSession` 跳转，已归档会话显示标签且标识不可点击。
- **FR-012**: 通知卡片点击热区 `button` MUST 维护 `type="button"`、`aria-expanded` 与 `aria-label` 属性，键盘可聚焦并激活。

### Key Entities

- **ReportCard (`lark-report`)**: 会话流中展示 `send_report` 成功投递结果的卡片组件，由顶部可点击热区（含标题行与展开态任务简介）和下方详情区（含 Markdown 正文与文件列表）组成。
- **NotifyCard (`lark-notify`)**: 会话流中展示 `lark_notify` 成功通知的卡片组件，由顶部可点击热区（卡片模式显示总结、文本模式显示「通知」标题）、分隔线下方的正文，以及常显的任务行与会话入口组成。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 组件测试验证展开态任务简介位于 `button[data-dsh-lark-report-toggle]` 内部，点击标题行子元素或任务简介均可切换展开与折叠状态。
- **SC-002**: 组件测试验证点击文件按钮触发 `openFile` 回调且保持卡片当前展开状态。
- **SC-003**: 样式与产物检查验证 `.dsh-lark-report:hover` 与 `.dsh-lark-notify:hover` 整体变色规则及内边距分区生效，`pnpm check` 100% 通过。
- **SC-004**: 通知卡片组件测试验证两种模式的热区内容与默认展开状态、点击热区切换折叠、会话链接跳转回调与已归档标签，新增文案键在中英文字典中都有值。

## Assumptions

- DSH 宿主 `section.hSzSIW_root` 来自 `@deepseek-ai/dsh-client-ui-chat/TurnTriggerNodeView.module.css`。
- 卡片展示的数据字段（`kind`、`desc`、`text`、`files`、`reportId`）与 `report-node.ts` 的节点解析逻辑保持不变。
- 通知卡片的数据字段（`text`、`summary`、`taskId`、`sessionId`）与 `notify-node.ts` 的节点解析逻辑保持不变。
- 通知卡片的悬停变色触发范围沿用 D-001 的结论：悬停在卡片任意位置时整体变色。
- 通知正文沿用现有纯文本渲染（`pre-wrap`），本次不引入 Markdown 渲染。
