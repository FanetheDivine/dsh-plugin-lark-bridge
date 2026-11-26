# Research: 飞书通知关联会话与跳转

## 结论

当前宿主接口可以完成会话关联、历史恢复、归档判定和跳转，无需新增依赖或工具参数。

## 会话标识来源

**Decision**: 使用 `exec.agent.session.id`。

**Rationale**: `lark_notify` 已在执行前验证同一 agent 属于桥接会话。该标识准确对应当前会话，模型无需填写。

**Alternatives Considered**: 新增 `session_id` 工具参数会让模型填写系统已知值，并允许错误关联。

## 持久化与历史恢复

**Decision**: 成功结果增加 `sessionId`，通过 `output.presentationMeta` 投影到 `tool/result.meta`。

**Rationale**: `ToolOutputDefinition.presentationMeta` 用于工具私有展示数据。`tool/result.meta` 随会话日志保存，实时与回放路径一致。该通道不会改变模型可见的回执文本。

**Alternatives Considered**: 把标识拼入结果文本会改变模型输入和现有成功匹配；从当前展示会话推断无法支持未来跨会话展示，也没有显式数据契约。

## 会话与归档状态

**Decision**: 使用 `useSessions` 的 `SessionListState.byId` 判定目标存在，使用 `useWorkspaces` 的 `WorkspaceSnapshot.archivedSessionIds` 判定归档。

**Rationale**: 两个快照由宿主控制器维护并支持订阅。归档是会话目录之外的状态，需要同时读取。

**Alternatives Considered**: 读取当前会话或后端状态文件无法覆盖历史目标；点击后再处理错误会提供已知无效的入口。

## 会话导航

**Decision**: 注入 `ctx.uiWorkspace.openSession`。

**Rationale**: 宿主导航服务负责保留目标、更新选择并显示对话，和侧栏打开会话使用同一动作。

**Alternatives Considered**: 自定义 URL 或 DOM 点击依赖页面结构，且无法复用宿主选择状态。

## 卡片数据

**Decision**: `NotifyCardData` 增加可选 `sessionId`，从结果元数据解析。

**Rationale**: 节点已经关联同一调用的参数与结果。正文来自调用参数，会话标识来自结果元数据，各自使用权威来源。

**Alternatives Considered**: 从参数读取标识需要修改模型工具声明；从当前 Chat 标准属性读取只表达展示所在会话，不表达通知持久化关联。

## 兼容与失败处理

**Decision**: 缺失或非法元数据时省略会话区域；目录未加载或目标缺失时只读展示；归档时增加标签并禁用跳转。

**Rationale**: 历史通知仍保留正文，快照加载期间不会产生错误导航。

**Alternatives Considered**: 隐藏整张历史卡片会丢失正文；未知目标显示可点击按钮会产生无效操作。

## 验证依据

- `dsh-tools` 的 `ToolOutputDefinition` 声明 `presentationMeta`，`ToolResult` 声明持久化 `meta`。
- `dsh-session` 的 `tool/result` 事件声明可选 JSON `meta`。
- `dsh-api-session-controller` 的 `SessionListState` 提供 `ids`、`byId` 与加载阶段。
- `dsh-client-ui-workspace` 提供 `UiWorkspace.openSession` 和 `useWorkspaces`。
- 当前通知节点与测试已支持从结果事件构造稳定卡片数据。
