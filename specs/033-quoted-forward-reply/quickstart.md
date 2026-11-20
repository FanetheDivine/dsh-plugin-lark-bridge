# Quickstart: 引用与聊天记录呈现、精确回复

## 前置

- 本机可用 `lark-cli`，bot 与 user 身份均已授权。
- 插件已在 DSH 中加载并绑定工作区。
- 测试会话是 owner 与机器人的私聊。

## 验证命令

```sh
pnpm format
pnpm check
pnpm build
```

## 场景

### 1. 引用回复

1. 在飞书私聊里给机器人发一条文本消息，记下块内 `message_id`。
2. 引用该消息并回复一段新内容。
3. 打开桥接会话，检查注入块：

```xml
<lark-message message_id="om_new" time="…" reply_to="om_old">
<quote message_id="om_old" from="user" time="…">
被引原文
</quote>
回复内容
</lark-message>
```

预期：`<quote>` 在正文之前，被引原文与用户消息一致。

### 2. 引用非文本消息

引用一张图片回复。预期 `<quote>` 内是 `[image 消息]`。

### 3. 引用聊天记录

引用一条聊天记录回复。预期 `<quote>` 内为 `<forwarded_messages message_id="om_…"/>`，不出现子消息正文。

### 4. 聊天记录消息本身

转发一段聊天记录给机器人。预期注入块内只有 `<forwarded_messages message_id="om_…"/>`。

### 5. 精确回复

让模型调用一次带 `reply_to` 的通知，例如：

```text
调用 lark_notify，text 写“收到”，reply_to 填上一条消息的 message_id
```

预期：飞书中该通知显示为对目标消息的回复。

### 6. 失败降级

把 `reply_to` 填成一个不存在的 `om_` 标识。预期返回 `{ ok: false, error: { code: 'reply-failed' | 'send-failed' } }`，不发送普通消息。

## 单元测试覆盖

| 文件 | 覆盖 |
| --- | --- |
| `tests/quote.test.ts` | 身份回退、超时降级、截断、转义、聊天记录 |
| `tests/bridge.test.ts` | 块属性与 `<quote>` 顺序、聊天记录输出 |
| `tests/tools.test.ts` | `reply_to` 参数校验、首段回复、失败返回 |
| `tests/reminder.test.ts` | 新增四条提醒 |