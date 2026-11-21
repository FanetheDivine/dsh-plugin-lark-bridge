# Research: 通知工具限定在桥接会话

**Branch**: `fix/035-notify-tool-scope` | **Date**: 2026-11-21

## R-001 可见性机制

**Decision**: 用 `ctx.tools.register(notifyTool, { when })` 按步骤求值。

**Rationale**: 宿主文档写明条件为 false 时工具同时从声明与执行中排除，且条件入参含正在准备的 `agent`，可以读到 `agent.session.id`。这是唯一按步求值、能跟随状态文件变化的机制。

**Alternatives**:

- `ctx.tools.restrict`：按调用方 scope 静态限制全局工具，注册时确定，无法跟随桥接会话切换。
- 在会话 scope 内注册：与 `restrict` 同样是静态注册，且桥接会话在插件加载后才创建。

## R-002 判定来源

**Decision**: 复用 `SessionManager.isBridgeSession(session)`，它读取状态文件的 `sessionId`。

**Rationale**: 提醒补注已用该判定，两处结论天然一致；规格 FR-005 要求共用。

**Alternatives**: 在 `index.ts` 内直接读状态文件，会复制判定逻辑，并可能与提醒补注分叉。

## R-003 执行守卫

**Decision**: `execute` 读取 `ToolRunContext.agent`；agent 缺失或不是桥接会话时返回 `{ ok: false, error: { code: 'not-bridge-session' } }`，不调用 `sendNotification`。

**Rationale**: 条件注册的工具在无步骤准入时本就不可执行，agent 由 agent loop 设置。缺失 agent 说明调用不来自模型步骤，按失败关闭处理可以确保 FR-006。已知风险：宿主若改变该字段的填充方式，工具会全部失败；单元测试无法覆盖，记录在案。

**Alternatives**: 只依赖 `when`。实现更小，但边界调用漏过时会真的发出飞书消息。

## R-004 条件异常处理

**Decision**: `when` 内用 `try/catch` 包裹判定，异常返回 false。

**Rationale**: 宿主在条件 reject 时会失败整个步骤准备，影响用户对话。`StateStore.load` 自身吞掉读取错误并返回空状态，兜底只防未来变化。

**Alternatives**: 让异常冒泡，由宿主报错。

## R-005 测试替身

**Decision**: `tests/helpers.ts` 的 `tools.register` 记录第二个参数；增加 `_toolWhen(name, agent)` 按 agent 求值条件。

**Rationale**: 现有替身只记录定义，无法断言条件；直接调用记录下来的 `when` 即可覆盖 FR-001 至 FR-005。

## R-006 文档与发布

**Decision**: README 增加工具小节；`docs/how-it-works.md#通知` 写明范围；`CHANGELOG.md` 增加 Unreleased 条目；合并后发布 `0.1.6`。

**Rationale**: 宪章要求用户可见行为变化写入 README，机制变化写入归属文档；发布脚本把 Unreleased 归档到 `changelogs/CHANGE.0.1.6.md`。发布使用独立分支，主工作区只做 `git fetch` 与 `git pull`。

**Alternatives**: 不发布，由用户后续统一发布；已按用户选择采用发布。
