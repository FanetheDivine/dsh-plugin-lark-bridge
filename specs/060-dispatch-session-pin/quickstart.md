# Quickstart: 调度提示词规定任务会话的置顶与归档

## 前置

1. `pnpm install`
2. `pnpm run build`

## 验证

1. `pnpm run check` 与 `pnpm run test:code` 全部通过。
2. 提示词单元验证点：
   - `## Start a task` 要求 `session_create` 后置顶新会话。
   - `## Manage existing sessions` 要求 `session_manage` 后置顶，并说明 `session_unmanage` 保留会话与置顶。
   - `## Decide when a task is done` 要求 `task_end` 后以 `stop_activity: true` 归档会话，`completed` 与 `cancelled` 都归档。
   - 新增小节说明再次置顶的条件、归档移除置顶、置顶或归档失败时说明并继续。
   - 全部小节标题顺序断言包含新增小节，且提示词不再包含「结束任务不归档会话」。
3. 实机验证（真实宿主）：
   - 在飞书派发一个任务，任务会话出现在会话列表置顶区。
   - 用 `session_manage` 接管一个未置顶会话，该会话出现在置顶区。
   - 结束该任务，会话进入归档列表；接管另一个会话后取消管理，该会话仍在常规列表且保持置顶。
