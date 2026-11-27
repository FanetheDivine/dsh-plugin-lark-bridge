# 研究与决策

## 头部元素用原生按钮

**Decision**: 用 `<button type="button">` 承载整个头部，取消独立的折叠按钮。

**Rationale**: 原生按钮自带 Enter / Space 触发与按钮语义，DSH 卡片里其他可点击行同样使用原生按钮。整行即焦点目标，热区与键盘可达范围一致。

**Alternatives considered**:

- `div` + `role="button"` + 手写键盘处理：语义靠脚本维持，遗漏 `tabindex` 或按键分支时不可用。
- 保留小按钮并给头部加 `onClick`：热区与焦点目标不一致，屏幕阅读器只认识小按钮，点击回执区域仍无法切换。

## 头部子元素可安全嵌套

**Decision**: 标题、类型标签、折叠态摘要、回执与报告编号保持 `<span>` 与 `Tag`，全部放进头部按钮。

**Rationale**: `Tag` 渲染为 `<span>`，`IconPaperPlaneOutlineRegular` 与 `IconChevronDownOutlineRegular` 渲染 SVG，都是按钮允许的短语内容。附件按钮留在头部之外，不产生嵌套按钮。

## 热区就是头部行盒

**Decision**: 头部改为按钮，宽度撑满卡片内容盒，`padding: 2px 0`，不加外边距；卡片内边距与间距保持原值。

**Rationale**: 2px 上下内边距与旧折叠按钮撑起的行高一致。实测展开态卡片高度、简介、正文与附件坐标与改前相同。

**Alternatives considered**: 负外边距把热区扩到卡片内边距，会牵动头部与正文的间距计算，收益有限。

## 箭头与无障碍名称

**Decision**: 只渲染箭头图标；`aria-label` 取 `report.collapse` / `report.expand`；去掉 `title`。

**Rationale**: 可见文字与箭头重复，无障碍名称是与屏幕阅读器唯一的状态通道。整行带 `title` 会让鼠标划过卡片时反复弹出提示。

## 文案键保留

**Decision**: `src/client/locales.ts` 的 `report.collapse` 与 `report.expand` 保持不变，继续作为无障碍名称与测试基准。

**Rationale**: 两个键已在 dictionaries 中维护，删除会同时丢弃屏幕阅读器文案。
