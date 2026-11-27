# Quickstart: 上报卡片折叠开关

## 验证命令

```sh
pnpm check
pnpm build
```

## 场景验证

1. **默认展开**：渲染 `ReportCard`，断言根元素 `data-expanded="true"`，切换按钮 `aria-expanded="true"`、文案为「收起」，`.dsh-lark-report-desc`、`.dsh-lark-report-body`、`.dsh-lark-report-files` 均在 DOM 中可见。
2. **点击折叠**：点击 `.dsh-lark-report-toggle` 按钮，断言 `data-expanded="false"`、`aria-expanded="false"`、按钮文案变为「展开」；`.dsh-lark-report-desc`、`.dsh-lark-report-body`、`.dsh-lark-report-files` 被隐藏，头部显示 `.dsh-lark-report-head-desc` 单行任务摘要。
3. **点击重新展开**：再次点击 `.dsh-lark-report-toggle` 按钮，断言恢复为 `data-expanded="true"`、`aria-expanded="true"`，完整内容恢复。
4. **正文颜色不回退**：运行 `tests/card-styles.test.ts`，确认 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 保持 `color: var(--dsw-alias-label-primary)`。
