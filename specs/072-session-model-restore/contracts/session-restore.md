# Contract: `session_restore`

把已归档会话恢复为可用状态。工具注册在 `sa-dispatch` 子行。

## 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| session_id | string | 是 | 已归档的会话 id |
| pin | boolean | 否 | 恢复后是否置顶，默认 `true` |

## 成功结果

```json
{
  "sessionId": "session-abc",
  "taskId": "task-20261127093000-a1b2",
  "taskRestored": true,
  "pinned": true
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| sessionId | string | 被恢复的会话 |
| taskId | string，可选 | 恢复的任务 id |
| taskRestored | boolean | 是否恢复任务 |
| pinned | boolean | 是否已置顶 |
| warning | string，可选 | 部分成功的说明 |

## 恢复动作

1. 校验会话在 `archivedSessionIds` 中。
2. `unarchiveSession`。
3. 扫描 `archive/*/task.json`，取该会话 `archivedAt` 最新的一条。
4. 结束原因为 `session_archived` 时恢复任务：迁回报告目录与任务日志，任务写回台账，删除归档目录，限定路径提交。
5. `pin: true` 时 `pinSession`。

## 失败语义

| 场景 | 行为 |
| --- | --- |
| `session_id` 为空 | 参数错误 |
| `workspaceRegistry` 不可用 | 报错 `workspaceRegistry is unavailable` |
| 会话不在归档集合 | 报错 `session <id> is not archived` |
| 解除归档失败 | 透传宿主错误，任务与 pin 不变 |
| 工作区根未配置 | 会话解除归档，任务不恢复，`warning` 说明没有工作区 |
| 归档任务缺失或损坏 | 会话解除归档，任务不恢复，`warning` 说明原因 |
| 台账已有该会话的未结束任务 | 会话解除归档，跳过任务恢复，`warning` 说明原因 |
| 报告目录或任务日志目标位置已存在 | 恢复失败，归档目录保留 |
| 置顶失败 | `pinned: false` 并带 `warning`，已完成的解除归档与任务恢复保留 |

## 不恢复任务的情形

- 归档任务的 `endReason` 为 `completed`、`cancelled`、`unmanaged`、`session_missing`。
- 该会话在此期间已经建立了新任务。