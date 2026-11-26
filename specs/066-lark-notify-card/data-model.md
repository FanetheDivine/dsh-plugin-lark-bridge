# Data Model: 通知正文卡片

## NotifyCardData

| 字段 | 类型 | 来源 | 规则 |
| --- | --- | --- | --- |
| `text` | `string` | `tool/call.arguments.text` | 完整原文，保留换行；非法 JSON、非字符串或缺失时为空字符串 |

卡片没有其他业务字段。

## 事件关系

- `tool/call`：`name === 'lark_notify'` 时以 `callId` 开启 Context。
- `tool/result`：`surfaceOp === 'append'`、非错误且内容完全匹配现有成功结果时，以同一 `callId` 开启或更新 Context。
- 成功结果与 nonempty `text` 同时存在时才产出卡片。
- 缺少调用参数或正文为空时返回 null，保留宿主默认工具行。
- 结果或调用未变化时复用节点；调用补载后重新解析正文。

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
