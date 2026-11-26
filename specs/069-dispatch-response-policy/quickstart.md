# Quickstart: 验证

## 本地门禁

```sh
pnpm format
pnpm check
pnpm build
pnpm test:dist
```

## 单元测试重点

- `tests/lark-super-agent-blocks.test.ts`：上报块只含属性与相对路径。
- `tests/tools.test.ts`：`mode`、`summary`、`task_id` 校验与发送命令、拆分、结果契约、部分发送失败。
- `tests/notify-node.test.ts`、`tests/notify-card.test.ts`：新旧结果文案识别、任务会话链接。
- 新增 `tests/lark-super-agent-task-log.test.ts`：写入、去重、归档迁移与两侧提交、任务已结束时丢弃。
- 新增 `tests/managed-task-log.test.ts`：用户直接消息与用户停止观察、归档取消排除、pre-step 注入、压缩后不重复、全新会话快照。
- `tests/sa-dispatch.test.ts`、`tests/reminder.test.ts`：提示词与提醒关键规则。

## 真实宿主验收

使用 skill `real-device-test`。场景与期望：

1. 派发新任务：成功的 `session_create` 之后的下一步含 `lark_notify`。
2. 同批两个任务的报告：用户收到两条通知，各带 `task_id`。
3. 说明性消息「暂时不用动」：无 `session_send`，台账多一条消息。
4. 充分报告：任务会话没有收到任何调度会话的消息。
5. 卡片模式：飞书收到卡片，面板默认收起，展开后正文完整；返回值只含消息 id。
6. GUI：带 `task_id` 的通知卡片显示任务 id 与可点击的任务会话链接。
7. 在任务会话 GUI 直接输入：日志新增一条，调度会话下一步注入一次，任务由 `waiting_user` 改回 `in_progress`；再触发一步不重复注入。
8. 任务结束：日志出现在 `archive/<taskId>/task-log.jsonl`，`task-logs/` 无残留，`git status` 干净。
