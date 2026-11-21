# 契约: lark_notify 可用性

**Branch**: `fix/035-notify-tool-scope` | **Date**: 2026-11-21

## 模型可见契约

工具名与参数保持不变。

| 项 | 值 |
| --- | --- |
| 名称 | `lark_notify` |
| 参数 | `text`（必填，非空字符串）、`reply_to`（可选，字符串） |
| 发送目标 | 已绑定用户的私聊 |
| 可见范围 | 状态文件记录的桥接会话 |

## 可用性条件

宿主在每一步解析工具集时调用注册条件。

```text
可见(会话) = 状态文件.sessionId !== null && 会话.id === 状态文件.sessionId
```

条件异常、状态文件缺失或损坏时结果为不可见。不可见的工具不出现在声明中，也不能被分发。

## 执行契约

| 输入 | 结果 |
| --- | --- |
| 桥接会话，合法参数 | 按现有契约发送，返回 `{ ok: true, parts, messageId? }` |
| 桥接会话，非法参数 | 现有错误码，不发送 |
| 非桥接会话或缺少 agent | `{ ok: false, error: { code: 'not-bridge-session' } }`，不调用 CLI |

`not-bridge-session` 的展示文案为「`lark_notify` 只在桥接会话可用」。

## 与提醒的一致性

桥接提醒的适用会话与工具可见会话使用同一判定：状态文件的 `sessionId`。
