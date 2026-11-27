# Research: 上报先存档后投递、归档即重建与未读补投

## R1 会话缺失的判定

**Decision**: `resolveAgent` 返回 `{ error }` 且 `error.code === 'session/not-found'` 时按缺失处理；其他错误返回未送达。

**Rationale**: 宿主在 `resolve` 中把 `ApiSessionNotFound` 映射为 `RemoteError('session/not-found', ...)`（`dsh-api-session-controller/lib/index.js`）。只对稳定错误码新建，避免临时故障产生孤儿会话。

**Alternatives**: 所有解析错误都新建。被否：把宿主故障当成会话缺失，旧会话仍在磁盘上却不再是调度会话。

## R2 归档状态

**Decision**: 每次判定读取 `workspaceRegistry.archivedSessionIds`；命中即按缺失处理。

**Rationale**: 宿主归档会停止会话并阻止投递；注册表是唯一可靠的归档来源。`SessionManager.resume` 已用同一字段跳过归档会话（`src/sessions.ts:165-168`）。

**Alternatives**: 依赖 `steer` 抛错再重建。被否：错误无法区分归档与临时故障，且首次投递必然报错。

## R3 投递顺序

**Decision**: `archiveReport` 在提交后调用投递回调；回调把任务追加到按工作区串行的投递链并返回 Promise；`sendReport` 等待该 Promise。

**Rationale**: 投递回调在存档队列内同步登记，登记顺序等于存档顺序；投递链独立执行，存档不被投递阻塞。并发报告得到「存档 A、登记 A、存档 B、登记 B」的顺序。

**Alternatives**: 投递放在存档队列内执行。被否：投递需要创建会话与 `steer`，会阻塞后续存档与台账写入。

## R4 新建调度会话

**Decision**: `SessionManager.ensure` 外层加按工作区单飞，新增 `ensureDispatchSession(root)`；飞书注入与上报路径调用同一个 Promise。

**Rationale**: 飞书注入与上报可能同时发现会话缺失；单飞保证只建一个会话。`ensure` 已处理归档跳过、创建、标题、挂工作区、置顶与状态写入。

**Alternatives**: 上报路径直接调用 `sessionController.create`。被否：会复制 `ensure` 的预设、标题与状态逻辑，产生两套参数。

## R5 未读标记

**Decision**: 任务台账新增 `deliveredReportIds`；未读 = `reportIds` 减去该集合；投递成功后合并编号并提交；存量任务按全部已读初始化。

**Rationale**: 标记与调度会话无关，归档重建后仍表示用户已收到；不依赖事件日志扫描，避免压缩与投递时序影响。存量报告不重复注入。

**Alternatives**: 从调度会话事件日志里扫已注入的报告编号。被否：`steer` 后事件落盘时间不确定，同批并发投递会重复列入；压缩后扫描成本高。

## R6 注入内容

**Decision**: 投递块列出全部任务的全部未读报告（`<unread_reports>`），新建会话额外列出任务快照；块内要求先读任务与全部报告。飞书新建会话的 `task_snapshot` 同步列出未读报告。

**Rationale**: 报告在投递失败后仍会补投；只带当前报告会让积压报告停在磁盘。快照让全新会话一次拿到上下文。

**Alternatives**: 只列当前任务的未读报告。被否：其他任务的上报失败后要等它自己再次上报才补投。

## R7 结果契约

**Decision**: `send_report` 返回成功结果：`reportId`、`taskId`、`reportPath`、`delivered`、可选 `reason`、可选 `warning`。无工作区结果只含 `taskId`、`delivered` 与 `reason`。

**Rationale**: 模型能区分已送达与未送达；客户端卡片只认 `delivered === true`（`src/client/report-node.ts:111`），无需改动。

**Alternatives**: 未送达用工具错误。被否：错误结果隐藏「已存档」事实，模型会重试并产生重复报告。

## R8 重试与标记失败

**Decision**: 投递失败重试一次（重建或重新解析）；仍失败返回未送达，报告保持未读。投递成功后标记失败只记 `warning`。

**Rationale**: 归档与投递竞争通常在下一次解析时消失；至少一次语义允许重复列出，文件内容不变。

**Alternatives**: 失败自动多次退避重试。被否：自动重试队列列入后续项，本次只覆盖一次同步重试。