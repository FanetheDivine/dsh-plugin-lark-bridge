# Research: 优化上报与通知卡片 GUI 悬停与点击热区

## R1 宿主参考结构 `section.hSzSIW_root`

**Decision**: 采用宿主 `TurnTriggerNodeView` 的分区模式：容器不设内边距，顶部整宽按钮承担热区内边距，展开内容在按钮之外各自承担内边距。

**Facts**（读自本机安装的 DSH `app.asar` 内 `@deepseek-ai/dsh-client-ui-chat/TurnTriggerNodeView.module.css` 与组件代码）:

- DOM：`<section class="root" data-turn-trigger><button class="header" aria-expanded aria-controls>…</button>{open && <div class="body" id>…</div>}</section>`。
- `.root`：`border: .5px solid var(--dsw-alias-border-l1)`、`border-radius: var(--dsw-radius-xl)`、`background: var(--dsw-alias-turn-trigger-bg, var(--dsw-alias-markdown-code-block))`、`transition: background-color .1s`，无 padding。
- `@media (hover:hover)` 下 `.root:hover` 背景 `var(--dsw-alias-turn-trigger-bg-hover, var(--dsw-alias-interactive-bg-hover))`；`.header:hover` 只加深文字色。
- `.header`：`width: 100%`、`padding: 12px 16px`、按钮复位（`background: 0 0; border: 0; font: inherit; text-align: left; cursor: pointer`）。
- `.body`：`padding: 0 16px 12px 40px`，宿主无分隔线。
- `@media (prefers-reduced-motion:reduce)` 下 root 与 header `transition: none`。

**Rationale**: 用户点名参考该结构。插件保留自己的分隔线与既有间距尺度，只迁移「容器无内边距 + 热区铺满上半部分 + 整卡悬停变色」三点。

**Alternatives considered**: 完全照抄宿主 padding 与圆角（xl、12px 16px、无分隔线）——与用户「分隔线上方」表述冲突，弃用。

## R2 上报卡片现状

**Facts**:

- `src/client/report-card.tsx`：`section.dsh-lark-report` 内依次为 `button.dsh-lark-report-head`（标题行）、展开态 `div.dsh-lark-report-desc`、`div.dsh-lark-report-body`（border-top）、`div.dsh-lark-report-files`（border-top）。
- `src/client/report-card.css`：容器 `padding: 10px 14px 12px; gap: 8px`；head `padding: 2px 0`，自带 hover 底色；body/files 只有 `padding-top: 8px`，左右无内边距。
- 热区只覆盖标题行行盒，卡片内边距与展开态 desc 不在按钮内。

**Decision**: 容器去掉 padding/gap；head 改为纵向 flex（标题行 span + 展开态 desc），`padding: 10px 14px`；body/files `padding: 8px 14px 12px` 并保留 border-top；删除 head 自身 hover 底色，改由容器 `:hover` 整体变色。

## R3 通知卡片现状

**Facts**:

- `src/client/notify-card.tsx`：文本模式直接渲染 `div.dsh-lark-notify-body`；卡片模式渲染 `div.dsh-lark-notify-summary` + `<details>`（summary 文案 `notify.expand`「完整内容」）；任务行与会话行是 `footer.dsh-lark-notify-session`。
- 数据：`text`、可选 `summary`（仅 `mode === 'card'`）、可选 `taskId`、可选 `sessionId`；`useWorkspaces` 判定 active/archived/missing/unassociated。
- `tests/notify-card.test.ts` 断言 `<details>` 结构、`section.children` 长度、`container.querySelector('button')` 取会话链接。

**Decision**: 改为上报卡片同构：顶部 `button.dsh-lark-notify-head` 热区（图标 + 总结或「通知」标题 + 箭头），`expanded` 初值 `summary === undefined`；正文在分隔线下方；任务与会话行包进 `footer.dsh-lark-notify-meta` 常显；移除 `<details>`。

## R4 构建与样式测试链路

**Facts**:

- `tsdown.config.ts` 浏览器组把 CSS 内联进 `dist/client.js`（`inlineClientCss`），无独立 CSS 产物。
- `tests/card-styles.test.ts` 直接读 `src/client/*.css`，`ruleOf` 按选择器精确取规则块，支持 `@media` 内嵌规则。
- `tests/client-bundle.test.ts` 断言内联样式含 `.dsh-lark-report`；平台组件桩已含 `IconChevronDownOutlineRegular` 与 `IconPaperPlaneOutlineRegular`。

**Decision**: 不新建测试文件；更新 `report-card.test.ts`、`notify-card.test.ts`、`card-styles.test.ts`。产物测试无需改动。

## R5 字典键

**Facts**: `src/client/locales.ts` 中文字典是键集事实源；现有 `notify.expand` = 「完整内容」/「Full content」，仅用于 `<details>` summary。

**Decision**: 新增 `notify.title`（通知 / Notification）、`notify.collapse`（收起 / Collapse）；`notify.expand` 改值为 展开 / Expand，用作热区无障碍名称。键集变化由 `notify-card.test.ts` 文案用例覆盖。

## R6 文档归属

**Facts**: 卡片机制描述归属 `docs/how-it-works.md`（`lark_notify` 节约 208 行、上报卡片节约 328 行）；README 不描述卡片 UI（077 先例：无需改动）；CHANGELOG 当前为空，分支在 push 时补 `## Unreleased` 条目。

**Decision**: 更新 `docs/how-it-works.md` 两处卡片段落；push 前写 CHANGELOG。

## R7 实机验证可行性

**Facts**: 两张卡片都只在工具成功投递后产出：`send_report` 需要被管理会话与调度工作区台账，`lark_notify` 需要 lark-cli bot 凭据真实发送。`real-device-test` 的隔离 profile 用 mock provider，无飞书凭据，无法产生真实成功结果。

**Decision**: 本轮不做实机端到端，验证由 jsdom 交互测试、CSS 规则断言与产物契约测试覆盖；宪章 II 的 SHOULD 项在此记录理由。合并发布后用户在真实会话中直接可见新卡片。
