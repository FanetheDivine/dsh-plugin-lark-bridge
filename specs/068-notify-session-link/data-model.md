# Data Model: 飞书通知关联会话与跳转

## NotifyResult

| 字段 | 类型 | 规则 |
| --- | --- | --- |
| `ok` | `boolean` | 既有发送结果 |
| `parts` | `number` | 既有分段数 |
| `messageId` | `string` | 既有飞书消息标识 |
| `replyTo` | `string` | 既有回复目标 |
| `sessionId` | `string \| undefined` | 成功时取当前 agent 的会话标识；低层发送helper可省略 |
| `error` | `object \| undefined` | 既有失败结果 |

## NotifyPresentationMeta

```json
{
  "sessionId": "session-example"
}
```

- 成功结果含非空 `sessionId` 时生成。
- 其他结果生成空对象。
- 宿主把对象保存为 `tool/result.meta`。
- 模型可见的 `content` 不包含该对象。

## NotifyCardData

| 字段 | 类型 | 来源 |
| --- | --- | --- |
| `text` | `string` | `tool/call.arguments.text` |
| `sessionId` | `string \| undefined` | `tool/result.meta.sessionId` |

解析只接受对象中的非空字符串。空白、非字符串、数组、空值和缺失字段均视为无关联。

## WorkspaceSnapshot

卡片读取 `items[].sessionIds` 判定目标是否属于工作区，并读取 `archivedSessionIds.includes(sessionId)` 判定归档。桥接会话始终属于工作区，归档保留成员关系。归档状态优先于成员关系，未知目标按只读状态展示。

## 展示状态

| 条件 | 展示 | 点击 |
| --- | --- | --- |
| 无 `sessionId` | 仅正文 | 无 |
| 已归档 | 会话标识、已归档标签 | 无 |
| 目录未包含目标 | 会话标识 | 无 |
| 目录包含目标且未归档 | 会话链接 | `openSession(sessionId)` |

状态变化由两个宿主快照触发重渲染。通知正文与会话标识在状态变化中保持不变。
