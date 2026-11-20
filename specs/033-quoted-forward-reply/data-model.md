# Data Model: 引用与聊天记录呈现、精确回复

## 实体

### FeishuEvent（既有，扩展读取）

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `message_id` | string | 事件唯一标识与去重键 |
| `message_type` | string | 判定聊天记录与占位 |
| `content` | string | 本条正文 |
| `reply_to` | string? | 被引消息标识；存在时读取并渲染 `<quote>` |
| `timestamp` / `create_time` | string? | 块时间属性 |

### QuotedMessage（新增，`src/quote.ts`）

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `messageId` | string | 被引消息标识 |
| `from` | `'user' \| 'bot'` | 发送者类型；mget 的 `app` 与 `bot` 都映射为 `bot` |
| `time` | string | 已格式化时间；不可得为空串 |
| `kind` | `'text' \| 'forwarded' \| type` | 渲染分支：文本、聊天记录或类型占位 |
| `text` | string | 截断并转义后的正文 |
| `unavailable` | boolean | 读取失败标记 |

### NotifyArgs（扩展）

| 字段 | 类型 | 必填 | 含义 |
| --- | --- | --- | --- |
| `text` | string | 是 | 通知正文 |
| `reply_to` | string | 否 | 要回复的用户消息标识 |

## 渲染规则

### `<lark-message>`

| 场景 | 输出 |
| --- | --- |
| 普通文本 | `<lark-message message_id time>正文</lark-message>` |
| 引用回复 | 块属性追加 `reply_to`，块内先 `<quote>` 再正文 |
| 聊天记录 | 块内为 `<forwarded_messages message_id="om_…"/>` |
| 非文本 | 块内为 `[<type> 消息]` |

### `<quote>`

| 场景 | 块内 |
| --- | --- |
| 文本 | 截断到 500 字符的正文；截断时追加「（已截断）」 |
| 非文本 | `[<type> 消息]` |
| 聊天记录 | `<forwarded_messages message_id="om_…"/>` |
| 读取失败 | `[引用内容读取失败]` |

属性：`message_id`、`from`、`time`（空串时省略）。

### 转义

| 原始片段 | 输出 |
| --- | --- |
| `</quote>` | `<\/quote>` |
| `</lark-message>` | `<\/lark-message>` |
| 属性中的 `&`、`"`、`<` | `&amp;`、`&quot;`、`&lt;` |

## 状态与不变式

- 一条事件产生一条 `<lark-message>` 块，一段会话消息。
- 去重仍以 `message_id` 为键，引用读取发生在去重之后、注入之前。
- 引用读取失败不写 `seen` 回滚；只有注入失败才调用 `forget`。
- `reply_to` 不改动接收目标；目标由消息自身决定。