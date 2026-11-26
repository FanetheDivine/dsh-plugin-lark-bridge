# Research: 调度会话响应策略与上报投递

每条研究给出 Decision、Rationale、Alternatives Considered。无未决研究项。

## R-001 飞书卡片发送

- **Decision**: 卡片用 Card 2.0。顶层 `header.title` 放总结句，`body.elements` 放一个 `collapsible_panel`（`expanded: false`），面板内放 `markdown` 完整正文。发送命令为 `lark-cli im +messages-send --as bot --user-id <owner> --msg-type interactive --content -`，卡片 JSON 经 stdin 传入；回复时用 `+messages-reply --message-id <id>`。
- **Rationale**: `lark-cli skills read lark-im` 规定 interactive 卡片经 `--msg-type interactive --content` 发送；`collapsible_panel` 提供默认收起、点标题展开，面板内可放 `markdown`。
- **Alternatives**: `--markdown` 的 post 消息不能折叠；卡片按钮需要 `card.action.trigger` 订阅，规格已排除。

## R-002 模型可见结果与 GUI 元数据分离

- **Decision**: 执行体返回 `{ ok: true, messageId, taskSessionId? }`；`render` 只输出含消息 id 的一行文本；`presentationMeta` 只投影 `{ taskSessionId }`（有值时）。
- **Rationale**: `output.render(args, value)` 决定模型内容；`output.presentationMeta(args, value)` 持久化到 `tool/result.meta`，两者是同一个值的两种投影（`dsh-tools/lib/types/contracts.d.ts:17-20`）。
- **Alternatives**: GUI 经插件路由按 task_id 查台账。任务结束后台账查不到，链接失效，且新增路由与鉴权面。

## R-003 日志条目标识与幂等

- **Decision**: 条目 id 为 `<任务会话 id>:<事件 seq>`。追加前读取同任务日志文件，已有同 id 则跳过。
- **Rationale**: `session/event` 的 `event.seq` 在会话内唯一且重放不变；同一事件被重复观察得到同一 id。

## R-004 已注入判定

- **Decision**: 调度会话 pre-step 时扫描该会话事件日志中来源为 `lark-task-log` 的 `user/message`，从正文的 `<task_log_entry id="…">` 块提取已注入 id。进程内按会话缓存 `{ scannedSeq, injected }`，下次从 `scannedSeq` 起增量扫描；缓存丢失时从 seq 0 重建。
- **Rationale**: 事件日志在压缩后保留；`Session.eventAt(seq)` 与 `session.seq` 可遍历。`reminder.ts` 已用同类「扫描已有消息」做法，但只看表层；这里必须看完整事件日志才能满足压缩后不重复注入。
- **Alternatives**: 状态文件游标（会话重建后需要额外归属）；只扫表层（压缩后重复注入，规格已否决）。

## R-005 日志写入并发

- **Decision**: 写入进 `runSerial(root)`，在队列内 `readTaskState` 确认任务仍未结束，再追加 JSONL 行；不 git 提交。
- **Rationale**: 现有全部台账写入与归档迁移都在同一队列内（`notes.ts`）。

## R-006 归档迁移

- **Decision**: `endTask` 在队列内检测 `task-logs/<taskId>.jsonl`，存在则 `rename` 到 `archive/<taskId>/task-log.jsonl`，提交路径含 `task-logs/<taskId>.jsonl`（删除）与 `archive/<taskId>/task-log.jsonl`。
- **Rationale**: 与 reports 目录迁移同一模式（`notes.ts:344-349`）；`pruneTasks`、`unmanage`、`notifyArchived` 都经 `endTask`，一处覆盖所有结束途径。

## R-007 用户停止与归档取消的区分

- **Decision**: 取消的 `turn/end` 原因为 `{ kind: 'aborted', reason: { kind: 'user' } }`。归档会话并停止活动时，宿主先把会话写入 `archivedSessionIds`，再触发 `workspace/session-stop`，由 `archive-admission` 以相同的 `{ kind: 'user' }` 取消（`dsh-workspace/lib/types/index.d.ts:95-110`、`dsh-agent/lib/types/archive-admission.js`）。因此取消的 `turn/end` 到来时，会话已在 `archivedSessionIds` 内即视为归档取消，不写日志。
- **Rationale**: 宿主文档明确「archive set is durable when this dispatches」。

## R-008 上报投递兜底

- **Decision**: 在 `service.deliver` 内 `steer` 之后让出两个微任务，若 agent 空闲且消息仍在 `agent.inbox.nextStep`，则移除并改为 `followup`；逻辑与 `SessionManager.settleSteering` 一致，抽成共享函数 `settleSteering(agent, message, logger)` 放在新文件 `src/steering.ts`，`sessions.ts` 与 `service.ts` 共用。
- **Rationale**: 避免两份相同逻辑漂移；`AgentLike` 的最小接口需扩展 `status`、`inbox`、`followup`。

## R-009 GUI 通知卡片识别

- **Decision**: `SUCCESS_RESULT` 改为同时匹配旧文案 `已(发送|回复)给用户（N 条）` 与新文案 `已发送给用户（消息 om_xxx）`。新文案固定为 `已发送给用户（消息 <messageId>）`。
- **Rationale**: 结果文案是识别依据（`docs/known-risks.md` 已记录该耦合），历史会话的旧结果需继续显示。

## R-010 task_id 查找与降级

- **Decision**: `lark_notify` 不依赖 `larkSuperAgent` 服务。新增 `src/notify-tasks.ts`，用 `readBridgeState`（`src/lark-super-agent/bridge.ts`）取调度工作区根，并用 `readTaskState(root)` 读台账；任务不存在、已结束、台账校验失败或工作区根缺失时抛出带原因的错误。
- **Rationale**: 主行 `index.ts` 的 `lark_notify` 现有依赖只有 CLI、owner 与桥接判定；全局行停用时必须仍可发送不带 task_id 的通知。

## R-011 卡片拆分

- **Decision**: 在 Markdown 段落（空行）边界贪心装箱，使每张卡片 `Buffer.byteLength(JSON.stringify(card))` 不超过 28 000 字节（留出 30 KB 上限余量）。单个段落超过阈值时按行再拆，仍超过按字符切分。每张卡片 `header.title` 为 `<总结句>（i/n）`（n 为 1 时不加序号）。
- **Rationale**: 飞书卡片更新接口 30 KB 上限、`content` 为 JSON 字符串；留余量避免转义膨胀。

## R-012 用户直接消息的识别

- **Decision**: 在 `session/event` 监听里，对被管理会话的 `user/message` 事件，`event.data.source.kind === 'user'` 时写日志。`dsh-plugin-meta-tools`、`lark-super-agent`、`lark-bridge`、`lark-task-rules`、`lark-task-log` 等插件来源都不是 `user`。
- **Rationale**: `MessageSourceMap` 中 `user` 是宿主 GUI 输入的来源（`dsh-llm/lib/types/message.d.ts:101-104`）。实机验证时核对 GUI 输入确为该来源。

## R-013 pre-step 顺序

- **Decision**: 日志注入消息插在本批 `<lark-message>` 之前、桥接提醒之后。桥接提醒的补注 hook 注册在主行，日志注入 hook 注册在 `lark-super-agent` 行。注入 hook 只在 `decision.messages` 中已存在桥接提醒或表层已有提醒时才排在其后；否则退到本批首个 `<lark-message>` 之前。
- **Rationale**: 两个 hook 的相对时序取决于注册顺序，不能依赖它。因此日志注入 hook 自行定位：找到本批第一条 `<lark-message>`，若其前一条是桥接提醒则插在提醒之后，否则插在 `<lark-message>` 之前。

## R-014 上报块路径

- **Decision**: 上报块中的路径取 `relative(workspaceRoot, absolutePath)` 并把 `\` 换成 `/`。块内新增 `<report_path>` 与 `<attachment_paths>`，替换原 `<desc>`、`<text>`、`<files>`。
- **Rationale**: `reports.ts` 现返回绝对路径，Windows 上含盘符与反斜杠，且归档后失效；相对路径与调度提示词中的回退规则配合使用。
