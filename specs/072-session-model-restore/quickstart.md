# Quickstart: 调度会话切换会话模型与恢复已归档会话

## 前置条件

1. Node.js >= 24.9 与 pnpm 11。
2. 在 worktree 根目录安装依赖：`pnpm install`。
3. 已有一个可派发的调度工作区，并能通过飞书私聊驱动 `SA-调度会话`。

## 本地验证

```sh
pnpm format
pnpm check
```

预期：

- `session_model` 与 `session_restore` 出现在调度会话的工具表。
- 单元测试覆盖参数转换、校验失败、恢复编排与台账迁移。

## 单元测试场景

| 场景 | 断言 |
| --- | --- |
| 切换任务会话模型 | 目标 Agent 收到 `model.select`，参数为 provider/model/effort |
| 省略 `session_id` | 目标是调用方会话 |
| provider 或 model 为空 | 抛 `ToolArgsError`，没有 `model.select` 调用 |
| 宿主校验失败 | 工具报错，没有 `model.select` 调用 |
| 已归档会话 | 结果 `archived: true` |
| 恢复带任务的会话 | 台账出现原任务，报告与日志回到原位，归档目录消失 |
| 恢复已完成任务的会话 | `taskRestored: false`，台账无该会话任务 |
| 未归档会话 | 抛错，`unarchiveSession` 未被调用 |
| `pin: false` | 不调用 `pinSession` |
| 置顶失败 | 结果 `pinned: false` 且带 `warning` |

## 真实宿主验证

```sh
bash .dsh/skills/real-device-test/scripts/setup-env.sh <worktree 绝对路径> rdt-072
```

验证步骤：

1. 新建一个任务会话，确认工具表含 `session_model` 与 `session_restore`。
2. 对任务会话调用 `session_model` 指定另一条已注册路由，检查会话下一次请求的 `requests.jsonl` 使用新模型，且新建会话的默认模型不变。
3. 归档任务会话，确认任务结束、pin 消失。
4. 调用 `session_restore`，确认会话离开归档集合、任务回到台账、pin 恢复，并再次调用 `send_report` 成功。
5. 对未归档会话调用 `session_restore`，确认返回未归档错误。

## 证据留存

- 单元测试命令输出。
- `requests.jsonl` 中切换前后的模型字段。
- 调度工作区 `message-task-status.json` 与 `archive/` 的前后状态。
- 真实宿主测试报告。