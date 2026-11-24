# Data Model: 侧栏在场状态按钮

## UserPresence

`'local' | 'remote'`。`local` 表示在电脑旁，`remote` 表示离开。沿用 `src/sa-dispatch/presence.ts` 的类型。

## PresenceStore

`lark-super-agent` 行内存中的唯一实例。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `presence` | `UserPresence` | 初始 `local` |
| `updatedAt` | `number` | 最近一次变化的毫秒时间戳 |

| 操作 | 效果 |
| --- | --- |
| `get()` | 返回当前快照 |
| `set(presence)` | 手动切换；写入并更新 `updatedAt` |
| `observe(messages)` | 按配置与消息来源更新；已观察的消息对象跳过 |

状态迁移：

| 事件 | 条件 | 结果 |
| --- | --- | --- |
| 行启用 | 无 | `local` |
| 手动切换 | 无 | 目标状态 |
| GUI 输入 `source.kind === 'user'` | `guiInputSetsLocal` 为 true | `local` |
| 飞书输入 `source.kind === 'lark-bridge'` 且非桥接提醒 | `larkInputSetsRemote` 为 true | `remote` |

同批多条可判定消息以最后一条为准。手动与自动以发生先后为准。

## lark-super-agent Config

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `guiInputSetsLocal` | `boolean`，volatile | `true` | GUI 文本输入把状态设为在电脑旁 |
| `larkInputSetsRemote` | `boolean`，volatile | `true` | 飞书输入把状态设为离开 |

## 在场提醒消息

`createUserMessage` 生成的用户消息，只注入 `SA-调度会话` 与 `SA-工作会话`。

| `source` 字段 | 值 |
| --- | --- |
| `kind` | `'sa-presence'` |
| `form` | `'notice'` |
| `presence` | `'local'` 或 `'remote'` |

识别与比较只读 `source.kind` 与 `source.presence`。旧版 `kind: 'sa-dispatch-presence'` 的提醒不匹配，升级后补一条。

### 提醒正文

两个预设共用：

```text
<system-reminder>
User presence: the user is at the computer and reads this session in the Web GUI.
</system-reminder>
```

```text
<system-reminder>
User presence: the user is away from the computer and reachable only through Lark.
</system-reminder>
```
