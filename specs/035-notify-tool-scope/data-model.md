# Data Model: 通知工具限定在桥接会话

**Branch**: `fix/035-notify-tool-scope` | **Date**: 2026-11-21

## 实体

### 桥接状态

来源：`StateStore` 读取的 `state.json`。本变更只读取，不写入。

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `sessionId` | `string \| null` | 桥接会话标识；为 null 时无桥接会话 |
| `workspaceRoot` | `string \| null` | 桥接工作区；不参与可见性判定 |
| `title` | `string \| null` | 会话标题 |
| `seen` | `Record<string, number>` | 注入去重窗口 |
| `updatedAt` | `string` | 最近写入时间 |

### 工具注册

| 字段 | 类型 | 用途 |
| --- | --- | --- |
| `definition.name` | `'lark_notify'` | 工具名；保持不变 |
| `definition.parameters` | `{ text, reply_to? }` | 参数；保持不变 |
| `options.when` | `(context) => Promise<boolean>` | 按步骤判定是否参与 |

### 可用性判定

输入：当前步骤的 `agent.session.id` 与状态文件 `sessionId`。

| 状态文件 `sessionId` | 当前会话 | 可见 |
| --- | --- | --- |
| null | 任意 | 否 |
| S | S | 是 |
| S | 其他会话、子代理子会话 | 否 |

判定读取失败或异常时按不可见处理。

### 执行守卫结果

| 条件 | `ok` | `error.code` | 飞书请求 |
| --- | --- | --- | --- |
| agent 缺失 | false | `not-bridge-session` | 0 次 |
| agent 不是桥接会话 | false | `not-bridge-session` | 0 次 |
| agent 是桥接会话 | 按发送结果 | 现有错误码 | 按发送结果 |

## 状态转换

```text
无桥接会话 ──首次飞书消息，创建会话──▶ 桥接会话 S
桥接会话 S ──状态文件改为 T──▶ 桥接会话 T
```

可见性随状态文件切换；不存在两个会话同时可见。
