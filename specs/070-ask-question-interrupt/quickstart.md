# Quickstart: 验证提问拦截上报

前置：worktree 已完成 `pnpm i && pnpm check`；rdt profile 已按 `real-device-test` 搭建并链接本 worktree。

## 单元/集成验证

```sh
pnpm check
```

断言入口：

- `tests/managed-ask-guard.test.ts`：拦截成功（不上报路径不运行工具体、`concludeTurn`、结果文案）、投递失败回退（错误反馈 + S 标记）、未管理直通、`origin=ask_intercept` 正文格式、重复调用逐次上报。
- `tests/lark-super-agent-*.test.ts`：行装配把 `intercept` 接到 `sendReport/updateTask`；状态仅在 `in_progress` 时变更。
- `tests/managed-turn-report.test.ts`：`markIntercepted` 后轮次结束不再补 progress 上报。

## 实机验证（宪章 II 端到端）

```sh
cd <rdt-profile 目录>
node ask-repro.mjs
```

预期（与缺陷复现记录同一驱动）：

1. 被管理会话：`tool/result` 为拦截上报说明；无 `gateway pending`（`user-questions/request` 挂起数 0）；`turn/end` 原因为 `completed` 且出现在调用后同一步；`dispatch-ws/reports/<taskId>/` 新增 `kind=question`、`origin=ask_intercept` 存档；台账任务状态 `waiting_user`。
2. 未被管理会话：仍进入等待（`gateway pending` 出现 1 条），无上报——对照行为不变。

## 手工场景（真实桌面）

1. 任意被管理任务会话让模型调用 `Ask user question`。
2. 观察：会话轮次立刻结束；飞书/调度会话收到一条 `question` 上报；任务列表状态变「等待用户」。
