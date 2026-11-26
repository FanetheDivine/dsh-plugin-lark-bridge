# Tasks: 调度会话响应策略与上报投递

**Input**: Design documents from `specs/069-dispatch-response-policy/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/](./contracts/)

**Tests**: 宪章原则 II 要求代码变更同步更新 `tests/`，每个阶段包含对应测试任务。

**Organization**: 按用户故事分阶段；每个阶段对应一个 commit（AGENTS.md「实施」）。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

- [x] T001 在 worktree 根目录运行 `pnpm install`，确认 `pnpm typecheck` 与 `pnpm test:code --reporter=minimal` 在改动前通过，记录基线

## Phase 2: Foundational

**Purpose**: 后续阶段共用的基础件

- [x] T002 新增 `src/steering.ts`：导出 `settleSteering(agent, message, logger)`，逻辑与 `src/sessions.ts` 现有 `settleSteering` 一致（让出两个微任务；`agent.status === 'idle'` 且 `agent.inbox.nextStep` 仍含该消息时移除并改为 `agent.followup`）；文件顶部一句职责注释
- [x] T003 `src/sessions.ts` 改为调用 `src/steering.ts` 的 `settleSteering`，删除私有副本；运行 `tests/sessions.test.ts` 确认行为不变
- [x] T004 [P] 新增 `src/lark-super-agent/paths.ts`：导出 `workspaceRelative(root, absolutePath)`，返回相对调度工作区根、以 `/` 分隔的路径（FR-021）
- [x] T005 [P] 为 T002、T004 新增 `tests/steering.test.ts` 与 `tests/lark-super-agent-paths.test.ts`
- [x] T006 提交 Phase 2：`feat(069): 共享投递兜底与相对路径工具`

## Phase 3: User Story 1–4 - 调度提示词与桥接提醒 (Priority: P1/P2)

**Goal**: 下发后立即回应、按任务分开通知、报告重发规则、按需联系用户、转发判断（FR-001 至 FR-018、FR-022、FR-023、FR-029、FR-032 的提示词部分、FR-047）

**Independent Test**: `tests/sa-dispatch.test.ts` 与 `tests/reminder.test.ts` 断言提示词关键规则；实机验收场景 1、2、3、4

- [x] T007 [US1] 改写 `src/sa-dispatch/prompt.ts`：新增 `## Respond to the user` 段，写明用户只能看到 `lark_notify`；`session_create`、`session_send`、`session_manage`、`session_unmanage`、`task_end` 成功后下一步 `lark_notify`；`session_pin`/`session_archive` 与通知同步或之后，失败另发 `lark_notify`（改写 `Keep the session list current` 中「in the same reply」）；用户每条消息都回复；日志注入消息、上报块、失败通知、归档通知不触发回复（FR-001 至 FR-003、FR-014、FR-015）
- [x] T008 [US1] 同一文件：写明按任务分开通知——同一任务合并为一条并带 `task_id`，不同任务分开，与任务无关的内容单独一条；带 `task_id` 的任务名由插件写标题前缀，正文不再重复；创建任务与追加消息时传入用户消息 `message_id`，通知用最近一条用户消息作 `reply_to`；通知之后到达的消息单独回应（FR-004、FR-006、FR-032）
- [x] T009 [US2] 同一文件重写 `## Handle reports`：说明 `origin="turn_end"` 与 `origin="send_report"` 两类来源；报告既没有描述任务当前状态、也没有需用户确认的点时，用 `session_send` 向该任务会话发一次重发请求（要求用 `send_report` 报告当前状态与待确认点）；`turn_end` 与 `send_report` 都适用；除重发请求与用户本人的话外不向任务会话发任何消息（FR-007 至 FR-009）；改写 `Add messages to a task` 中「Answering a task session works the same way」为「用户回答任务提问时，追加回答并投递给任务会话」（FR-010）
- [x] T010 [US3] 同一文件：只在本份报告含新的结果、里程碑、阻塞、失败或提问时用 `lark_notify`；只是确认或复述时不通知；无论是否通知，`progress` 设 `in_progress`、`question` 设 `waiting_user`；轮次失败设 `failed` 并通知一次，用户要求后才重试；删除「Relay it as it is」与「Relay the content to the user」中与新规则冲突的表述，长报告用卡片模式（`mode: "card"`，`summary` 为一句总结）发 Markdown 全文，只补充任务、工作区与待决问题；部分发送失败后只补发剩余部分（FR-011 至 FR-013、FR-016、FR-028、FR-029）
- [x] T011 [US4] 同一文件：先判断点名任务的消息是否是给任务会话的指令；给调度会话自己的说明不转发，用 `task_update` 的 `add_message` 记录后回应用户；无法判断时询问用户（FR-017、FR-018）
- [x] T012 [US2] 同一文件：处理报告时读取 `<report_path>` 指向的报告文件，需要时读取 `<attachment_paths>`；任务归档后报告在 `archive/<taskId>/reports/`，读取失败时改读该位置；`desc` 只在报告文件 front matter 中，需要修正标题或理解范围时读取（FR-022、FR-023）
- [x] T013 同一文件：写明日志条目规则——收到 `<task_log_entry>` 不通知用户；任务处于 `waiting_user` 时收到 `user_message` 条目用 `task_update` 设为 `in_progress`；`user_stop` 条目只告知用户停止过，不改状态；`<task_snapshot>` 用于重建任务认知（FR-047）
- [x] T014 [US1] 改写 `src/reminder.ts` 的 `BRIDGE_REMINDER`：「连续多条只回复一次」改为同一批内同一任务合并一条、不同任务各回一条、通知之后到达的单独回复；说明带 `task_id` 的通知由插件补写任务名，正文不重复；注入类消息不是用户消息，不回复（FR-005、FR-015、FR-032）
- [x] T015 [US1] 更新 `tests/sa-dispatch.test.ts` 与 `tests/reminder.test.ts`：断言上述关键规则存在，且旧冲突表述（`Relay the content to the user`、`in the same reply`、`Answering a task session works the same way`）已消失；`## ` 段落标题测试同步
- [x] T016 提交 Phase 3：`feat(069): 调度提示词响应策略与桥接提醒`

**Checkpoint**: 提示词层完成，不依赖后续代码阶段

## Phase 4: User Story 5 - 上报块只带路径与投递兜底 (Priority: P2)

**Goal**: FR-019 至 FR-021、FR-024

**Independent Test**: `tests/lark-super-agent-blocks.test.ts`、`tests/lark-super-agent-service.test.ts`

- [x] T017 [US5] 改写 `src/lark-super-agent/blocks.ts` 的 `taskSessionMessage`：输出 `<task_session_message sessionid reportid taskid kind origin>` 内含 `<report_path>` 与 `<attachment_paths>`，去掉 `<desc>`、`<text>`、`<files>`；路径由调用方传入相对路径；闭合标签转义保持（contracts/report-block.md）
- [x] T018 [US5] 改写 `src/lark-super-agent/service.ts` 的 `sendReport`：投递前用 `workspaceRelative` 把 `archived.reportPath` 与 `archived.files` 转成相对路径传给 `taskSessionMessage`；`deliver` 在 `steer` 之后调用 `settleSteering`（`src/steering.ts`），为此扩展 `AgentLike` 的最小接口（`status`、`inbox`、`followup`）；`notifyFailure`、`notifyArchived` 经同一 `deliver`，一并获得兜底
- [x] T019 [P] [US5] 更新 `tests/lark-super-agent-blocks.test.ts`：块含相对路径、不含正文与 desc、属性齐全、路径含 `\` 时输出 `/`
- [x] T020 [P] [US5] 更新 `tests/lark-super-agent-service.test.ts` 与 `tests/lark-super-agent-reports.test.ts`：投递块不含正文；空闲且消息仍在 `nextStep` 时改为 `followup`；git 提交失败仍算送达并带 warning
- [x] T021 提交 Phase 4：`feat(069): 上报块只带路径并补投递兜底`

## Phase 5: User Story 6 - lark_notify 卡片、task_id 与返回值 (Priority: P2)

**Goal**: FR-025 至 FR-037

**Independent Test**: `tests/tools.test.ts`、`tests/notify-node.test.ts`、`tests/notify-card.test.ts`；实机验收场景 5、6

- [x] T022 [US6] 新增 `src/notify-card.ts`：导出 `buildCards({ summary, markdown, taskLabel? })`，生成 Card 2.0（`header.title` 总结句，多张带 `（i/n）`；带任务时 `header.subtitle` 为「<title> (<task id>)」；body 为 `collapsible_panel` `expanded:false` 内放 `markdown`）；按 research.md R-011 在段落边界贪心装箱，每张 `Buffer.byteLength(JSON.stringify(card))` ≤ 28 000，超长段落按行再按字符切分
- [x] T023 [P] [US6] 新增 `src/notify-tasks.ts`：导出 `resolveTask(taskId)`——用 `readBridgeState` 取工作区根（经 `toHostWorkspacePath`），`readTaskState(root)` 读台账；`workspaceRoot` 缺失或台账 `invalid` 抛 `task-ledger-unavailable`，任务不存在抛 `task-not-found`；返回 `{ id, title, sessionId }`（FR-030、FR-031）
- [x] T024 [US6] 改写 `src/tools.ts`：`NOTIFY_ARGS_SCHEMA` 新增 `mode`（`text`｜`card`）、`summary`、`task_id`；校验 `invalid-mode`、`invalid-summary`（card 必填且非空）；`text` 模式带任务时首段首行加「<title> (<task id>)」；`card` 模式经 `buildCards` 逐张 `+messages-send|+messages-reply --as bot --msg-type interactive --content -`（首张带 `reply_to`）；部分发送成功后失败时错误消息含已发条数与第一条消息 id；成功返回 `{ ok:true, messageId, taskSessionId? }`；`render` 输出「已发送给用户（消息 <messageId>）」，`presentationMeta` 只投影 `{ taskSessionId }`；`NotifyDeps` 增加可选 `resolveTask`，`src/index.ts` 注入 `notify-tasks`
- [x] T025 [US6] `src/client/notify-node.ts`：`SUCCESS_RESULT` 同时匹配旧文案与新文案 `已发送给用户（消息 <id>）`；调用参数解析新增 `mode`、`summary`、`task_id`；`NotifyCardData` 增加 `summary?`、`taskId?`，`sessionId` 改读 `presentationMeta.taskSessionId`，同时兼容旧元数据 `sessionId`
- [x] T026 [US6] `src/client/notify-card.tsx`、`notify-card.css`、`src/client/locales.ts`：`card` 模式显示总结句与完整 Markdown 原文；带任务时显示 task id 与任务会话链接（沿用现有已归档/缺失状态）；无 `task_id` 且无元数据时不显示会话链接；补中英文案键
- [x] T027 [P] [US6] 新增或更新 `tests/notify-card-builder.test.ts`（卡片结构、拆分边界与 28 000 字节上限、序号）、`tests/tools.test.ts`（参数校验、发送命令参数、`task_id` 前缀、部分发送失败、结果契约、`not-bridge-session`）、`tests/notify-node.test.ts`、`tests/notify-card.test.ts`（新旧文案、链接）
- [x] T028 提交 Phase 5：`feat(069): lark_notify 卡片模式、任务关联与精简返回值`

## Phase 6: User Story 7 - 任务日志 (Priority: P2)

**Goal**: FR-038 至 FR-049

**Independent Test**: `tests/lark-super-agent-task-log.test.ts`、`tests/managed-task-log.test.ts`；实机验收场景 7、8

- [x] T029 [US7] 新增 `src/lark-super-agent/task-log.ts`：导出 `TaskLogEntry`（字段与约束见 data-model.md：`id` 为 `<sessionId>:<seq>`、`text` 超过 2000 字符截断并 `truncated: true`、`type` 取 `'user_message' | 'user_stop'`）、`appendEntry(root, entry)`（`runSerial(root)` 内先 `readTaskState` 确认任务未结束，已结束丢弃；文件内已有同 id 则跳过；不 git 提交）、`readEntries(root, taskId)`（解析失败的行跳过）、`logPath(taskId)`
- [x] T030 [US7] `src/lark-super-agent/notes.ts` 的 `endTask`：队列内检测 `task-logs/<taskId>.jsonl`，存在则 `rename` 到 `archive/<taskId>/task-log.jsonl`，`paths` 同时加入 `task-logs/<taskId>.jsonl` 与 `archive/<taskId>/task-log.jsonl`；`pruneTasks`、`unmanage`、`notifyArchived` 均经 `endTask`，无需单独处理
- [x] T031 [US7] 新增 `src/lark-super-agent/managed/task-log-observer.ts`：在 `session/event` 中，被管理会话的 `user/message` 且 `data.source.kind === 'user'` 写 `user_message` 条目；`turn/end` 的 `reason` 为 `{ kind:'aborted', reason:{ kind:'user' } }` 且会话不在 `workspaceRegistry.archivedSessionIds` 时写 `user_stop` 条目；条目 id 用 `event.seq`；失败只记日志；不唤醒调度会话（FR-038 至 FR-043）
- [x] T032 [US7] 新增 `src/lark-super-agent/managed/task-log-injector.ts`：声明来源 `lark-task-log` 并导出 `buildLogInjection({ session, root })`；在调度会话的 `agent/pre-step` 中（仅 `bridgeSessionId` 对应会话）用进程内缓存 `{ scannedSeq, injected }` 增量扫描 `session.eventAt(seq)` 取已注入 id（从 `<task_log_entry id=…>` 解析，来源为 `lark-task-log`）；缓存缺失时从 seq 0 重建；无注入标记即全新会话，生成 `<task_snapshot>`（每个未结束任务的 id、title、status、workspace、最新报告相对路径）加各任务最新报告之后的日志条目，无任务时也注入空快照；已有会话只注入未见条目；同一步按时间升序合成一条消息，排在桥接提醒之后、本批第一条 `<lark-message>` 之前（research.md R-013）；无新内容时返回原 decision
- [x] T033 [US7] `src/lark-super-agent/managed/index.ts` 接入 T031、T032（共用同一个 `agent/pre-step` 注册或新增一个），日志读取的工作区根用 `service.bridgeState`（已含平台转换）
- [x] T034 [P] [US7] 新增 `tests/lark-super-agent-task-log.test.ts`：追加、同 id 去重、任务已结束时丢弃且不创建文件、截断标记、归档迁移与提交路径含删除与新文件、非法行跳过
- [x] T035 [P] [US7] 新增 `tests/managed-task-log.test.ts`：用户直接消息写入、`dsh-plugin-meta-tools` 等来源不写、未被管理会话不写、用户停止写入、归档取消不写、注入顺序与位置、重复 pre-step 不重复、压缩后不重复、缓存丢失后重建、全新会话快照与空快照
- [x] T036 提交 Phase 6：`feat(069): 任务日志与调度会话增量注入`

## Phase 7: Polish、文档与验证

- [x] T037 [P] 更新 `README.md`：`lark_notify` 的 `mode`、`summary`、`task_id` 与卡片说明，调度会话回应规则（宪章原则 III，只写用户可见行为）
- [x] T038 [P] 更新 `docs/how-it-works.md`：上报块与相对路径、投递兜底、卡片发送、返回值与 `presentationMeta`、任务日志与归档、飞书消息立即注入（删除「15 秒静默」描述）、调度工作区目录表加入 `task-logs/` 与 `archive/<taskId>/task-log.jsonl`
- [x] T039 [P] 更新 `docs/known-risks.md`：成功文案耦合改写为新旧文案；删除「每次注入要等 15 秒」；新增任务日志只记用户直接交互、归档后不读取、部分发送失败靠模型补发、卡片依赖客户端 ≥ 7.20 的风险
- [x] T040 更新 `CHANGELOG.md`：按分支规则增加条目
- [x] T041 运行 `pnpm format && pnpm check && pnpm build && pnpm test:dist`，全部通过
- [x] T042 提交 Phase 7：`docs(069): 文档、变更日志与门禁`

## Phase 8: 真实宿主验证与交付

- [x] T043 使用 skill `real-device-test` 按 quickstart.md 的 8 个场景在真实 DSH 宿主验证，保留证据（命令输出、会话事件摘录、飞书消息 id、GUI 截图）于 `specs/069-dispatch-response-policy/evidence/`；发现缺陷则回到对应阶段修复并重验
- [x] T044 将验证结果写入 `specs/069-dispatch-response-policy/evidence/summary.md`，提交 `docs(069): 实机验证记录`
- [ ] T045 执行 `speckit-worktree-finish`：同步 `origin/main`、推送、创建 PR、等待 CI 与合并、清理本地与远程分支及 worktree，确认仓库只剩 `main`

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 至 6 → Phase 7 → Phase 8。
- Phase 3（提示词）独立；Phase 4 依赖 T002、T004；Phase 5 独立于 Phase 4，但 `src/index.ts` 的注入在 T024 完成；Phase 6 依赖 T004（路径）与 T018（`service.bridgeState` 可复用）。
- Phase 3 的 T013（日志规则）引用 Phase 6 的块格式，字段名以 data-model.md 为准。

## Parallel Opportunities

- T004、T005 可并行；T019、T020 可并行；T023 与 T022 可并行；T027、T034、T035 为测试，可与对应实现之后并行编写；T037 至 T039 可并行。

## Implementation Strategy

- MVP 为 Phase 3（提示词），其余按优先级依次叠加；每阶段提交前运行相关测试，Phase 7 运行全量门禁。
