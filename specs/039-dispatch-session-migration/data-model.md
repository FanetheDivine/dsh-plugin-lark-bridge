# 数据模型：调度工作区

调度工作区是本插件配置的 `workspaceRoot`。文件结构、字段与写入规则逐字沿用组合包 [`data-model.md@cc3c25d`](https://github.com/FanetheDivine/dsh-plugin-practical-tool-bundle/blob/cc3c25d/specs/025-remote-dispatch-session/data-model.md)。

| 路径 | 内容 |
| --- | --- |
| `message-task-status.json` | 未完成任务 `{ version: 1, tasks: Task[] }` |
| `workspaces.json` | 工作区笔记 `{ version: 1, workspaces: WorkspaceNote[] }` |
| `reports/<taskId>/` | 上报记录与附件副本 |
| `reports/_unassigned/` | 无法关联任务的上报 |
| `archive/<taskId>/` | 任务快照 `task.json` 与上报 |
| `AGENTS.md` | 调度会话自行维护 |

## 桥接状态

服务从本插件 `state.json` 读取两项：

| 字段 | 形式 | 使用 |
| --- | --- | --- |
| `sessionId` | 字符串或 null | 上报与失败通知的投递目标 |
| `workspaceRoot` | Linux 风格路径或 null | 经 `toHostWorkspacePath` 转换后作为调度工作区 |

## 兼容

- 组合包写入的现有数据无需迁移，本插件按相同格式读写。
- 本插件只新增读取端的路径转换，写入的文件内容与组合包一致。
