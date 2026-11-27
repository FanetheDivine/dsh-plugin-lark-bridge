# Quickstart: 优化上报与通知卡片 GUI 悬停与点击热区

## 前置

- Node.js 24.9+、pnpm 11。
- 在 worktree 根目录执行 `pnpm install`。

## 验证命令

| 命令 | 验证 |
| --- | --- |
| `pnpm test:code --report-card` | 上报卡片热区、desc 归属、折叠与文件按钮 |
| `pnpm test:code --notify-card` | 通知卡片两种模式、热区折叠、会话链接与文案 |
| `pnpm test:code --card-styles` | 两卡片的悬停变色、内边距分区、分隔线与焦点环规则 |
| `pnpm format && pnpm check` | 格式、类型、lint 与全部源码测试 |
| `pnpm build` | 产物构建与 `test:dist`（含内联样式契约） |

## 场景与预期

1. **上报卡片热区**：展开态 `.dsh-lark-report-desc` 位于 `button[data-dsh-lark-report-toggle]` 内；点击标题、Tag、回执或 desc 都切换 `data-expanded`；点击文件按钮只触发 `openFile`。
2. **上报卡片悬停**：`card-styles` 断言 `.dsh-lark-report:hover` 使用 `--dsw-alias-turn-trigger-bg-hover` 回退 `--dsw-alias-interactive-bg-hover`，容器无 padding，热区 `padding: 10px 14px`。
3. **通知卡片文本模式**：默认展开，热区显示「通知」；点击热区收起正文，`data-expanded` 翻转；无 `<details>`。
4. **通知卡片卡片模式**：默认折叠，热区显示总结；点击展开正文；会话链接点击不改变展开状态。
5. **通知卡片会话行**：active 会话显示链接并回调 `openSession`；archived 显示标签与只读标识；任务与会话行在折叠态仍常显。
6. **字典**：`notify.title`、`notify.collapse`、`notify.expand` 在 zh/en 都有值；无 `t` 时英文回退。

## 实机说明

两张卡片只在真实飞书投递成功后产出，隔离 mock profile 无法产生成功结果，本轮以 jsdom 与样式断言覆盖（见 research.md R7）。合并发布后在真实会话中发送上报/通知即可目视核对悬停变色与热区。
