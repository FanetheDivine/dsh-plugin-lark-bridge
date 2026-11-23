# Feature Specification: 插件图标铺满与元数据文案

**Feature Branch**: `fix/038-icon-full-bleed`

**Created**: 2026-11-23

**Status**: Approved

**Input**: User description: "icon需要占据全部宽高 dsh自带白边"；"再改点 title:用飞书连接DSH desc:配置lark-cli，用在手机上也可以和DSH对话"

**变更类别**: 插件变更

## Open Decisions

无未决项。

探索结论（来自宿主版本与仓库现状）：

- 宿主 Plugin Manager 自己绘制图标底板：卡片底板 48px、行底板 40px，底板带 0.5px 描边与圆角；底板内的图片按 36px 与 30px 绘制。
- 当前 `icon.svg` 用 `translate(7 7) scale(1.375)` 放置图形；图形墨水盒在画布内为 18.05×14.35 单位，仅占 36 单位画布的 50% 宽与 40% 高。
- 图形墨水盒原始尺寸为 13.126×10.433 单位，长宽比 1.258。
- 宿主文档 `artwork.md` 建议图标光学尺寸 18–22 单位，并要求不要为了填满底板而放大图形。本需求取相反方向，属于用户明确要求。
- 插件行与详情页的标题、描述来自 `locale/zh.json` 与 `locale/en.json` 的 `meta`；`package.json` 的 `description` 是同字段的回落值，也是 npm 包页描述。
- `tests/metadata.test.ts` 只校验结构、键集、非空与标题单行，不断言具体文案。
- `tests/icon.test.ts` 校验画布、背景、颜色、禁用元素、字节上限与三处清单声明，不校验图形墨水盒。

## Clarifications

### Session 2026-11-23

- [D-001] Q: 图形墨水盒是 13.126×10.433（长宽比 1.258），要铺满 36×36 画布必须选择一种放法。用哪种？ -> A: 等比放大到宽度 36。高度约 28.6 单位，上下各留约 3.7 单位，标志比例与官方一致。
- [D-002] Q: 选等比放大后，图形左右边与画布边缘是否保留防裁切间距？ -> A: 左右相切，间距 0。
- [D-003] Q: 是否把插件装到 profile 并在真实 GUI 里确认渲染效果？ -> A: 执行实机验证。
- [D-004] Q: 本次需要更新哪些文档？ -> A: 只加 CHANGELOG 条目。
- [D-005] Q: 中文标题改为「用飞书连接DSH」，英文标题用哪个？ -> A: `Connect DSH from Lark`。
- [D-006] Q: 英文描述用哪句？ -> A: `Configure lark-cli so you can talk to DSH from your phone too.`
- [D-007] Q: `package.json` 的 `description` 是否一起改？ -> A: 同步改为新描述「配置lark-cli，用在手机上也可以和DSH对话」。
- 实现澄清：`npm pack --dry-run --json` 不输出包描述字段，SC-006 的描述核对改为直接读 `package.json`；需求文案不变。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 等比放大使上下留白约 3.7 单位；图形左右与宿主 0.5px 描边相切；图标尺寸违背宿主 artwork.md 的 18–22 单位建议（用户要求）；元数据逐字文案依赖实机与打包核对

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 插件图标满幅显示 (Priority: P1)

用户在插件管理页与设置页看到飞书桥接插件时，图标横向铺满宿主底板的内框，不再出现图形自身留出的空白。

**Why this priority**: 这是用户报告的问题本身；不解决则图标持续显得过小。

**Independent Test**: 以 36 单位渲染 `icon.svg`，测量图形墨水盒与画布四边的间距；在插件管理页对比图标与同排其他插件。

**Acceptance Scenarios**:

1. **Given** 图标以 36×36 渲染，**When** 测量图形墨水盒，**Then** 墨水盒宽度等于画布宽度，左右边与画布相切。
2. **Given** 图标以 36×36 渲染，**When** 测量图形墨水盒，**Then** 高度约 28.6 单位，上下留白各约 3.7 单位且左右对称。
3. **Given** 插件管理页的 48px 卡片底板，**When** 观察图标，**Then** 图形横向占满底板内框，插件自身不再增加横向间距。

---

### User Story 2 - 标题与描述说明用途与手机使用 (Priority: P2)

用户在插件行、详情页与 npm 包页看到新的标题与描述，能直接看出插件由飞书连接 DSH，并可在手机上使用。

**Why this priority**: 元数据是用户发现插件时唯一能读到的能力说明；旧文案强调 bot 身份与注入机制，没有说明手机端用法。

**Independent Test**: 在插件页切换中英文，检查标题与描述；执行 `npm pack --dry-run --json` 读取包描述。

**Acceptance Scenarios**:

1. **Given** 语言为中文，**When** 用户查看插件行与详情页，**Then** 标题为「用飞书连接DSH」，描述为「配置lark-cli，用在手机上也可以和DSH对话」。
2. **Given** 语言为英文，**When** 用户查看插件行与详情页，**Then** 标题为 `Connect DSH from Lark`，描述为 `Configure lark-cli so you can talk to DSH from your phone too.`
3. **Given** 插件处于停用状态，**When** 用户查看插件行，**Then** 仍显示新标题与描述。
4. **Given** 发布包，**When** 读取包描述，**Then** `description` 为「配置lark-cli，用在手机上也可以和DSH对话」。

---

### User Story 3 - 小尺寸与宿主约束下仍正常 (Priority: P3)

用户在 30px 行尺寸下仍能认出飞书标志，宿主继续正常解码图标。

**Why this priority**: 放大与文案替换都可能破坏既有约定，回归成本低。

**Independent Test**: 以 30px 渲染检查三段色块；用宿主同款解码方式加载图标；检查打包内容。

**Acceptance Scenarios**:

1. **Given** 图标以 30px 渲染，**When** 观察行底板中的图标，**Then** 青绿、蓝、深蓝三段仍然可区分，标志轮廓完整。
2. **Given** 新版 `icon.svg`，**When** 宿主解码，**Then** 图标成功显示，不出现默认图回退。
3. **Given** 新版图标与元数据，**When** 打包，**Then** 图标与两份 `locale` 文件进入发布包，清单声明不变。

---

### Edge Cases

- 图形左右贴到画布边缘后，宿主 0.5px 描边与图形边缘相切，图形边缘不能被描边遮住。
- 等比放大保留官方比例，画布上下各留约 3.7 单位空白；这部分空白属于画布，不再额外裁切。
- 标题在插件行单行显示，需要中英文都保持可读长度。
- 元数据文件缺失或多出第三种语言时，宿主回落行为不变。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 图标 MUST 保持 36×36 画布输出。
- **FR-002**: 图形 MUST 等比放大到画布宽度，左右边与画布相切，上下居中留白。
- **FR-003**: 图形墨水盒宽度 MUST 等于 36 单位，高度 MUST 约为 28.6 单位，保持 1.258 的官方长宽比。
- **FR-004**: 图标 MUST 保持透明背景，不含脚本、事件处理、外链图片、`<style>` 与 `<foreignObject>`。
- **FR-005**: 图标 MUST 保留飞书三段品牌色 `#00D6B9`、`#3370FF`、`#133C9A`，标志轮廓在 36 单位与 30px 渲染下可辨识。
- **FR-006**: 图标文件 MUST 不超过 256 KiB。
- **FR-007**: 清单声明 MUST 继续把 `package.json` 顶层 `icon`、`exports["./icon"]` 与 `files` 指向该图标文件。
- **FR-008**: 仓库测试 MUST 校验图形墨水盒铺满画布宽度，而不仅校验画布尺寸。
- **FR-009**: `locale/zh.json` 的 `meta.title` MUST 为「用飞书连接DSH」。
- **FR-010**: `locale/zh.json` 的 `meta.description` MUST 为「配置lark-cli，用在手机上也可以和DSH对话」。
- **FR-011**: `locale/en.json` 的 `meta.title` MUST 为 `Connect DSH from Lark`。
- **FR-012**: `locale/en.json` 的 `meta.description` MUST 为 `Configure lark-cli so you can talk to DSH from your phone too.`
- **FR-013**: `package.json` 的 `description` MUST 为「配置lark-cli，用在手机上也可以和DSH对话」。
- **FR-014**: 两份元数据文件的 `meta` 键集 MUST 一致，标题 MUST 非空且单行。
- **FR-015**: CHANGELOG MUST 记录图标尺寸与元数据文案的变更。

### Key Entities

- **图标资产**: 仓库根目录的 `icon.svg`，36 单位画布、三段路径、透明背景。
- **清单声明**: `package.json` 中指向图标的三个字段，决定宿主能否找到并打包图标。
- **元数据资源**: `locale/zh.json` 与 `locale/en.json` 的 `meta.title`、`meta.description`，以及 `package.json` 的 `description`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 以 36 单位渲染时，图形墨水盒宽度为 36 单位，容差 ±0.1；高度为 28.6 单位，容差 ±0.2；墨水盒不超出画布。
- **SC-002**: 以 36 单位渲染时，墨水盒左右与画布间距不大于 0.01 单位，上下留白差的绝对值不大于 0.1 单位。
- **SC-003**: 以 30px 渲染时，三段品牌色仍可区分，标志轮廓无缺口。
- **SC-004**: 图标文件不超过 256 KiB，宿主解码成功且不回落默认图；在真实宿主中确认 48px 卡片底板与 40px 行底板的渲染结果。
- **SC-005**: 中文与英文的插件标题、描述分别等于 FR-009 至 FR-012 的文案，插件停用状态下同样可见。
- **SC-006**: `package.json` 的 `description` 等于 FR-013 的文案，发布包包含图标与两份元数据文件。

## Assumptions

- 图标底板由宿主绘制，插件的 SVG 只提供图形，不添加底板或背景。
- 底板圆角位于宿主底板外层，图形贴边不会与圆角相冲突。
- 画布上下的等比留白在 30px 与 36px 显示尺寸下不影响标志识别。
- 英文文案按 sentence case，只大写首词与专有名词。
- 用户给定的中文文案原样使用，包括标点与大小写。
