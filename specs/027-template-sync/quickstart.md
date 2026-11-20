# 快速验证：迁移模板热更新与前端链接规则

**日期**：2026-11-20 | **规格**：[spec.md](./spec.md) | **计划**：[plan.md](./plan.md)

## 前置

1. 仓库已安装依赖：`pnpm i`。
2. 在功能 worktree 中操作，主工作区保持干净。

## 本次验证

```sh
pnpm format && pnpm check
bash -n .dsh/skills/real-device-test/scripts/setup-env.sh
node --check .dsh/skills/real-device-test/scripts/run-test.mjs
```

预期：

- 质量门禁通过。
- 两个脚本语法检查通过。
- `git diff` 只涉及 skill 五个文件、`docs/development.md` 与 `CHANGELOG.md`。

## 文档核对

1. `docs/development.md` 的「前端 UI 链接」位于「前端构建」之后。
2. 小节含 MUST 要求、Desktop 链接行为的原因与本仓库 URL 示例。
3. skill 的新增迭代段使用 `src/tools.ts` 的 `lark_notify` 与 `requests.jsonl`。
4. 其余 demo 用例保持模板原文。
5. 全文无 `<repo>` 以外的本机绝对路径。

## 模板核对

```sh
git -C <模板仓库> show fe93cd0 -- .dsh/skills/real-device-test
git -C <模板仓库> show 197480e -- docs/development.md
```

逐条比对，预期只有两处验证段按本插件改写：`SKILL.md` 的迭代小节与 `cases.md` 的热更新验证。

## 可选实机验证

本次不执行。需要时先修正 profile 的插件配置为合法键，再按 skill 的迭代小节操作：记录 GUI 进程号、修改 `src/tools.ts` 的 `lark_notify` 说明、`pnpm build`、发送任意消息、在 `requests.jsonl` 核对新说明，确认进程号不变。

## 清理

本次验证不创建 profile。删除临时 profile 的步骤见 skill 阶段 5。
