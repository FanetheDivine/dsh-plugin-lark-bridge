# Contract: 新建桥接会话的模型与预设

## 输入

| 来源 | 字段 | 说明 |
| --- | --- | --- |
| 插件配置 | `sessionProvider` | provider 标识，空白按未配置 |
| 插件配置 | `sessionModel` | model 标识，空白按未配置 |
| 插件配置 | `sessionEffort` | 推理等级，仅在 provider 与 model 同时存在时生效 |
| 插件配置 | `sessionPreset` | 预设标识，空白按未配置 |

桥接插件没有工具参数，配置是唯一输入。

## 解析顺序

1. 预设：`sessionPreset` 非空且存在 `agentPresets` 服务时调用 `list()`；候选在名册中且 `broken` 为空才传入 `agentPreset`。名册读取失败、服务缺失或候选不可用时省略预设。
2. 创建：`sessionController.create({ sessionId, workspaceId, cwd, ...(agentPreset ? { agentPreset } : {}) })`。
3. 模型：provider 与 model 同时非空时调用 `llm.resolveCallConfig(selection)`；通过后 `resolveAgent(sessionId)` 并 `agent.model.select(selection)`。校验失败、服务缺失或 `resolveAgent` 失败时跳过选择。
4. 标题：向会话追加固定标题事件。
5. 挂载：attach 工作区、置顶、写状态文件。

## 降级

| 情况 | 行为 | 日志 |
| --- | --- | --- |
| 预设不可用 | 省略预设，宿主用默认 | warn |
| 无 `agentPresets` 服务 | 省略预设 | 不记录 |
| 无 `sessionController` 服务 | 回退 `ctx.agents.create`，省略预设 | warn |
| 模型不可用 | 省略 `agent.model.select` | warn |
| 无 `llm` 服务 | 省略 `agent.model.select` | warn |
| `resolveAgent` 失败 | 省略 `agent.model.select` | warn |

上述情况都继续创建会话并注入消息。

## 已存在的桥接会话

状态文件记录的 `sessionId` 可恢复时直接复用，不应用模型与预设配置。

## 兼容性

- 未保存四个配置字段时，新建会话沿用现有行为：宿主默认模型与默认预设。
- `workspaceRoot`、状态文件结构、去重、提醒与通知工具不变。
