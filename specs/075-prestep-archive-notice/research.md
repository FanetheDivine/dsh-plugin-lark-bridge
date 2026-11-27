# Research: 归档通知改为 pre-step 注入并补充调度信号分层文档

## R-001 注入通道

**Decision**: 归档通知并入 `TaskLogInjector` 构造的消息，来源仍为 `lark-task-log`。

**Rationale**: 调度会话每次 pre-step 只会产生一条注入消息，任务日志、任务快照、归档通知同属「重要消息」。合并后顺序固定为任务快照、日志条目、归档通知，去重也复用同一段事件日志扫描。

**Alternatives considered**:

- 新增独立 pre-step 监听并注入 `lark-super-agent` 来源的消息。落选原因：两条注入消息的先后取决于监听注册顺序，模型看到两个来源，语义与文档的三类划分不一致。
- 把归档通知写进任务日志文件。落选原因：任务日志按任务 id 分文件，归档通知不属于该任务未结束期的日志，任务归档后日志文件迁入 `archive/<taskId>/`。

## R-002 持久化位置

**Decision**: 调度工作区根目录的 `archive-notices.json`，由 `runSerial(root)` 串行读写。

**Rationale**: 与 `message-task-status.json`、`task-logs/` 同一工作区，读路径由 `taskLogContext()` 已提供。`state.json` 由主行 `StateStore` 独占并带内存缓存，super-agent 行直接写会与主行后续 `patch` 互相覆盖。

**Alternatives considered**:

- 写 `$DSH_HOME/lark-bridge/state.json`。落选原因：跨行写入需要新增服务方法与缓存失效协议，改动面大于收益。
- 进程内存队列。落选原因：插件重启丢通知；用户已确认要持久化。
- 从 `archive/<taskId>/task.json` 推导。落选原因：会把启用本功能前的历史归档全部当作待注入，且需要额外的时间边界。

## R-003 已注入判定

**Decision**: 归档块带 `id` 属性；`TaskLogInjector` 扫描调度会话完整事件日志，来源为 `lark-task-log` 的文本里出现 `<task_session_archived id="…"` 即视为已注入；扫描到后删除对应记录。

**Rationale**: 与任务日志条目同一语义。请求失败未写入事件日志时，下次 pre-step 会重新注入；压缩只改模型可见表层，事件日志仍在，不重复。

**Alternatives considered**:

- 构造消息时立即删除记录。落选原因：请求失败会丢通知，与任务日志行为不一致。
- 记录内加 `injected` 标记并写回。落选原因：仍以插件侧状态为准，无法覆盖「消息已进日志但标记未写回」的窗口。

## R-004 块形态与顺序

**Decision**: `<task_session_archived id="<taskId>:<time>" sessionid="…" taskid="…"/>`，追加在注入消息末尾。

**Rationale**: 一个块同时承载任务、会话与去重 id；追加在日志条目之后，读序为「现状快照 → 用户直接操作 → 任务结束」。

**Alternatives considered**:

- 包一层 `<archive_notices>`。落选原因：块本身就是顶层消息内容，宿主按文本渲染，无需额外容器。

## R-005 恢复与删除

**Decision**: `restoreSession` 成功恢复任务后，删除该 `taskId` 的全部待注入记录。

**Rationale**: 恢复后任务重新未结束，待注入的「已归档」通知与台账矛盾。恢复只针对该会话最新的归档任务，按任务 id 删除足够精确。

**Alternatives considered**:

- 保留记录并在注入时校验任务状态。落选原因：pre-step 需要额外读台账，且块内容仍表达「已归档」。

## R-006 无工作区、无任务

**Decision**: `notifyArchived` 在没有调度工作区时不写记录，只记日志；会话没有对应任务时不产生记录。

**Rationale**: 与 `sendReport` 的 `no_workspace` 处理一致；任务已结束的会话不需要通知。

## R-007 文件提交

**Decision**: `archive-notices.json` 的写入与删除不做 git 提交，与 `task-logs/` 的追加一致。

**Rationale**: 该文件是运行时待处理队列，注入后即清理；每次追加或删除都提交会产生无意义的历史。任务归档、恢复的既有提交仍按原路径执行。

**Alternatives considered**:

- 每次写入提交。落选原因：队列条目生命周期短，提交噪声大。