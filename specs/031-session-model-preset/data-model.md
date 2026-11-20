# 数据模型：桥接会话的模型与预设

## 插件配置

| 字段 | 类型 | 默认 | 含义 |
| --- | --- | --- | --- |
| `workspaceRoot` | string | `''` | 桥接会话所属工作区，保持现状 |
| `sessionProvider` | string | `''` | 新建桥接会话的 provider |
| `sessionModel` | string | `''` | 新建桥接会话的 model |
| `sessionEffort` | string | `''` | 新建桥接会话的推理等级 |
| `sessionPreset` | string | `''` | 新建桥接会话的预设标识 |

校验规则：

- 四个字段都接受字符串；非字符串或未知键按现有严格校验报错。
- `sessionProvider` 与 `sessionModel` 同时非空才构成模型选择。
- `sessionEffort` 只在模型选择成立时参与；单独设置按未配置处理。
- 首尾空白在解析选择时去掉；去空白后为空按未配置处理。
- 旧配置键列表保持不变。

## 模型选择

派生的运行时值：

```text
selection = provider && model
  ? { provider, model, ...(effort ? { reasoningEffort: effort } : {}) }
  : undefined
```

`reasoningEffort` 在写入会话前用 `ReasoningEffortId` 收窄。

## 预设选择

`sessionPreset` 去空白后作为候选标识。创建时从宿主名册读取可用预设，候选在名册中且 `broken` 为空才传给宿主。

## 新建桥接会话的解析顺序

| 步骤 | 输入 | 不可用时 |
| --- | --- | --- |
| 1 预设 | 配置 `sessionPreset`，经 `agentPresets.list()` 过滤 | 省略 `agentPreset`，记录 warn，宿主用默认预设 |
| 2 创建 | `sessionController.create({ sessionId, workspaceId, cwd, agentPreset? })` | 抛错，消息注入失败 |
| 3 模型 | 配置 `sessionProvider`/`sessionModel`/`sessionEffort`，先 `llm.resolveCallConfig` | 跳过 `agent.model.select`，记录 warn，宿主用默认模型 |
| 4 标题 | 固定标题事件 | 抛错，消息注入失败 |
| 5 挂载 | 工作区 attach、置顶、写状态文件 | 按现有失败处理 |

宿主未提供 `sessionController` 时回退 `ctx.agents.create`，预设省略并记录 warn。

## 状态文件

`state.json` 不变：`sessionId`、`workspaceRoot`、`title`、`seen`、`updatedAt`。模型与预设只存在于插件配置与会话日志。

## 配置页状态

| 状态 | 来源 | 表现 |
| --- | --- | --- |
| 模型目录 `loading` | 官方目录加载中 | 选择器禁用 |
| 模型目录 `ready` | 目录可用 | 可选模型与推理等级 |
| 模型目录 `error` | 目录加载失败 | 官方错误状态 |
| 已存模型不可路由 | 目录中没有该 choice | 显示未选择状态，配置值保留 |
| 预设名册 `loading` | `remote.agentPresets.list()` 进行中 | 触发器显示加载中 |
| 预设名册 `ready` | 名册可用 | 菜单列出可用预设 |
| 已存预设不可用 | 名册中没有该 id 或 `broken` 非空 | 触发器标注不可用 |
| 预设名册 `noService` | 宿主无 `remote.agentPresets` 或返回 `gateway/invocation-unavailable` | 选择器禁用并说明 |
| 预设名册 `error` | 其他失败 | 显示失败与重试 |
