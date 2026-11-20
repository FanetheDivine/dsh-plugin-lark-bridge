# 契约: 桥接会话创建

对齐 DSH `0.2.2-rc.5` 的 `sessionController.create`。历史契约见 `specs/031-session-model-preset/contracts/session-creation.md`，本文件描述修复后的请求。

## 请求

```ts
interface CreateSessionRequest {
  workspaceId: string;   // 必填，已注册工作区标识
  agentPreset?: string;  // 可选，已通过名册校验的预设
}
```

约束：

- 请求 MUST NOT 包含 `cwd`。宿主拒绝与 `workspaceId` 同时出现。
- 请求 MUST NOT 包含 `sessionId`。宿主在新建时自行铸造标识。

## 响应

```ts
interface CreateSessionResult {
  sessionId: string;
  agentPreset?: string;
}
```

插件 MUST 使用返回的 `sessionId`，覆盖本地变量。

## 行为

1. 宿主按 `workspace.path` 确定会话目录并创建会话。
2. 宿主把会话挂到该工作区。
3. 插件追加固定标题事件。
4. 插件按配置写入模型选择，不修改宿主默认模型。
5. 插件置顶会话并写入状态文件。

## 错误

| 场景 | 宿主错误 | 插件行为 |
| --- | --- | --- |
| 同时传 `workspaceId` 与 `cwd` | `gateway/bad-request` | 注入失败，整批丢弃，写日志 |
| 工作区不存在 | `workspace/not-found` | 注入失败，整批丢弃，写日志 |
| 预设无效 | `agent-preset/not-found` 或 `agent-preset/invalid` | 注入失败，整批丢弃，写日志 |
| 挂载失败 | `session/workspace-attach-failed` | 注入失败，整批丢弃，写日志 |

## 无会话控制服务的宿主

`ctx.get('sessionController')` 缺失时，插件回退到 `ctx.agents.create`，按目录创建会话；预设被忽略并记录警告。