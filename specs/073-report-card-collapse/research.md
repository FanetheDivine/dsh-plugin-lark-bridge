# Research: 上报卡片折叠开关

## R1: GUI 中所有「报告」渲染位置盘点

**Decision**: 改造 `src/client/report-card.tsx`（`ReportCard`）与 `src/client/report-card.css`，不改动其他组件。

**Rationale**:
1. 客户端入口 `src/client/index.ts` 只向 `conversation.chat.node` 注册两个自定义节点渲染器：
   - `lark-report` -> `ReportCard`（`src/client/report-card.tsx`），由 `src/client/report-node.ts` 从 `send_report` 的 `tool/call` 与成功 `tool/result` 生成，覆盖 `progress`、`question`、自定义字符串与空字符串等全部 `kind`。
   - `lark-notify` -> `NotifyCard`（`src/client/notify-card.tsx`），由 `src/client/notify-node.ts` 从 `lark_notify` 生成，展示飞书通知正文（`mode: 'card'` 时已有 `<details>` 折叠），不属于上报卡片。
2. 被管理会话的提问拦截（`ask_intercept`）和轮次结束自动上报（`turn_end`）在后端直接调用 `service.sendReport` 存档并经 `agent.steer` 向调度会话投递 `<task_session_message>`，不产生 `send_report` 工具事件。
3. 调度会话收到的 `<task_session_message>`、`<task_session_failure>`、`<task_session_archived>`（`source.kind = 'lark-super-agent'`）与 `<task_log_entry>`（`source.kind = 'lark-task-log'`）在宿主 Chat 中按非用户消息归入 `context` 或 `turn-trigger` 节点，由宿主内置 `ContextInjectionRow`（基于 `DisclosureRow`）或 `TurnTriggerNodeView` 渲染，本身已具备折叠/展开开关。

**Alternatives Considered**:
- 同时修改 `NotifyCard`：`NotifyCard` 是飞书通知卡片而非上报卡片，且卡片模式已有折叠 `<details>`，修改会偏离需求范围并破坏现有通知卡片契约测试。

## R2: 折叠开关与摘要行交互设计

**Decision**:
- `ReportCard` 使用 `useState(true)` 维护本地 `expanded` 状态（默认 `true`），使用 `useId()` 生成可折叠区域的 `bodyId`。
- 根元素 `<section className="dsh-lark-report">` 增加 `data-expanded={expanded ? 'true' : 'false'}` 供样式和选择器识别。
- 头部 `<header className="dsh-lark-report-head">` 包含：
  1. 飞机图标 `.dsh-lark-report-icon`
  2. 标题 `.dsh-lark-report-title`
  3. 类型标签 `<Tag>`（当 `kind !== ''`）
  4. 折叠态单行摘要 `.dsh-lark-report-head-desc`（仅当 `!expanded && desc !== ''` 时渲染，单行 `text-overflow: ellipsis` 展示 `desc`，避免折叠后丢失任务摘要上下文）
  5. 送达回执 `.dsh-lark-report-receipt`（含 `reportId`）
  6. 折叠/展开按钮 `<button type="button" className="dsh-lark-report-toggle" data-dsh-lark-report-toggle="" aria-expanded={expanded} aria-controls={hasContent ? bodyId : undefined} aria-label={toggleLabel} title={toggleLabel} onClick={() => setExpanded((prev) => !prev)}>`，内部包含 `<IconChevronDownOutlineRegular size={14} className="dsh-lark-report-toggle-icon" />` 与文字 `<span className="dsh-lark-report-toggle-text">{toggleLabel}</span>`。
- 展开时（`expanded === true`）渲染原有的 `.dsh-lark-report-desc`、`.dsh-lark-report-body`、`.dsh-lark-report-files`；折叠时（`expanded === false`）不渲染这三个区块。

**Rationale**:
- 按钮同时提供文字（「收起」/「展开」）与旋转箭头图标，直观易读，且原生 `<button type="button">` 天然支持 Tab 聚焦与 Enter/Space 键盘操作。
- 折叠后保留完整头部行（含单行任务摘要预览、状态标签、送达回执和开关），满足「折叠后只保留标题/摘要行与开关，展开恢复完整内容」。
- `IconChevronDownOutlineRegular` 已在 `@deepseek-ai/dsh-client-ui-primitives` 导出并在 `config-page.tsx` 与 `tests/support/primitives.ts` 中使用，无需新增平台种子依赖。

**Alternatives Considered**:
- 使用 HTML `<details>` / `<summary>`：`<details>` 的默认三角标记和 flex 头部布局在不同浏览器下样式定制受限，且需求明确要求按钮语义与 `aria-expanded`。
- 仅图标无文字按钮：加上简短文字（「收起」/「展开」）能让开关在回执右侧更醒目，也方便测试与屏幕阅读器识别。
