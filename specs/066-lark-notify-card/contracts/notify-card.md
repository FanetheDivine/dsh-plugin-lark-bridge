# Contract: lark_notify 通知卡片

## 成功结果识别

只接受单条文本内容，完整匹配以下两种宿主结果之一：

```text
已发送给用户（N 条）
已回复给用户（N 条）
```

- `N` 为正整数。
- `isError === true`、非 append 副本、其他文本与多条 content 均不匹配。
- 工具 render 文案变化时不再匹配，展示回退为宿主默认工具行。

## 调用参数

```json
{
  "text": "发给用户的完整正文",
  "reply_to": "可选的用户消息 message_id"
}
```

- `text` 按纯文本展示，保留换行。
- `reply_to` 仅作为调用数据保留；回执动作从结果文本读取。
- 不读取或展示 `messageId`。

## 界面文案

| 键 | 中文 | English |
| --- | --- | --- |
| `notify.title` | 飞书通知 | Lark notification |
| `notify.sent` | 已发送 | Sent |
| `notify.replied` | 已回复 | Replied |
| `notify.parts` | 条 | messages |

回执组合为「已发送 · N 条」或「已回复 · N 条」。英文按同一字典键组合，不硬编码中文。
