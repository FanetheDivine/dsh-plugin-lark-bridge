# 契约：模型可见工具

工具名、参数、描述、结果与提交信息逐字沿用组合包 [`tools.md@cc3c25d`](https://github.com/FanetheDivine/dsh-plugin-practical-tool-bundle/blob/cc3c25d/specs/025-remote-dispatch-session/contracts/tools.md)。

| 预设 | 工具 |
| --- | --- |
| `SA-调度会话` | `task_create`、`task_update`、`workspace_note_set`、`workspace_note_remove`、`task_candidates` |
| `SA-工作会话` | `send_report` |

## 本插件的约束

- 工具执行时 MUST 从本插件的 `state.json` 读取桥接会话与调度工作区。
- 调度工作区路径 MUST 先经 `toHostWorkspacePath` 转换，再访问文件系统与 git。
- 桥接会话或调度工作区缺失时，工具返回错误，错误文本与组合包相同。
