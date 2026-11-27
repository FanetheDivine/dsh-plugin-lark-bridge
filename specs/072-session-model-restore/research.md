# Research: 调度会话切换会话模型与恢复已归档会话

## 1. 宿主是否提供切换会话模型的工具

**Decision**: 插件自己提供工具，调用目标 Agent 的 `agent.model.select`。

**Rationale**:

- `dsh-plugin-meta-tools@0.1.7` 的 `SESSION_CONTROL_TOOL_NAMES` 只有 `session_create`、`session_stop`、`session_send`，导航工具只有 `session_pin`、`session_archive`。宿主没有模型切换工具。
- `sessionController` 公开 `selectModel`（`@Remote('selectModel')`），内部 `resolveAgent` → `llm.resolveCallConfig` → `agent.model.select`，然后异步 `agentDefaultModel.saveSelection`。
- 直接调 `agent.model.select` 跳过全局默认模型保存，符合「只改这个会话」的要求。`sa-dispatch/session-create.ts` 已经用同一方式给新会话设置模型。

**Alternatives considered**:

- 调 `sessionController.selectModel`：会把选择写成全局默认模型，改变新建会话的默认路由，超出需求。
- 通过 UI 手动切换：调度会话无法操作，飞书用户不可用。

## 2. 模型选择何时生效

**Decision**: 从下一步生效，当前已发出的请求保持原模型。

**Rationale**:

- `AgentModel.select` 追加 `model/selection` 事件；`AgentModel.current` 返回「待生效选择」。
- 每步的 `agent/pre-step` 携带当步捕获的 `modelSelection`；`installModelSelection` 在路由变化时插入一条模型变更提示，effort 单独变化不插。
- 因此轮次运行中切换，当前步的请求不变，下一步起使用新选择。

**Alternatives considered**: 立即中断当前请求并重发。会丢失正在生成的回复，且宿主没有提供该能力。

## 3. 模型校验

**Decision**: 复用 `ctx.llm.resolveCallConfig`。

**Rationale**:

- provider 未注册时 `registration` 抛错；model 不存在时 `resolveModelInfo` 抛错；effort 不被支持时抛 `UNSUPPORTED_REASONING_EFFORT`。
- 省略 effort 时由适配器默认值决定；`resolveCallConfig` 只做校验，返回值不需要写回选择。
- `session_create` 已按同一路径处理显式模型与配置模型。

## 4. 解除归档的宿主能力

**Decision**: 调 `ctx.workspaceRegistry.unarchiveSession`。

**Rationale**:

- meta-tools 的 `session_archive` 已有 `remove: true`，内部就是 `unarchiveSession`。
- `unarchiveSession` 只从归档集合删除 id，不做存在性检查，也不恢复 pin。

**Limitation**: 只解除归档时，任务仍停在 `archive/` 下且已结束，pin 仍缺失，调度会话无法继续通过 `send_report` 协作。

## 5. 恢复置顶

**Decision**: 解除归档后调用 `workspaceRegistry.pinSession`，默认开启，`pin: false` 关闭。

**Rationale**:

- 归档在同一次落盘里清掉 pin（`archiveSession` 同时过滤 `pinnedSessionIds`）。
- `pinSession` 要求会话存在且未归档；解除归档后满足。失败抛错，不回滚已完成的恢复。

## 6. 归档任务的数据位置

**Decision**: 扫描工作区根下 `archive/*/task.json`，按 `archivedAt` 取该会话最新一条。

**Rationale**:

- `NotesStore.endTask` 写 `archive/<taskId>/task.json`，内容为任务记录加 `archivedAt`、`endReason`，并把 `reports/<taskId>` 移到 `archive/<taskId>/reports`、`task-logs/<taskId>.jsonl` 移到 `archive/<taskId>/task-log.jsonl`。
- 台账按会话唯一，恢复时只需判断该会话当前没有未结束任务。
- 归档原因区分任务是否应恢复：`session_archived` 表示归档导致结束，其他原因（`completed`、`cancelled`、`unmanaged`、`session_missing`）保持归档。

**Alternatives considered**: 新建任务代替恢复。会丢失原任务 id、消息、报告与投递记录，用户看到的仍是已结束的旧任务。

## 7. 恢复写入顺序与幂等

**Decision**: 迁回报告目录与任务日志 → 写台账 → 删除归档目录 → 限定路径提交。

**Rationale**:

- 与 `endTask` 的逆序一致，中断后归档目录仍存在，重试会重新走迁移；目标目录已存在时立即失败，避免覆盖。
- 台账写入沿用 `runSerial` 与原子替换；提交沿用 `commitFilesInQueue`，把报表目录与日志路径一起提交。

## 8. 工具命名与作用域

**Decision**: 新增 `session_model` 与 `session_restore`，都注册在 `sa-dispatch` 子行。

**Rationale**:

- 与宿主 `session_*` 命名一致，且不与 meta-tools 的既有工具重名。
- 需求只要求调度会话具备这两个能力；其他预设不注册，避免扩大权限面。

## 9. 测试策略

**Decision**: 单元测试覆盖参数转换、校验失败、恢复编排与台账迁移；真实宿主验证工具出现在调度会话的工具表并完成一次切换与一次恢复。

**Rationale**:

- 模拟 `ctx` 无法验证宿主 `agent.model.select` 的真实投影与归档门禁，需要实机用例。
- 台账迁移与 git 提交在 `tests/lark-super-agent-notes.test.ts` 里用真实临时目录验证。