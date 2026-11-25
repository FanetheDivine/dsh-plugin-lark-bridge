# Feature Specification: 自动切换时间的配置行与时间选择浮窗

**Feature Branch**: `feat/047-presence-time-picker`

**Created**: 2026-11-25

**Status**: Draft

**Input**: User description: "lark bridge 插件配置页里的两个时间选择控件 UI 太糟糕，无论是配置行本身还是打开的时间选择浮窗。要求：1. 整体美化这部分 UI（配置行 + 浮窗）；2. 时间选择器组件直接改用 shadcn/ui 现成的组件（如 Popover + 现成 time picker 写法/Select/Input 等 shadcn 组件）。之前说的「闹钟」只是功能上近似，UI 不能做成钟表盘样子，只需要一个简单的 time picker。完成后验证构建通过，并汇报改动。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

- [x] [D-001] 时间选择浮窗用哪套组件实现 | 用真实的 shadcn/ui 底座，样式适配宿主 `--dsw-*` 令牌 | Depends on: none | Status: answered
- [x] [D-002] 浮窗内的选择形态与分钟粒度 | 小时列加分钟列，分钟为全部 60 项 | Depends on: D-001 | Status: answered
- [x] [D-003] 配置行的布局与跳过项位置 | 卡片行，跳过项在行内以可点 chip 呈现 | Depends on: none | Status: answered
- [x] [D-004] 浮窗用 shadcn 的哪种时间选择形态 | `@radix-ui/react-popover` 作底座 | Depends on: D-002 | Status: answered
- [x] [D-005] 浮窗用哪份实现 | 移植 ReUI `@reui/time-picker`（radix 变体）与其依赖的三个 shadcn 组件 | Depends on: D-004 | Status: answered
- [x] [D-006] 样式怎样落地 | 接入 Tailwind v4，只输出 utilities 并映射到宿主令牌 | Depends on: none | Status: answered

## Clarifications

### Session 2026-11-25

- [D-001] Q: 时间选择浮窗用哪套组件实现？ -> A: 强制用真实的 shadcn/ui 组件与底座（`@radix-ui/react-popover` 等），按 shadcn 源码实现；不接受用宿主组件组合替代。样式适配宿主 `--dsw-*` 令牌。
- [D-002] Q: 浮窗内的选择形态与分钟粒度？ -> A: 接受推荐的小时列与分钟列、分钟为全部 60 项；具体形态以 shadcn 提供的 time picker 形态为准。shadcn 无第一方 Time Picker，故由 D-004 消歧。
- [D-003] Q: 配置行的布局与跳过项位置？ -> A: 先按推荐（卡片行）推进，用户另有意见时再调整。
- [D-004] Q: 浮窗用哪种形态？候选为 Radix Popover 自绘列式、ReUI `@reui/time-picker` 移植、React Aria `TimeField`、官方原生 `input[type="time"]` -> A: 用 `@radix-ui/react-popover` 作底座。
- [D-005] Q: 浮窗用哪份实现？ -> A: 移植 ReUI 的 `@reui/time-picker`（radix 变体），连带移植它的 `button`、`input-group`、`popover` 三个 shadcn 组件，并注明来源与 MIT 许可证。
- [D-006] Q: 样式怎样落地？ -> A: 接入 Tailwind v4，只输出 utilities 并映射到宿主 `--dsw-*` 令牌；preflight 不得进入产物。

## Review Record

- 2026-11-25 | Decision: Approved | Scope: current full document | Open items: none | Risks: 移植外部源码；Tailwind preflight 误入产物会重置宿主页面；产物体积上升；需实机核对视觉

## 探索发现

- 配置行由 `src/client/presence-config.tsx` 渲染：每条时间渲染为 `Pill`（时间）、两个可切换 `Pill`（跳过周末、跳过节假日）、`Switch`（启用）与图标按钮（删除），四类控件同形同色，缺少层级。
- 编辑浮窗由 `src/client/presence-alarms-editor.tsx` 渲染：`Modal` 内是 `react-time-picker` 输入框加 `react-clock` 表盘，表盘固定约 200px 见方，浮窗被撑高到 580px 左右。
- 现有样式在 `src/client/presence-alarms.css`，按 `--dsw-alias-*` 令牌覆盖 `react-time-picker` 与 `react-clock` 的类名。
- 仓库没有 shadcn/ui 依赖，也没有 Tailwind；宿主前端 `@deepseek-ai/dsh-client-ui-primitives` 用 CSS Modules 加 `--dsw-*` 令牌实现 shadcn 风格原子组件。
- 宿主已提供可复用的原子组件：`Button`、`Checkbox`、`Input`、`Menu`、`MenuItemButton`、`MenuSurface`、`Modal`、`Pill`、`Switch`，未提供 Popover 与 Select 的独立导出。
- shadcn/ui 截至 2026-11 没有第一方 Time Picker：官方文档的 Time Picker 示例是给原生 `input[type="time"]` 套 Input 样式并隐藏指示器，没有浮窗。
- 调研过的候选都缺列式时间控件：Base UI 无任何日期与时间组件；Ark UI 在 2025-09 删除了 time-picker；React Aria 只有分段输入的 `TimeField`；Mantine 的 `TimePicker` 要求 React 19。
- 列式浮窗时间控件只存在于 shadcn 注册表条目（ReUI、diceui），两者都是 Tailwind 类源码，移植需要逐条改写样式。
- `@radix-ui/react-popover` 1.3.1 支持 React 16.8 到 19，实测压缩后 gzip 24.2 KB；`react-time-picker` 加 `react-clock` 实测 gzip 11.2 KB。
- 浏览器产物把非平台模块内联进 `dist/client.js`；当前 `dist/client.js` 为 189.45 KB，gzip 47.22 KB。
- 时间的判定逻辑与数据形态在 `src/lark-super-agent/alarms.ts`，与 UI 无关，本次不改动。
- `tests/presence-alarms-client.test.ts` 用 jsdom 渲染配置页并断言 DOM，是本次 UI 变更的回归入口。
- ReUI 的 `@reui/time-picker` radix 变体是单文件 1780 行，registry 依赖只有 `cn` 与 `button`、`input-group`、`popover` 三个 shadcn 组件，没有额外运行时库；仓库 MIT，4300 star，2026-10 仍在更新。
- Tailwind 当前版本为 4.3.5；`tailwind-merge` 3.7.1、`tw-animate-css` 1.4.0 可用。
- tsdown 把 CSS 收成 `dist/client.css`，构建结束后由 `inlineClientCss` 注入 `client.js`；Tailwind 需在 tsdown 之前生成 CSS 文件。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 用浮窗选一个时间 (Priority: P1)

用户在配置页点「添加时间」，弹窗里点时间按钮，浮窗展开小时与分钟两组选项；点选后时间立即更新，点「确认」保存条目。

**Why this priority**: 选时间是这条流程的核心动作，现在的表盘控件是本次需求的主要问题。

**Independent Test**: 打开编辑弹窗，点开时间浮窗，选一个小时后点「确认」，配置页出现该时间的新条目。

**Acceptance Scenarios**:

1. **Given** 编辑弹窗已打开，**When** 点时间按钮，**Then** 浮窗展开并显示当前时间对应的小时与分钟为选中态。
2. **Given** 浮窗已展开，**When** 点某一个小时，**Then** 时间按钮文案立即反映新的小时，浮窗保持展开。
3. **Given** 已选好时间，**When** 点「确认」，**Then** 条目写入配置页并排序到对应位置。
4. **Given** 浮窗已展开，**When** 点浮窗外部或按 Esc，**Then** 浮窗关闭且时间保持上一次选择。

---

### User Story 2 - 一眼看清配置行里的每条时间 (Priority: P1)

用户在配置页浏览两个分区，每条时间以卡片行呈现：时间醒目，跳过项与启用状态一眼可辨，可点时间重新编辑，可点删除移除。

**Why this priority**: 配置行是每次打开配置页都会看到的界面，当前把时间与开关都做成同样的标签，分不清主次。

**Independent Test**: 添加两条跳过设置不同的时间，观察两行呈现的差异，点时间进入编辑，点删除移除该行。

**Acceptance Scenarios**:

1. **Given** 分区内有一条时间，**When** 查看该行，**Then** 时间以主视觉呈现，跳过项与启用状态以次要视觉呈现。
2. **Given** 某行的跳过周末为开、跳过节假日为关，**When** 查看该行，**Then** 两个开关项的视觉状态可区分。
3. **Given** 某行时间已停用，**When** 查看该行，**Then** 该行整体呈现停用态。
4. **Given** 点某行的时间，**When** 弹窗打开，**Then** 表单回填该行的时间与跳过项。
5. **Given** 点某行的删除按钮，**When** 该行消失，**Then** 同分区的时间排序保持不变。

---

### User Story 3 - 保持原有校验与保存行为 (Priority: P2)

用户选定同分区已有的时间时看到重复提示且无法确认；改动与其他配置改动一起保存。

**Why this priority**: 美化不能破坏既有行为，否则用户会丢失配置。

**Independent Test**: 在已有 `09:00` 的分区再选 `09:00`，确认按钮禁用并显示提示。

**Acceptance Scenarios**:

1. **Given** 分区内已有 `09:00`，**When** 在新条目里选中 `09:00`，**Then** 显示重复提示且「确认」不可点。
2. **Given** 已改动条目，**When** 点配置页的「保存」，**Then** 条目写入插件配置并原样回显。
3. **Given** 配置页处于只读或保存中，**When** 查看行与弹窗，**Then** 全部控件不可操作。

---

### Edge Cases

- 同分区时间数量较多时，配置行区域随条目增加而增高，页面可正常滚动。
- 浮窗在弹窗底部的行上打开时，浮窗向上展开且完整可见。
- 浮窗的高度超过可视区域时，小时与分钟列表各自滚动，浮窗本身不超出窗口。
- 时间为空或非法时，保存按钮保持禁用。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 配置页 MUST 以卡片行展示每条时间，行内含时间主按钮、跳过周末、跳过节假日、启用开关与删除按钮。
- **FR-002**: 时间 MUST 以 24 小时制 `HH:mm` 呈现，并与跳过项、启用状态在视觉层级上区分开。
- **FR-003**: 用户 MUST 能通过点时间进入编辑弹窗，并通过点删除按钮移除该条时间。
- **FR-004**: 编辑弹窗 MUST 用浮层式的简单时间选择控件，小时内与分钟分别选择；界面 MUST NOT 出现表盘或指针。
- **FR-005**: 浮窗 MUST 打开时定位到当前时间，并允许不关闭浮窗连续改动小时与分钟。
- **FR-006**: 浮窗 MUST 支持点外部与 Esc 关闭，并保持已选时间。
- **FR-007**: 浮窗 MUST 由移植的 shadcn 组件（Popover、Button、InputGroup）与 ReUI time-picker 组成，保留其列式选择与可键入输入，深浅色主题下与相邻配置项一致。
- **FR-008**: 选择同分区已有时间时 MUST 显示重复提示并阻止确认。
- **FR-009**: 配置页处于不可用、只读或保存中时，行内控件与弹窗控件 MUST 全部禁用。
- **FR-010**: 时间的展示、排序、校验与持久化格式 MUST 与现有实现一致，已保存的配置无需迁移。
- **FR-011**: 时间选择 MUST 可通过键盘完成，浮窗内的焦点顺序与焦点返回符合宿主弹窗规范。
- **FR-012**: 界面文案 MUST 描述时间选择本身，移除与表盘相关的文案键。
- **FR-013**: 引入 `@radix-ui/react-popover`，移除 `react-time-picker` 与 `react-clock`，`pnpm check` 与 `pnpm build` MUST 通过。
- **FR-014**: 样式 MUST 由 Tailwind v4 只生成 utilities，宿主令牌经 `@theme inline` 映射为 shadcn 变量；产物 MUST NOT 含 preflight 等全局重置。
- **FR-015**: 移植的组件 MUST 在文件头注明来源仓库与 MIT 许可证。

### Key Entities

- **时间条目**：一条自动切换配置，含时间、动作、启用、跳过周末、跳过节假日；本次不改变其字段。
- **配置分区**：按动作划分的两个列表，条目在分区内按时间升序排列。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 从点「添加时间」到保存新条目，点击次数不超过 5 次。
- **SC-002**: 配置行在 320px 宽的容器内不发生横向溢出。
- **SC-003**: 编辑弹窗高度不再被时间控件撑高，浮窗未展开时弹窗内容高度不超过 260px。
- **SC-004**: `pnpm check` 与 `pnpm build` 全部通过，`dist/client.js` 与 `dist/client.css` 的 gzip 合计不超过 120 KB。
- **SC-005**: 现有配置页与编辑弹窗的回归测试全部通过，新增测试覆盖浮窗选择与小时间隔。

## Assumptions

- 本次只改动 DSH 网页端配置页与编辑弹窗，飞书侧的推送内容与命令不受影响。
- 时间的判定逻辑、节假日数据与路由保持不变。
- 用户在网页端使用鼠标或触控板操作，键盘可达作为补充要求。
- 视觉沿用宿主现有配置页的密度与字号，不引入新的设计语言。
