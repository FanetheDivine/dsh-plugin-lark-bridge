# Data Model: 被管理会话提问改为打断并注入 S 要求自行上报

## Pending（会话级待处理提问）

`AskGuard` 内部按会话保存一条记录，只存在于插件进程内：

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `rules` | boolean | 下一次模型请求前是否注入 S |
| `questions` | unknown[] | 每次被拦截调用的 `questions` 参数原值，按调用顺序追加，内容相同只保留一份 |

生命周期：

| 事件 | `rules` | `questions` |
| --- | --- | --- |
| 被管理会话的 ask 被拦截 | 置 true | 追加该次参数 |
| `agent/pre-step` 取 S | 置 false | 保留 |
| 模型上报 `question` 成功 | 不变 | 清空 |
| 轮次结束 | 清空 | 清空并作为补投输入 |
| 会话结束管理或任务归档 | 清空 | 清空 |

## 消息

| 消息 | `source.kind` | 产生条件 | 正文 |
| --- | --- | --- | --- |
| S | `lark-task-rules` | 取到 `rules = true` | 固定指令 + 被拦截提问的题面与选项 |
| 补投上报 | — | 轮次结束仍有待补投提问 | `questionReportText` 生成的题面、表头与选项 |

## Report

| 字段 | 取值 | 说明 |
| --- | --- | --- |
| `kind` | `question` | 补投固定为提问 |
| `origin` | `ask_intercept` | 与模型上报的 `send_report`、轮次自动上报的 `turn_end` 区分 |

## Task 状态

| 路径 | 状态变更 |
| --- | --- |
| 模型上报 `question` | 调度会话按既有规则把任务置 `waiting_user` |
| 插件补投成功 | 插件在任务为 `in_progress` 时置 `waiting_user` |

转换表不变：`in_progress ↔ waiting_user`、两者可到 `failed`。
