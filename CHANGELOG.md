# Changelog

## 未发布

### 变更

- 删除 `SA-工作会话` 预设；`SA-调度会话` 现在管理任意会话。
- 「被管理」成为会话状态：一个被管理会话对应一个未结束任务，记录在 `message-task-status.json`。
- `send_report` 对除调度会话外的所有会话可见，未被管理的会话调用报错；上报类型只保留 `progress` 与 `question`，新增 `desc`。
- 用户离开时，被管理会话的 `ask_user_question` 立即失败并返回离开错误，随后注入一条临时指令改走 `send_report`。
- 被管理会话在轮次正常结束、本轮未上报且没有运行中的子代理时，把最后一段文本作为 `progress` 上报给调度会话。
- 调度会话新增 `session_manage`、`session_unmanage` 与 `task_end`，删除 `task_create` 与 `task_candidates`；`task_update` 不再接受结束状态。
- `session_create` 去掉 `agent_preset`，新增必填 `title` 与 `prompt`，创建后立即建立任务。
- 任务由调度会话判断完成并经用户确认后结束；结束任务不归档会话。
- 「飞书任务与调度会话」行更名为「调度会话」，描述改为「用调度会话统一管理其他任务会话」。
- `lark-super-agent` 行配置拆分为普通任务模型（`commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`）、复杂任务模型（`complexTaskProvider`、`complexTaskModel`、`complexTaskEffort`）、默认任务类型（`defaultTaskType`，默认 `'common'`）与 `taskPreset`。
- `session_create` 新增可选 `task_type` 参数（`common`/`complex`/空值），在用户未明确要求时总是按默认任务类型创建会话。
- 文案与文档中的「工作会话」改为「任务会话」。
- `send_report` 的调用结果以专用卡片展示类型、`desc`、正文与附件。
