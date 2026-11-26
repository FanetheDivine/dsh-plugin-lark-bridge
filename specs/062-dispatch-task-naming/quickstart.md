# Quickstart: 调度会话向用户提及任务时同时给出名称与 id

## 前置

1. `pnpm install`
2. `pnpm run build`

## 验证

1. `pnpm run check` 与 `pnpm run test:code` 全部通过。
2. 文本断言点：
   - `SA_DISPATCH_PROMPT` 的 `## Reply style` 含 `"<title> (<task id>)"` 与 `Every mention uses this full form`，并含名称缺失兜底句。
   - `## Start a task` 含 `the task as "<title> (<task id>)"`，且不再出现 `Tell the user the task id and the workspace`。
   - `BRIDGE_REMINDER` 含 `名称 (id)`，措辞为条件式（“向用户提及任务时”）。
   - 小节标题顺序断言不变（未新增小节）。
3. `pnpm run build` 通过 test:dist 的产物新鲜度校验。
4. 实机验证（真实宿主，可选）：
   - 在飞书派发一个任务，创建通知以「名称 (id)」提及新任务并给出工作区。
   - 触发一次上报转述，转述主体任务以全形式提及，上报原文其他提及保持原样。
   - 询问「现在有哪些任务在跑」，列表中每个任务都是「名称 (id)」。
