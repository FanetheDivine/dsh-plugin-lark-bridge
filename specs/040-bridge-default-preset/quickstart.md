# 验证指南: 桥接会话默认预设

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-23

## 前置

- 在 worktree 根目录执行 `pnpm install`。
- 需要 Node `>=24.9.0` 与 pnpm。

## 自动验证

| 步骤 | 命令 | 期望 |
| --- | --- | --- |
| 默认值断言 | `pnpm test:code -- tests/plugin.test.ts` | 全部通过 |
| 配置表单与预设菜单 | `pnpm test:code -- tests/config-form.test.ts tests/client.test.ts` | 全部通过 |
| 完整门禁 | `pnpm check` | 类型检查、lint 与测试全部通过 |
| 格式化 | `pnpm format` | 无改动 |

## 人工核对

按 D-004 不做实机验证。需要人工确认时：

| 场景 | 步骤 | 期望 |
| --- | --- | --- |
| 未保存过预设 | 在未保存过该插件的 profile 中启用插件，打开配置页 | 预设显示 `SA-调度会话` |
| 菜单内容 | 打开预设菜单 | 只列出可用预设与「不可用」补足项 |
| 旧配置空值 | 在 profile 中给 `sessionPreset` 写 `''`，重新载入 | 触发器显示「跟随宿主默认」，新建会话跟随宿主 |
| 改选 | 选 `SA-工作会话` 并保存 | 新建会话使用 `sa-worker` |

## 回滚

把 `src/config.ts` 的 schema 与 `DEFAULT_CONFIG` 中 `sessionPreset` 缺省值恢复为 `''`，恢复预设菜单的清空项与相关文档。
