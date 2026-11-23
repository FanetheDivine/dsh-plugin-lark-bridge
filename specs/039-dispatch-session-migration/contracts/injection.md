# 契约：注入调度会话的消息块

块结构、转义与触发条件逐字沿用组合包 [`injection.md@cc3c25d`](https://github.com/FanetheDivine/dsh-plugin-practical-tool-bundle/blob/cc3c25d/specs/025-remote-dispatch-session/contracts/injection.md)，并带 `taskid` 属性。

| 块 | 来源 | 投递 |
| --- | --- | --- |
| `<work_session_message sessionid reportid taskid>` | `send_report` | `agent.steer`，`source.kind` 为 `lark-super-agent` |
| `<work_session_failure sessionid taskid>` | 工作会话 `turn/end` 且 `reason.kind === 'error'` | 同上 |
| `<dispatch_session_message>` | 工作会话收到 `source.kind` 为 `dsh-plugin-meta-tools` 的消息 | `agent/pre-step` 包装，保留原 id 与 `source` |
| 在场提醒 `<system-reminder>` | 调度会话按 `source.kind` 判定 `user` 与 `lark-bridge` | `agent/pre-step` 插入，`source.kind` 为 `sa-dispatch-presence` |

## 本插件的约束

- 在场判定的 `lark-bridge` MUST 与本插件注入飞书消息的来源一致；`source.reminder` 为 true 的桥接提醒不参与判定。
