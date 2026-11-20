# 研究记录: 设置界面 UI 优化

**Feature**: `028-plugin-ui-polish` | **Date**: 2026-11-20

## 宿主下拉卡片替代原生 select

- **Decision**: 用 `@deepseek-ai/dsh-client-ui-primitives` 的 `Menu` 承载选项，`portal` 挂到 `document.body`，`align="start"`，`minWidthFromAnchor`，`selection="check"`，`selectedId` 指向当前工作区，`anchorRef` 指向触发控件。
- **Rationale**: 宿主全部下拉（模型菜单、工作区切换）都用这套卡片，样式与键盘行为现成；portal 避免设置弹窗的滚动容器裁剪列表。
- **Alternatives**: 自绘下拉卡片需自行实现定位、外部关闭、键盘漫游，且难以复刻阴影与描边变量。原生 `select` 的浮层由操作系统绘制，无法与页面风格统一。

## 触发控件

- **Decision**: 宿主 `Button`（`variant="outline"`、`size="md"`），内容为标题、路径与 `IconChevronDownOutlineRegular`；外层用 `display: grid` 容器让 `Menu` 的 `inline-flex` 根节点撑满整行。
- **Rationale**: `Button` 直接带宿主的悬停、聚焦与描边样式；`Menu` 根节点是 `inline-flex`，grid 父容器默认拉伸子项，可得到全宽触发区。
- **Alternatives**: 自绘按钮需要复刻 `--dsw-alias-button-*` 变量；在 `inline-flex` 根节点上直接设宽度会随内容收缩。

## 选项标签

- **Decision**: 每行标签为 `标题 — 路径` 单行文本，沿用当前 `<option>` 的格式。
- **Rationale**: `Menu` 的行标签固定 `nowrap` 加省略号，多行布局会被裁切；单行标签配合 `minWidthFromAnchor` 保证路径可见。
- **Alternatives**: 标题与路径分两行显示需要覆盖宿主 CSS Module 的 `nowrap`，改动宿主样式契约。

## 复制命令

- **Decision**: 每条命令右侧常驻 `Button`（`variant="ghost"`、`size="sm"`），内联 16px 复制 SVG；成功后同一位置换成对勾，状态由宿主 `useClipboardCopy` 提供。
- **Rationale**: 宿主 hook 已处理 ClipBoard API 与 `execCommand` 回退，并只在写入成功后进入成功态，天然满足失败不显示成功态。
- **Alternatives**: 自实现计时器需额外维护定时器与卸载清理；宿主包没有复制图标，图标只能内联 SVG。

## 检测按钮位置

- **Decision**: 移除状态文字的 `flex: 1`，让检测按钮紧跟状态文字；行尾留空。
- **Rationale**: 需求是按钮紧邻状态，`flex: 1` 正是把按钮推到行尾的原因。
- **Alternatives**: 用 `margin-inline-start: auto` 保持右对齐与需求相反。

## 测试策略

- **Decision**: 保持 SSR 与纯函数测试，不引入 jsdom；交互行为在真实宿主里用截图验证。
- **Rationale**: 用户明确交互不需要自动化测试；`Menu` 的 portal 在服务端渲染不可用，SSR 只能覆盖关闭态与纯函数。
- **Alternatives**: 引入 jsdom 可覆盖展开与选中，但新增依赖与测试基础设施，收益不被需求接受。

## 删除「恢复默认」

- **Decision**: 删除 `WorkspaceSelect` 的 `onReset`、`overridden` 属性与 `config.reset`、`config.overridden` 字典键，`ConfigPage` 不再传 `resetField`。
- **Rationale**: 字典键失去消费者后保留会与 i18n 规范「用户可见文案经字典提供、键集一致」形成死键；`config.overridden` 已经没有任何渲染点。
- **Alternatives**: 保留属性但不再渲染，会让接口与界面不一致。
