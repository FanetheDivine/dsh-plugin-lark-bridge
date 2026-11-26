# Data Model: 移除用户在场机制

## 移除的实体

| 实体 | 原位置 | 处理 |
| --- | --- | --- |
| 在场状态 `PresenceSnapshot` | `src/lark-super-agent/presence.ts` | 删除；不再有 `local`/`remote` 与 `updatedAt` |
| 在场提醒 `sa-presence` | 会话表层的用户消息 | 不再生成、识别或补发；历史消息保留在会话记录里 |
| 闹钟条目 `PresenceAlarm` | 行配置 `presenceAlarms` | 删除；`id`、`time`、`action`、`enabled`、`skipWeekends`、`skipHolidays` 一并消失 |
| 节假日状态 `HolidayDataStatus` | `holidays.ts` 与路由回答 | 删除；`fresh`、`stale`、`missing` 与 `fetchedAt` 不再出现 |
| 节假日缓存 | `<DSH_HOME>/lark-bridge/holiday-cache.json` | 不再读取或写入；文件留在磁盘上 |

## 保留的实体

### 被管理会话

`message-task-status.json` 中未结束任务的 `sessionId`。判定入口不变：`managedTask(sessionId)` 命中即为被管理会话，一个会话最多对应一个任务。

### 任务配置

`lark-super-agent` 行配置，保留以下字段：

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `commonTaskProvider` | 字符串 | 空 | 普通任务模型 provider |
| `commonTaskModel` | 字符串 | 空 | 普通任务模型 model |
| `commonTaskEffort` | 字符串 | 空 | 普通任务推理等级 |
| `complexTaskProvider` | 字符串 | 空 | 复杂任务模型 provider |
| `complexTaskModel` | 字符串 | 空 | 复杂任务模型 model |
| `complexTaskEffort` | 字符串 | 空 | 复杂任务推理等级 |
| `defaultTaskType` | `'common' \| 'complex'` | `'common'` | 默认任务类型 |
| `taskPreset` | 字符串 | 空 | 任务会话预设，空值跟随宿主默认 |

删除 `guiInputSetsLocal`、`larkInputSetsRemote` 与 `presenceAlarms`。旧配置里残留这三个键时，schemastery 原样保留，插件不读取。

### S

提问被拒或取消后插入的一次性指令，`source.kind` 为 `lark-task-rules`、`form` 为 `notice`。同一会话同一时刻最多一条待注入；注入后清除，同一轮再次被拒会重新排队。

### 桥接提醒

`source` 为桥接提醒来源的 `<system-reminder>` 用户消息，由桥接会话的 `agent/pre-step` 在表层缺失时补注。本次只改正文，来源标识与补注逻辑不变。

## 状态流转

### 提问拦截

| 起点 | 条件 | 动作 | 结果 |
| --- | --- | --- | --- |
| 会话调用 `ask_user_question` | 未被管理 | 放行 | 照常等待用户回答 |
| 会话调用 `ask_user_question` | 被管理 | 取消该会话等待中的提问，返回拒绝，排队 S | 调用收到拒绝理由，不进入等待 |
| 会话被 `session_manage` 或 `session_create` 管理 | 已有等待中的提问 | 中止控制器内的调用，取消网关请求，排队 S | 等待结束，下一步注入 S |
| 插件加载 | 网关里有被管理会话的提问请求 | 逐个取消，排队 S | 插件加载完成后不再有被管理的等待提问 |
| 拒绝或取消后发出下一次模型请求 | 该会话有排队 S | 把 S 插到本批消息最前 | 本批含且只含一条 S |

### 渠道选择（提示词层）

| 会话 | 提醒 | 回复行为 |
| --- | --- | --- |
| 桥接会话 | 有桥接提醒 | 一律经 `lark_notify`；成功送达后正文最多一句，失败时正文保留完整内容 |
| 非桥接会话 | 无桥接提醒 | 按宿主默认，在正文回复 |

## 接口变化

| 接口 | 变化 |
| --- | --- |
| `GET /lark-bridge/presence` | 删除 |
| `POST /lark-bridge/presence` | 删除 |
| `GET /lark-bridge/status`、`POST /lark-bridge/check` | 不变 |
| `LarkSuperAgentService.presence` | 删除 |
| `AskGuard` 构造参数 `presence` | 删除 |
| `AskGuard.cancelPending`、`interruptAll` | 合并为 `cancel(sessionId)`，新增 `sweep()` |
