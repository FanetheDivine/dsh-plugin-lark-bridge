# Feature Specification: 上报卡片头部折叠热区

**Feature Branch**: `feat/077-report-header-toggle`

**Created**: 2026-11-27

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "report 的 GUI 里「展开」「收起」文字删除，只留箭头；点击热区改为整个 header。"

## Open Decisions

- [ ] [D-002] 箭头方向语义：展开态箭头朝上、折叠态朝下，还是反过来？ | Recommended: 展开朝上、折叠朝下，沿用当前旋转方向 | Rationale: 现有 `aria-expanded="true"` 时旋转 180deg | Depends on: none | Status: skipped
- [ ] [D-003] 去掉可见文字后，`report.collapse` / `report.expand` 是否继续作为无障碍名称与悬浮提示？ | Recommended: 保留为 `aria-label`，去掉 `title` 悬浮提示 | Rationale: 屏幕阅读器需要状态名称；整行悬浮提示在鼠标划过卡片时反复出现 | Depends on: none | Status: skipped

## Clarifications

### Session 2026-11-27

- [D-001] Q: 整行 header 作为切换热区后，标题、类型标签、任务摘要、送达回执与报告编号是否都在热区内？ -> A: 全部在热区内，附件列表除外。
- [D-002] Q: 箭头方向语义如何定？ -> A: 用户跳过，规格按推荐执行：展开朝上、折叠朝下。
- [D-003] Q: 去掉可见文字后是否继续用 `report.collapse` / `report.expand` 作无障碍名称？ -> A: 用户跳过，规格按推荐执行：保留 `aria-label`，去掉 `title`。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: D-002, D-003（用户跳过，按推荐执行） | Risks: 箭头方向与无障碍名称取值未经用户逐项确认

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 点击卡片头部切换折叠 (Priority: P1)

用户在任务会话中查看上报卡片。卡片头部是一整行可点击区域，右侧只有一个箭头表示折叠状态。点击头部任意位置收起正文、任务简介详情与附件列表，再次点击恢复完整内容。

**Why this priority**: 头部是用户查看报告时的自然落点，整行热区比右侧小按钮更容易命中。

**Independent Test**: 渲染上报卡片，分别点击头部左侧标题、中部类型标签与右侧回执，验证折叠状态切换。

**Acceptance Scenarios**:

1. **Given** 任意类型的上报卡片，**When** 点击头部任意位置，**Then** 卡片在展开与折叠之间切换，`aria-expanded` 同步。
2. **Given** 折叠状态的卡片，**When** 点击头部，**Then** 完整内容恢复，任务简介详情、Markdown 正文与附件列表重新显示。

---

### User Story 2 - 头部只保留箭头 (Priority: P1)

用户在头部右侧只看到箭头，不再看到「收起」「展开」文字。箭头方向随折叠状态变化，为屏幕阅读器保留状态名称。

**Why this priority**: 文字与箭头重复表达同一状态，占用头部横向空间。

**Independent Test**: 检查头部渲染结果不含可见的「收起」「展开」文本，箭头随状态旋转，无障碍名称随状态变化。

**Acceptance Scenarios**:

1. **Given** 展开状态的卡片，**When** 渲染头部，**Then** 右侧只有箭头，无可见文字。
2. **Given** 折叠状态的卡片，**When** 渲染头部，**Then** 箭头方向与展开态相反。

---

### Edge Cases

- 头部为空类型、无任务简介、无报告编号时，热区仍覆盖整个头部行。
- 附件按钮位于头部之外，点击附件不切换折叠。
- 键盘聚焦头部后按 Enter 或 Space 切换，焦点环覆盖整个头部行。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 上报卡片头部 MUST 整行可点击，点击任意位置切换折叠状态。
- **FR-002**: 头部 MUST NOT 渲染可见的「收起」/「展开」文字，折叠指示只由箭头表达。
- **FR-003**: 箭头方向 MUST 随折叠状态变化：展开时朝上，折叠时朝下。
- **FR-004**: 头部 MUST 保留按钮语义、`aria-expanded` 与随状态变化的无障碍名称（`report.collapse` / `report.expand`），不带 `title` 悬浮提示，支持键盘 Enter / Space。
- **FR-005**: 折叠后的内容可见性 MUST 与当前一致：隐藏任务简介详情、Markdown 正文与附件列表，保留标题、类型标签、折叠态单行任务摘要、回执与报告编号。
- **FR-006**: 中英文字典与缺省回退文案 MUST 覆盖头部无障碍名称。
- **FR-007**: 头部样式 MUST 沿用宿主设计令牌，保留 `:focus-visible` 焦点环与紧凑正文主前景色规则。

### Key Entities

- **上报卡片头部**：图标、标题、类型标签、折叠态摘要、送达回执、报告编号与箭头组成的单行区域，整体是一个切换控件。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 头部可见文本中不含「收起」「展开」（中英文同理），浏览器可访问名称仍表达当前状态。
- **SC-002**: 点击头部内任意子元素都能切换折叠，自动化测试覆盖标题、标签与回执三个位置。
- **SC-003**: 折叠前后内容显隐与当前行为一致，既有折叠测试全部通过。

## Assumptions

- 附件列表与正文不进入热区，附件按钮保持原有打开文件行为。
- 折叠状态仍是组件本地状态，不持久化。
- 通知卡片（`NotifyCard`）的 `<details>` 折叠不在本次范围内。
