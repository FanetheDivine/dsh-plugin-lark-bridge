# Quickstart: 验证提问拦截改为注入 S 要求上报

前置：worktree 已完成 `pnpm i`。

## 单元/集成验证

```sh
pnpm check
```

断言入口：

- `tests/managed-ask-guard.test.ts`：拦截返回 deny、不投递上报、待注入内容合并与去重、`takeFallback` 取走并清空、`noteReported` 清空。
- `tests/managed-task-rules.test.ts`：S 正文含被拦截提问与选项；无提问时只有固定指令。
- `tests/lark-super-agent-index.test.ts`：行接线——拒绝后下一步注入 S；模型上报后不补投；轮次结束补投一次 `origin=ask_intercept` 并置 `waiting_user`。
- `tests/managed-turn-report.test.ts`：`markIntercepted` 后轮次结束不再补 `progress`。

## 产物验证

```sh
pnpm build && pnpm test:dist
```

## 手工场景（真实桌面）

1. 用 `SA-调度会话` 派发一个任务，任务会话进入工作。
2. 让任务会话调用 `Ask user question`。
3. 预期：
   - 工具调用立刻返回错误，正文说明提问没有送达用户，并要求用 `send_report` 上报。
   - 下一步模型调用 `send_report`，飞书收到一条带任务背景的提问。
   - 任务状态变为「等待用户」。
4. 异常对照：让模型忽略 S 直接结束轮次，飞书仍收到一条只含题面与选项的提问。
