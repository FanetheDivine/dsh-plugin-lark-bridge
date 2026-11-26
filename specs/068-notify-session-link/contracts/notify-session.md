# Contract: 通知会话关联与导航

## 工具输入

`lark_notify` 参数保持现状：

- `text` 必填。
- `reply_to` 可选。
- 不新增 `session_id` 参数。

## 成功结果

```ts
{
  ok: true
  parts: number
  messageId?: string
  replyTo?: string
  sessionId?: string
}
```

工具执行路径传入当前 `exec.agent.session.id`。输出 schema 声明 `sessionId` 为字符串。

## 展示元数据

```ts
presentationMeta(_args, value) {
  return value.ok && typeof value.sessionId === 'string' && value.sessionId.trim() !== ''
    ? { sessionId: value.sessionId }
    : {}
}
```

`output.render` 的文本保持现状。

## 节点数据

```ts
interface NotifyCardData {
  readonly text: string
  readonly sessionId?: string
}
```

`buildNotifyNode` 从匹配结果的 `event.data.meta` 读取标识。正文缺失时仍不生成卡片。

## 卡片注入

```ts
interface NotifySessionActions {
  readonly openSession: (sessionId: string) => void
}
```

客户端通过 `ctx.uiWorkspace.openSession` 实现该动作。

## 界面文案

| 键 | 中文 | English |
| --- | --- | --- |
| `notify.session` | 会话 | Session |
| `notify.archived` | 已归档 | Archived |
| `notify.openSession` | 打开会话 | Open session |

按钮的可访问名称包含目标标识。归档标签使用只读 `Tag`。

## 兼容约束

- 旧结果没有 `meta` 时只显示正文。
- 失败、进行中和替换结果沿用现有匹配规则。
- 分段、回复与发送错误契约不变。
- 会话目录与归档状态只影响展示，不回写通知数据。
