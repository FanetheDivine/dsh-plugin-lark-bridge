# Data Model: 被管理会话提问直接返回上报指令 S

## 提问工具结果

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `isError` | `false` | 这是插件合成的成功结果 |
| `value` | `{ answers: [] }` | 满足 legacy 与 timed 模式的输出 schema，表示没有实际用户答案 |
| `content` | `[{ type: 'text', text: TASK_RULES_TEXT }]` | 固定 S，不依赖题面或选项 |

每个被接管的调用各有一个结果。插件不建立待处理问题集合或保存来源题面。仅已在等待的提问被插件取消时，保留一次性提醒标记；提醒的 `source.kind` 为 `lark-task-rules`。

## 报告与任务状态

| 路径 | `kind` | `origin` | 状态 |
| --- | --- | --- | --- |
| 模型调用 `send_report` 提问 | `question` | `send_report` | 调度会话按既有规则更新 `waiting_user` |
| 常规轮次进度报告 | `progress` | `turn_end` | 沿用常规处理 |
| 既有拦截报告 | `question` | `ask_intercept` | 仅为历史兼容保留，不生成新记录 |

拦截本身不写任务状态。模型未发报告时没有待补发的提问。
