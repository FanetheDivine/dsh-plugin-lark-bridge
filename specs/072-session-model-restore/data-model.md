# Data Model: 调度会话切换会话模型与恢复已归档会话

## 会话模型选择

宿主会话日志中的 `model/selection` 事件。

| 字段 | 类型 | 约束 |
| --- | --- | --- |
| provider | string | 已在宿主注册的 provider id |
| model | string | 该 provider 下存在的 model id |
| reasoningEffort | string，可选 | 该路由支持的 effort id；省略时用路由默认值 |

规则：

- 记录后从下一步生效。
- 只影响目标会话，不写全局默认模型。
- 目标会话已归档时记录仍写入，模型步要等解除归档后才执行。

## 归档任务

`<root>/archive/<taskId>/task.json`，`ArchivedTask` 的既有结构。

| 字段 | 来源 | 恢复时处理 |
| --- | --- | --- |
| id | `Task.id` | 保留 |
| title | `Task.title` | 保留 |
| status | `Task.status` | 保留 |
| sessionId | `Task.sessionId` | 保留；用于匹配会话 |
| workspaceId | `Task.workspaceId` | 保留 |
| cwd | `Task.cwd` | 保留 |
| reportIds | `Task.reportIds` | 保留 |
| deliveredReportIds | `Task.deliveredReportIds` | 保留，缺省按 `reportIds` 初始化 |
| messages | `Task.messages` | 保留 |
| createdAt | `Task.createdAt` | 保留 |
| updatedAt | `Task.updatedAt` | 刷新为恢复时间 |
| archivedAt | 归档时间 | 丢弃 |
| endReason | 结束原因 | 只恢复 `session_archived` |

伴生路径：

| 归档位置 | 恢复后位置 |
| --- | --- |
| `archive/<taskId>/reports/` | `reports/<taskId>/` |
| `archive/<taskId>/task-log.jsonl` | `task-logs/<taskId>.jsonl` |
| `archive/<taskId>/task.json` | 删除（内容进入台账） |
| `archive/<taskId>/` | 删除 |

## 恢复结果

`session_restore` 的返回值。

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| sessionId | string | 被恢复的会话 |
| taskId | string，可选 | 恢复的任务；没有恢复时省略 |
| taskRestored | boolean | 是否恢复任务 |
| pinned | boolean | 是否已置顶 |
| warning | string，可选 | 部分成功的说明，例如置顶失败或任务未恢复的原因 |

## 状态转换

归档任务：

```text
archive/<taskId>（endReason=session_archived）
  → 迁移报告与日志
  → 台账重新出现该任务
  → 删除归档目录
```

归档会话：

```text
archivedSessionIds 含 id
  → unarchiveSession
  → 不在归档集合
  → pinSession（pin=true）
  → pinnedSessionIds 含 id
```

## 校验规则

- 会话 id 去空白后非空。
- provider 与 model 去空白后都非空，否则按参数错误拒绝。
- effort 去空白后为空等同于省略。
- 恢复要求会话在归档集合中。
- 恢复任务要求台账中没有该会话的未结束任务，且台账可读。
- 报告目录或任务日志的目标位置已存在时，恢复失败，避免覆盖。