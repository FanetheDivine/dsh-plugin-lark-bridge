# Data Model: 通知卡片

## NotifyCardData

| 字段 | 类型 | 来源 | 规则 |
| --- | --- | --- | --- |
| `text` | `string` | `tool/call.arguments.text` | 保留原始换行；非字符串或缺失时为空字符串 |
| `replyTo` | `string` | `tool/call.arguments.reply_to` | 可选回复目标；卡片回执动作以成功结果为准 |
| `action` | `'send' \| 'reply'` | 成功结果文本 | 「已发送」映射 `send`，「已回复」映射 `reply` |
| `parts` | `number` | 成功结果文本中的 `N` | 正整数；一次调用无论拆几段只出一张卡片 |

## 事件关系

- `tool/call`：`name === 'lark_notify'` 时以 `callId` 开启 Context。
- `tool/result`：`surfaceOp === 'append'`、非错误且内容完全匹配成功回执时，以同一 `callId` 开启或更新 Context。
- 没有成功结果时不产出卡片。
- 结果对应的调用不在窗口内时，`text` 与 `replyTo` 为空，仍显示回执卡片。
- 结果或调用未变化时复用节点；调用补载后重新解析。

## Chat 节点

| 属性 | 值 |
| --- | --- |
| `kind` | `lark-notify` |
| `target` | `chat` |
| `visibility` | `visible` |
| `groupTree` | `turn` |
| `anchorSeq` | `result.seq + 0.5` |

## ReportCardData

保持现状。本次只改展示颜色，不改字段、事件关系或节点生命周期。
