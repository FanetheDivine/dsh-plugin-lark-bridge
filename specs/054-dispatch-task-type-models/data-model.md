# Data Model: 调度会话更名与任务类型模型配置

## 1. 任务类型 (`TaskType`)

| 值 | 含义 | 对应模型配置前缀 |
| --- | --- | --- |
| `'common'` | 普通任务（初始默认） | `commonTask` |
| `'complex'` | 复杂任务 | `complexTask` |

```ts
export const TASK_TYPES = ['common', 'complex'] as const;
export type TaskType = (typeof TASK_TYPES)[number];
```

## 2. `lark-super-agent` 行配置 (`Config`)

| 字段 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `guiInputSetsLocal` | `Volatile<boolean>` | `true` | 网页输入时切换为在电脑旁 |
| `larkInputSetsRemote` | `Volatile<boolean>` | `true` | 收到飞书消息时切换为离开 |
| `commonTaskProvider` | `Volatile<string>` | `''` | 普通任务模型的 provider |
| `commonTaskModel` | `Volatile<string>` | `''` | 普通任务模型的 model |
| `commonTaskEffort` | `Volatile<string>` | `''` | 普通任务模型的推理等级 |
| `complexTaskProvider` | `Volatile<string>` | `''` | 复杂任务模型的 provider |
| `complexTaskModel` | `Volatile<string>` | `''` | 复杂任务模型的 model |
| `complexTaskEffort` | `Volatile<string>` | `''` | 复杂任务模型的推理等级 |
| `defaultTaskType` | `Volatile<TaskType>` | `'common'` | 默认任务类型 |
| `taskPreset` | `Volatile<string>` | `''` | 新建任务会话的预设 |
| `presenceAlarms` | `Volatile<PresenceAlarm[]>` | `[]` | 在场状态自动切换时间列表 |

校验与读取规则：

- `readDefaultTaskType(config)`：当 `defaultTaskType` 展开值为 `'complex'` 时返回 `'complex'`，其余任何情况返回 `'common'`。
- `readTaskModel(config, taskType?)`：
  - 目标类型 `resolvedType = taskType ?? readDefaultTaskType(config)`。
  - 若 `resolvedType === 'common'`，读取 `commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`。
  - 若 `resolvedType === 'complex'`，读取 `complexTaskProvider`、`complexTaskModel`、`complexTaskEffort`。
  - `provider` 与 `model` 同时非空时返回 `ModelSelection`，否则返回 `undefined`。

## 3. 服务接口 (`LarkSuperAgentService`)

- `readonly taskModel: (taskType?: TaskType) => ModelSelection | undefined`：按给定任务类型（省略时取默认任务类型）返回配置的模型。
- `readonly taskPreset: () => string`：保持不变。
- `Task` 台账结构（`message-task-status.json`）：保持不变，不记录 `taskType`。
