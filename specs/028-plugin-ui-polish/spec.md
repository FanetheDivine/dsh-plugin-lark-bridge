# Feature Specification: 设置界面 UI 优化

**Feature Branch**: `028-plugin-ui-polish`

**Created**: 2026-11-20

**Status**: Draft

**Input**: User description: "优化当前的ui 1. “工作区”“恢复默认”删除 2. 检测xxx 按钮太远了 放在 已连接 右边 3. 命令右侧增加复制按钮 4. 选择工作区select浮窗样式很丑。这一点要求截图读图优化ui"

## Open Decisions

探索结论（来自代码、宿主包与实机截图）：

- 工作区字段由 `src/client/config-page.tsx` 的 `WorkspaceSelect` 渲染，配置页与设置弹窗共用。
- 连接项由 `src/client/auth-panel.tsx` 渲染，状态文字用 `flex: 1` 把检测按钮推到行尾，这是按钮过远的直接原因。
- 命令由 `src/client/terminal-command.tsx` 渲染为单个 `code` 元素，没有容器与操作区。
- 宿主 `@deepseek-ai/dsh-client-ui-primitives` 提供 `Menu`（下拉卡片，含选中态与键盘导航）、`MenuItemButton`、`useClipboardCopy`（成功态保持 1 秒）、`Button` 与 `IconChevronDownOutlineRegular`；宿主没有复制图标，复制图标用内联 SVG。
- 宿主下拉卡片样式：白底、约 12px 圆角、1px 描边、阴影，行高约 32px，悬停填充，选中行带对勾。
- 原生 `select` 的展开浮层由操作系统绘制，页面截图无法捕获；截图已确认关闭态控件与整页风格割裂，改版基准取宿主自身的下拉卡片。

已确认的决策见 `## Clarifications`。

## Clarifications

### Session 2026-11-20

- [D-001] Q: 删除「工作区」标题后，字段靠什么标识？ -> A: 只删除「恢复默认」，保留标题「工作区」。
- [D-002] Q: 删除「恢复默认」后，用户如何回到默认选择？ -> A: 不提供替代入口。
- [D-003] Q: 检测按钮文案是否缩短？ -> A: 保留「检测 lark-cli」等全称，只把按钮位置移到状态文字右侧。
- [D-004] Q: 复制按钮的形态与成功反馈？ -> A: 图标按钮，复制成功后图标变对勾并保持约 1.5 秒。
- [D-005] Q: 复制按钮何时可见？ -> A: 常驻显示。
- [D-006] Q: 浮层的键盘与关闭行为范围？ -> A: 方向键移动、Enter 选中、Esc 与点击外部关闭、选中行有标记。
- [D-007] Q: 浮层视觉基准？ -> A: 复用宿主 `Menu` 下拉卡片。
- [D-008] Q: 复制成功态保持多久？ -> A: 跟随宿主 `useClipboardCopy` 的成功态，约 1 秒；具体时长不是需求重点。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: 原生下拉浮层无法用页面截图核对，浮层视觉以宿主 `Menu` 为基准
- 2026-11-20 | Decision: Waived | Scope: current full document | Open items: none | Risks: 用户要求不再追问并直接实现，FR-007 时长按 D-008 采用宿主 1 秒

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 检测按钮紧邻状态 (Priority: P1)

用户在插件设置里查看 lark-cli、机器人身份、用户身份三个连接项。每项的状态文字右侧紧跟该行的检测按钮。

**Why this priority**: 检测按钮是这一步唯一动作，离状态文字越远越难对应到具体连接项。

**Independent Test**: 打开设置，确认三行中检测按钮紧邻状态文字，点击任一按钮只触发该行检测。

**Acceptance Scenarios**:

1. **Given** 三个连接项都已展示，**When** 用户查看任一行，**Then** 该行检测按钮紧接在状态文字右侧。
2. **Given** 检测请求进行中，**When** 用户查看各行，**Then** 检测按钮处于禁用态。
3. **Given** 界面切到英文，**When** 用户查看任一行，**Then** 检测按钮仍紧邻状态文字，文案完整。

---

### User Story 2 - 一键复制命令 (Priority: P1)

用户看到需要在自己终端执行的命令，点击命令右侧常驻的复制按钮即复制整条命令。

**Why this priority**: 命令含 scope 与包名，手抄易错。

**Independent Test**: 点击三行中任一复制按钮，粘贴到文本编辑器，内容与该行命令完全一致。

**Acceptance Scenarios**:

1. **Given** 命令已展示，**When** 用户点击复制按钮，**Then** 剪贴板内容等于该行命令原文。
2. **Given** 复制成功，**When** 用户继续操作界面，**Then** 按钮图标变对勾，约 1 秒后恢复。
3. **Given** 剪贴板写入被拒绝，**When** 用户点击复制按钮，**Then** 按钮不显示成功态，命令仍可手动选择复制。

---

### User Story 3 - 去掉恢复默认入口 (Priority: P2)

用户在同一界面选择工作区。字段保留「工作区」标题，不再有「恢复默认」按钮。

**Why this priority**: 工作区必须来自注册列表，重置为空只会制造无效状态。

**Independent Test**: 打开配置页与设置弹窗，确认两处都有标题、都没有「恢复默认」。

**Acceptance Scenarios**:

1. **Given** 配置页已打开，**When** 用户查看工作区字段，**Then** 标题「工作区」可见，「恢复默认」不可见。
2. **Given** 设置弹窗已打开，**When** 用户查看工作区字段，**Then** 呈现与配置页一致。
3. **Given** 配置值被覆盖过，**When** 用户查看字段，**Then** 界面不出现任何重置入口。

---

### User Story 4 - 工作区选择浮层与宿主一致 (Priority: P2)

用户展开工作区选择控件，浮层呈现已注册工作区的标题与路径，视觉与交互同宿主其它下拉一致。

**Why this priority**: 现有浮层是浏览器原生样式，与页面其余控件风格割裂。

**Independent Test**: 展开选择控件，逐项核对浮层外观、键盘操作、选中态与关闭方式。

**Acceptance Scenarios**:

1. **Given** 选择控件已展示，**When** 用户展开它，**Then** 宿主风格的下拉卡片在控件附近出现，列出全部已注册工作区。
2. **Given** 浮层已展开，**When** 用户点选某项，**Then** 控件显示该项，浮层关闭。
3. **Given** 浮层已展开，**When** 用户按方向键并回车，**Then** 高亮在行间移动，回车选中当前行。
4. **Given** 浮层已展开，**When** 用户按 Esc 或点击浮层外部，**Then** 浮层关闭且已选值不变。
5. **Given** 已注册工作区为空，**When** 用户查看控件，**Then** 控件显示空态文案且不可展开。

### Edge Cases

- 工作区路径很长时，控件内文本截断并省略，浮层内不横向溢出。
- 工作区标题重复时，浮层依靠路径区分各项。
- 设置弹窗内的浮层不被弹窗边界裁剪。
- 检测请求进行中，复制按钮仍可用。
- 复制反馈未结束就再次点击，最终状态与最后一次结果一致。
- 键盘展开浮层后关闭，焦点回到触发控件。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 工作区字段 MUST 保留标题「工作区」，且 MUST NOT 渲染「恢复默认」入口。
- **FR-002**: 配置页与设置弹窗的工作区字段 MUST 呈现一致。
- **FR-003**: 每个连接项的检测按钮 MUST 紧接该行状态文字右侧。
- **FR-004**: 检测按钮 MUST 按行独立，仅触发所属连接的检测，文案保留「检测 lark-cli」等全称。
- **FR-005**: 每条终端命令 MUST 在右侧提供常驻复制按钮。
- **FR-006**: 复制 MUST 使用该行命令原文，不做裁剪或转义。
- **FR-007**: 复制成功后，按钮 MUST 呈现对勾成功态，并在宿主 `useClipboardCopy` 的 1 秒后恢复。
- **FR-008**: 复制失败时，按钮 MUST NOT 呈现成功态，命令 MUST 保持可手动选择。
- **FR-009**: 工作区选择 MUST 使用宿主下拉卡片替代浏览器原生下拉浮层。
- **FR-010**: 浮层 MUST 展示每项的工作区标题与路径，并标出当前选中项。
- **FR-011**: 浮层 MUST 支持方向键移动、Enter 选中、Esc 关闭与点击外部关闭。
- **FR-012**: 无已注册工作区时，控件 MUST 显示空态文案并禁止展开。
- **FR-013**: 上述文案 MUST 同时提供中文与英文版本。

### Key Entities

- **连接项**: 一条连接的状态行，含名称、状态、检测按钮与终端命令。
- **终端命令**: 需要在插件外执行的命令行文本。
- **工作区选项**: 已注册工作区，含标题与路径。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 三行连接项中，检测按钮与状态文字的水平间距不超过 8px。
- **SC-002**: 复制命令只需一次点击，粘贴结果与命令原文逐字符一致。
- **SC-003**: 配置页与设置弹窗各验证一次，均无「恢复默认」，均有「工作区」标题。
- **SC-004**: 浮层展开不出现浏览器原生下拉外观，键盘与关闭行为符合 FR-011。
- **SC-005**: 中英文两种语言下界面无文案缺失或溢出。

## Assumptions

- 界面外观沿用宿主设计变量与组件，不引入新的视觉体系。
- 命令区的文本与容器样式保持现状，只在右侧增加操作区。
- 配置的保存、校验与覆盖语义不变，只调整入口与外观。
- 共享控件改动同时作用于配置页与设置弹窗。
