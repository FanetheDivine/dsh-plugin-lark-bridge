# Quickstart: 任务会话消息不含会话元信息

## 前置

- 主工作区位于 `main` 且干净；本变更在 `worktrees/076-task-message-metadata`。
- 依赖已安装（`pnpm install`）。

## 验证命令

```bash
pnpm test:code   # vitest，含新增提示词断言
pnpm format
pnpm check       # biome + 类型 + 测试，与 CI 同组
```

## 场景与预期

1. 提示词断言：`tests/sa-dispatch.test.ts` 的「提示词禁止向任务会话暴露会话元信息」用例通过；全文不含 `its target workspace`。
2. 小节顺序：现有「提示词按顺序包含全部小节」用例保持通过。
3. 文档：`docs/how-it-works.md` 含元信息约束一条；`docs/known-risks.md` 含残余风险一条。

## 可选实机验证

需要时用 `real-device-test` 技能：派发一个任务，检查任务会话首条消息不含工作区路径；切换任务会话模型，检查任务会话只收到宿主 `[model changed: ...]` 提示。