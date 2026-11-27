# Data Model: 加入管理时自动上报会话最后文本

本次不新增持久化字段，不改任务与上报文件格式。新增的是进程内轮次状态与串行队列。

## 轮次状态（进程内）

`TurnReporter` 为每个会话保留一条最后轮次状态；`turn/start` 覆盖，`turn/end` 后保留。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `turn` | number | 轮次号，取自事件 `data.turn` |
| `reported` | boolean | 本轮是否调用过 `send_report`；`tool/call` 命中时置 `true` |
| `text` | string | 本轮最后一条非空助手消息的文本块拼接结果 |
| `settled` | boolean | 是否已观察到 `turn/end` |
| `reason` | string | `turn/end` 的 `reason.kind`；未结束时为空串 |
| `reportedTaskId` | string \| undefined | 本轮自动上报已投递到的任务标识 |

## 状态转换

| 触发 | 转换 |
| --- | --- |
| `turn/start` | 新建状态：`reported=false`、`text=''`、`settled=false`、`reportedTaskId=undefined` |
| `assistant/message` 且文本非空白 | 覆盖 `text` |
| `tool/call` 且 `name=send_report` | `reported=true` |
| `turn/end` | `settled=true`、`reason=kind`；排入队列执行 `finish` |
| `finish` 投递成功存档 | `reportedTaskId=当前任务标识` |
| `catchUp` 投递成功存档 | `reportedTaskId=新任务标识` |

## 补发判定

`catchUp(sessionId, taskId)` 在会话队列中依次检查：

1. 有保留的轮次状态。
2. `settled` 为真，即最后轮次已结束。
3. `reason === 'completed'`。
4. `reported` 为假。
5. `text` 非空白。
6. 无运行中的子代理。
7. `reportedTaskId !== taskId`，即本次接管尚未投递过该轮文本。

全部通过后调用 `service.sendReport({ kind: 'progress', text }, sessionId, 'turn_end')`。

## 串行队列

- 键：会话标识。
- 值：该会话上尚未完成的判定链，`finish` 与 `catchUp` 依次追加。
- 链尾完成后清理该键，避免长期持有。

## 上报与任务

- 上报仍为 `progress`，`origin` 为 `turn_end`，由 `ReportStore` 存档并计入任务的 `reportIds`。
- 接管上报不改变任务状态，不结束任务。
- 投递失败时保留存档，任务保留，日志记录失败原因。