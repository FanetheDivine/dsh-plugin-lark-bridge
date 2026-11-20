# Data Model: 飞书消息队列与批量注入

**Feature**: `specs/032-drop-stale-messages/spec.md` | **Date**: 2026-11-21

## 消息事件

过滤与入队的输入，来自 `lark-cli event consume` 的 NDJSON。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `message_id` | string | 去重键；缺失时用 `id` |
| `create_time` | string | 毫秒时间戳；缺失时用到达时间 |
| `chat_type` | string | 只接受 `p2p` |
| `sender_type` | string | 只接受 `user` |
| `sender_id` | string | 必须等于 owner open_id |
| `content` | string | 渲染后的正文；空值时用消息类型占位 |
| `message_type` | string | 文本以外的类型用于占位 |

## 队列条目

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | string | `message_id` |
| `createdAt` | number | 事件 `create_time`，用于过滤与排序 |
| `receivedAt` | number | 插件收到事件的时间，用于日志 |
| `block` | string | `formatLarkMessage` 渲染后的 `<lark-message>` 块 |

## 监听会话

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `startedAt` | number | 当前消费者启动时刻；早于它的消息被过滤 |
| `started` | boolean | 消费者是否在运行 |
| `draining` | boolean | 是否有注入正在执行 |
| `timer` | Timeout or undefined | 15 秒静默计时器 |

## 批次

一次注入的内容。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `items` | 队列条目数组 | 取空队列时的快照 |
| `text` | string | 条目按 `createdAt` 升序、`block` 以空行连接的结果 |

## 状态文件

`lark-bridge/state.json` 结构不变。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `sessionId` | string or null | 桥接会话 |
| `workspaceRoot` | string or null | 归一化工作区路径 |
| `title` | string or null | 固定标题 |
| `seen` | Record<string, number> | `message_id` 到 `create_time` 的去重窗口 |
| `updatedAt` | string | 最近写入时间 |

## 状态转换

```text
事件到达
  ├─ 鉴权未就绪 / 发送者不符 / 缺少标识 -> 丢弃（不计入 seen）
  ├─ message_id 已在 seen            -> 丢弃
  ├─ create_time < startedAt          -> 过滤并记录
  └─ 入队 -> 重置 15 秒计时
                └─ 计时到点 -> 取空队列 -> 排序 -> 拼成一个用户消息 -> 注入
                      ├─ 成功 -> 记录已注入条数
                      └─ 失败 -> 整批丢弃并记录

注入执行中到达 -> 入队 -> 重新计时 -> 本次注入结束后再等 15 秒
监听停止 -> 清空计时器与队列 -> 记录丢弃条数
```
