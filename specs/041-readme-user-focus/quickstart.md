# Quickstart: 验证 README 改写

## 前置

在 worktree `worktrees/041-readme-user-focus` 中执行。

## 检查

| 检查 | 方法 | 预期 |
| --- | --- | --- |
| 全文一致 | 对比 `README.md` 与 [contracts/readme.md](./contracts/readme.md) | 逐字一致 |
| 行数 | `wc -l README.md` | 不超过 40 |
| 二级标题 | `grep -c '^## ' README.md` | 2 |
| 相对链接 | `grep -nE '\]\((\.|/|docs)' README.md` | 无输出 |
| 迁移完整 | 按 [data-model.md](./data-model.md) 逐行核对 `docs/` | 每条都有归属 |
| 锚点 | `grep -rn 'README.md#' docs AGENTS.md` | 只出现 `README.md#使用` |
| 质量门禁 | `pnpm format && pnpm check` | 通过 |
| 进包 | `pnpm run test:code` 中的 package-pack 测试 | `README.md` 在包内 |

## 可选实机核对

在 DSH「插件」页打开本插件详情，确认 README 渲染正常。需要发布或本地安装后才能看到新内容。
