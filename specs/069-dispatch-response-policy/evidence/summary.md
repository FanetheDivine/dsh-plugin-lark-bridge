# 实机验证记录

验证日期：2026-11-27。分支：`feat/069-dispatch-response-policy`。

## 环境

| 项 | 取值 |
| --- | --- |
| 宿主 | `dsh` 0.2.2-rc.5（全局安装，与 `package.json` 的 `@deepseek-ai/dsh-agent` 版本一致） |
| 运行方式 | 隔离 profile 与隔离 `DSH_HOME`，`dsh --profile <name> --no-open` 启动 Web GUI；插件以链接方式安装，`dist` 由宿主 HMR 监听 |
| 模型 | 调度会话 `bluefocus-openai/kimi-k3.1-pro`；任务会话 `bluefocus-openai/qwen3.8-flash`（均为真实模型） |
| 飞书 | `lark-cli` 以 mock 替身置于 `PATH` 最前：`auth status` 就绪、`event consume` 读取收件箱文件、`im +messages-send/+messages-reply` 只记录到 `lark-cli-sends.jsonl`。另用真实 `lark-cli` 向 bot 私聊发送一张卡片并读回（见 R-7） |
| 工作区 | 调度工作区与任务工作区 `ws-a` 位于隔离目录，均已 `git init` |
| 浏览器 | Playwright 驱动本机 Chrome，操作 GUI 的任务会话输入框与会话列表 |

## 用例与结果

| 编号 | 场景 | 结论 | 依据 |
| --- | --- | --- | --- |
| R-1 | 用户消息要求在 ws-a 新建任务 | 通过。`session_create` 成功后的下一步是带 `task_id` 与 `reply_to` 的 `lark_notify`，`session_pin` 在同一步其后；每个用户消息都有回复 | `dispatch-session-timeline.txt` seq 51–61 |
| R-2 | 任务会话 `send_report` 后的上报块与处理 | 通过。块内只有 `report_path`（相对路径）与空的 `attachment_paths`，没有 `desc` 与正文；调度会话读取报告文件，据报告 `kind` 更新状态后用 `lark_notify` 转达 | seq 65–81 |
| R-3 | 通知的任务名与返回值 | 通过。飞书文本首行是「创建 hello.md (task-…)」，模型文本不重复；模型可见结果只有「已发送给用户（消息 om_…）」；`tool/result.meta` 只有 `taskSessionId`，不带 `task_id` 的通知 `meta` 为空 | `lark-cli-sends.jsonl`；seq 59、181 |
| R-4 | 给调度会话自己的说明（「先别动，我在等一个值」） | 通过。没有 `session_send`，用 `task_update` 的 `add_message` 记录后回复用户 | seq 89–103 |
| R-5 | 转发指令并要求任务会话提问；报告 `kind=question` | 通过。`session_send` 转发用户原意，任务会话发出 `question` 报告，调度会话设 `waiting_user` 并转达 | seq 108–145 |
| R-6 | 用户在任务会话 GUI 直接回答（`source.kind=user`） | 通过。`task-logs/<taskId>.jsonl` 写入 `user_message` 条目（id 为 `<会话 id>:54`）；写入时调度会话保持空闲；随后任务会话的报告唤醒调度会话，日志注入消息排在报告块之前，调度会话把 `waiting_user` 改回 `in_progress` 且不就日志条目通知用户 | seq 147–167；`task-sessions-timeline.txt` |
| R-6b | 用户在 GUI 停止任务会话轮次 | 通过。`turn/end` 原因为 `aborted/user`，日志写入 `user_stop` 条目；调度会话下一次运行前收到 `user_message` 与 `user_stop` 两条，按时间升序合成一条消息，状态保持 `in_progress` | seq 188–200 |
| R-6c | 同一条目不重复注入 | 通过。条目注入后后续消息的 pre-step 不再出现 `lark-task-log` 消息；宿主重启（插件实例重建、缓存丢失）后同样不重复 | seq 169–186、331–345 |
| R-6d | 全新调度会话 | 通过。首个会话的第一步注入空快照；把 `state.json` 的 `sessionId` 置空后重启，新会话的第一步注入含未结束任务的快照（任务标识、标题、状态、工作区、任务会话、相对路径 `latest_report`），调度会话据此用相对路径读取报告并回答 | `dispatch-session-timeline.txt` 末段；新会话 seq 11–25 |
| R-7 | 卡片模式 | 通过。调度会话以 `mode:"card"` 调用，飞书 `+messages-reply --msg-type interactive`；卡片 JSON 为 Card 2.0（标题为总结句、副标题为任务名、默认收起的折叠面板）；同一张卡片发送到真实 bot 私聊，读回为 `msg_type: interactive`，内容含「▶ 展开完整内容」 | `lark-cli-sends.jsonl`；`real-feishu-card-readback.txt` |
| R-8 | GUI 通知卡片 | 通过。11 张通知卡片中：带 `task_id` 的显示任务标识与任务会话链接；卡片模式显示总结句，折叠区默认收起（`details.open=false`）；不带 `task_id` 的卡片不显示任务与会话；点击链接打开任务会话 | `gui-notify-cards.json` |
| R-9 | 任务结束与归档闭环 | 通过。`task_end` 后日志迁入 `archive/<taskId>/task-log.jsonl`（3 条），`reports/` 迁入 `archive/<taskId>/reports/`，`task-logs/` 无残留文件；归档提交含 `task-log.jsonl`，调度工作区 `git status` 为空；`session_archive` 成功 | `archived-task-log.jsonl`；`dispatch-workspace-git-log.txt` |
| R-10 | 报告在任务结束后才被读取 | 通过。块内路径 `reports/…` 读取失败后，调度会话按提示词改读 `archive/<taskId>/reports/` 下的同名文件 | seq 311–317（取消任务的第二轮） |
| R-11 | 热更新 | 通过。修改提示词并 `pnpm build` 后，GUI 进程号不变（26556），后续回合行为随新提示词变化 | `gui-pid-before.txt`、`gui-pid-after.txt` 的取值一致 |

## 验证中发现并修复的问题

- **现象**：调度会话在 `task_end` 之后立即调用带已结束 `task_id` 的 `lark_notify`，得到 `task-not-found`，随后自行补发一条不带 `task_id` 的通知。
- **原因**：提示词要求通知带 `task_id`，没有说明任务结束后 `task_id` 不再有效。规格 D-014 规定已结束的任务返回错误。
- **修复**：调度提示词增加规则：`task_end` 或 `session_unmanage` 之后的通知不带 `task_id`，正文开头写「<title> (<task id>)」；规格 FR-032 与 `tests/sa-dispatch.test.ts` 同步。
- **复验**：新建任务后取消，`task_end` 之后的通知不带 `task_id`、正文开头写全称，`lark_notify` 一次成功。

## 观察到的行为

- 模型偶发多余调用（例如一次空 `text` 的 `lark_notify` 返回 `invalid-text`），随后自行恢复，与本功能无关。
- 调度会话在取消任务时先 `session_send` 通知任务会话再 `task_end`，之后任务会话的最后一份报告在任务结束后到达，调度会话按回退路径读取，没有丢失内容。

## 未覆盖的范围

- 飞书事件与普通发送使用 mock；只有一张卡片发送到真实 bot 私聊。
- 没有在飞书客户端实际展开卡片，折叠行为依据飞书返回的卡片读回内容与 Card 2.0 文档。
- 未验证多任务同批报告的并发路径（单元测试覆盖按任务分开通知的参数与格式）。
- GUI 截图保留在本机测试 profile 的 `shots/` 目录，未纳入仓库。

## 文件

| 文件 | 内容 |
| --- | --- |
| `dispatch-session-timeline.txt` | 两个调度会话的事件时间线（用户消息来源、工具调用与结果、结果元数据、轮次结束） |
| `task-sessions-timeline.txt` | 任务会话的事件时间线（含 GUI 直接输入的 `USER[user]` 与停止的 `aborted/user`） |
| `lark-cli-sends.jsonl` | mock `lark-cli` 收到的每次发送（参数与 stdin 内容） |
| `archived-task-log.jsonl` | 归档后的任务日志 |
| `dispatch-workspace-git-log.txt` | 调度工作区的提交与归档提交涉及的文件 |
| `gui-notify-cards.json` | GUI 中通知卡片的 DOM 读数 |
| `real-feishu-card-readback.txt` | 真实 bot 私聊中卡片的读回结果 |
| `gui-pid-before.txt`、`gui-pid-after.txt`、`gui-pid-restarted.txt` | 热更新前后与重启后的 GUI 进程号 |
