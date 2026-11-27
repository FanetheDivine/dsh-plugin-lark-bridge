# 快速验证

## 准备

```sh
pnpm install
```

在 `worktrees/077-report-header-toggle` 下执行。

## 命令

```sh
pnpm test:code --report-card
pnpm check
pnpm format
```

## 场景

1. **头部是按钮**：渲染 `ReportCard`，断言 `[data-dsh-lark-report-toggle]` 的 `tagName` 为 `BUTTON`，`aria-expanded="true"`，`aria-label="收起"`，且 `title` 为空。
2. **只留箭头**：断言头部 `textContent` 不含「收起」「展开」；中英文回退下分别不含 `Collapse` / `Expand`，`aria-label` 仍为对应文案。
3. **整行点击**：分别点击 `.dsh-lark-report-title`、`Tag`、`.dsh-lark-report-receipt`，每次都切换 `data-expanded`。
4. **折叠内容**：折叠后 `.dsh-lark-report-desc`、`.dsh-lark-report-body`、`.dsh-lark-report-files` 消失，头部保留标题、标签、摘要与回执；再次点击恢复。
5. **附件不受影响**：点击 `.dsh-lark-report-file` 只调用 `openFile`，不改变 `data-expanded`。
6. **样式**：`report-card.css` 中断言头部按钮的整行悬停、`:focus-visible` 焦点环与 `[aria-expanded="true"]` 箭头旋转规则；卡片内边距仍为 `10px 14px 12px`，正文主前景色规则保留。
7. **文档**：`docs/how-it-works.md` 的上报卡片段落描述整行箭头开关。

## 实机

`pnpm dev` 后在本机 DSH Web GUI 打开任一含上报卡片的会话，点击卡片头部左侧标题、中部标签与右侧回执，确认都能折叠与展开；键盘 Tab 到头部后按 Enter 与 Space 切换。
