# 数据模型：飞书消息块与回复提醒

## 飞书消息块

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `message_id` | `event.message_id ?? event.id` | 属性；两者都缺失的事件在注入前被丢弃 |
| `time` | `parseTimestamp(event.timestamp ?? event.create_time)` 后格式化 | 属性；格式 `YYYY-MM-DD HH:mm:ss`，Asia/Shanghai |
| 正文 | `event.content` 去除首尾空白 | 块内唯一内容 |
| 占位 | `${message_type} 消息` | 正文为空时使用 |

渲染：

```text
<lark-message message_id="om_xxx" time="2026-11-20 23:20:23">
正文
</lark-message>
```

## 桥接提醒

| 字段 | 值 |
| --- | --- |
| 来源 | `{ kind: 'lark-bridge', reminder: true }` |
| 内容 | 一个 text 块，文本是 `<system-reminder>` 帧 |
| 文案 | 中文固定常量，说明块含义与四条回复规则 |

## 表层不变量

- 判定桥接会话：`state.sessionId` 等于 `agent.session.id`。
- 检查提醒：遍历 `session.surface.nodes`，取 `user/message` 事件，`source.kind` 为 `lark-bridge` 且 `reminder` 为 true。
- 补注位置：`PreStepDecision.enter.messages` 中第一条 `<lark-message>` 之前；没有块时放在批次开头。
- 跳过补注：`decision.kind` 为 `reject`；本批没有消息；表层或本批已有提醒。

## 状态文件

`state.json` 结构不变，继续保存 `sessionId`、`workspaceRoot`、`title`、`seen` 与 `updatedAt`。

## 消息来源

```ts
interface MessageSourceMap {
  'lark-bridge': { kind: 'lark-bridge'; reminder?: true }
}
```

- 块消息：`{ kind: 'lark-bridge' }`
- 提醒消息：`{ kind: 'lark-bridge', reminder: true }`
