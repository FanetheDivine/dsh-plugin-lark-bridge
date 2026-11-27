# Quickstart: 接管会话的任务名基于会话标题生成

## 单元验证

1. 运行 `pnpm exec vitest run --project code tests/lark-super-agent-service.test.ts tests/sa-dispatch.test.ts`。
2. 确认 `manageSession` 用 `sessionTitle` 的返回值作任务标题，换行折叠为一个空格。
3. 确认服务缺失、空标题与空白标题时任务标题回退为会话 id。
4. 确认调度提示词含「基于会话标题生成任务名，用 `task_update` 写入，不用会话 id」。

## 实机验证（可选）

1. 在网页中新建一个会话，确认其标题已生成。
2. 让调度会话对该会话执行 `session_manage`。
3. 检查 `message-task-status.json`：任务初始标题等于会话标题。
4. 检查调度会话的下一步：它用 `task_update` 写入生成的任务名，并置顶会话。
5. 检查给用户的 `lark_notify` 使用生成的任务名提及该任务。
