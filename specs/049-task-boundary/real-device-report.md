# 实机测试报告 fix/049-task-boundary

## 环境

- 宿主：全局 `@deepseek-ai/dsh` 0.2.2-rc.5。
- 被测提交：`0581c68`，`dist` 由 `pnpm build` 产出。
- 隔离：`DSH_HOME=<DSH_HOME>`，profile `rdt-049`，插件以链接方式安装当前检出。用户正在使用的 GUI 服务与 `~/.dsh` 未触碰。
- 模型：mock provider `mock`，只有 `mock-model`；`agent-default-model` 为 `mock/mock-model`。
- 工作区：
  - 调度工作区为 `<DSH_HOME>/dispatch-ws`，驱动启动前执行 `git init`，git 身份经 `GIT_CONFIG_*` 环境变量提供。
  - 工作会话的工作区为 `<DSH_HOME>/worker-ws`，注册为宿主工作区 `aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee`。
- 驱动：一次性脚本，放在 profile 目录，未入库。
  - 经宿主 `runProfile` 启动 profile，用真实 `sessionController.create` 创建 `SA-调度会话`。
  - 把调度会话的 `sessionId` 与调度工作区写入 `<DSH_HOME>/lark-bridge/state.json`。
  - mock 在 `CALL <tool> <json>` 形式的用户消息里发出该工具的真实调用。调度会话依次调用 `workspace_note_set`、`task_create`、`session_create`、`task_update add_session_ids`；工作会话调用 `send_report`。
- 断言依据：mock provider 收到的请求，会话落盘事件，调度工作区文件与 git 提交。

## 后端用例

日志见 [results-backend.json](./real-device-logs/results-backend.json)，请求片段见 [requests.jsonl](./real-device-logs/requests.jsonl)。

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| R0 装载 | PASS | 主行与 `lark-super-agent` 行 `fiber.state` 为 2；`agentPresets.list()` 含 `sa-dispatch`、`sa-worker`，均无 `broken` |
| R1 工具声明 | PASS | 工作会话请求中 `send_report.parameters.required` 为 `["kind"]`；`kind` 为 `string`，`enum` 为 `progress`、`question`、`completed`、`abandoned` |
| R2 有效上报 | PASS | `send_report {kind:"question", text:"选 A 还是 B？"}` 返回 `delivered: true`；调度会话下一次请求的用户消息含一个 `<work_session_message ... kind="question">` 块，正文为上报文本；存档 front matter 在 `taskId` 之后一行为 `kind: "question"`；调度工作区产生提交 `lark-super-agent: report <reportId>` |
| R3 非法上报 | PASS | 缺少 `kind` 返回 `Error: invalid arguments: missing required property "kind"`；`kind:"finished"` 返回 `Error: invalid arguments: "kind" must be one of [...]`；两者事件错误码均为 `ToolArgsError` / `INVALID_ARGS`；调度会话没有新的模型请求，存档文件数不变 |
| R3 服务层校验 | PASS | 绕过工具 schema 直接调用 `larkSuperAgent.sendReport({kind:"finished"})`，抛出 `send_report kind must be one of progress, question, completed, abandoned`；没有投递，没有存档 |
| R4 提示词 | PASS | 工作会话系统提示含 `## Report every task change`；调度会话系统提示含 `## End tasks only on the report kind`，`Classify each user message first` 段首句为 `Treat every user message as a new task by default.` |
| R5 任务关联 | PASS | `task_create` 后用 `task_update add_session_ids` 关联工作会话；上报块的 `taskid` 与工具结果的 `taskId` 均为该任务；存档位于 `reports/<taskId>/<reportId>.md` |

存档内容见 [report-archive.md](./real-device-logs/report-archive.md)，调度工作区的提交与文件见 [dispatch-git-log.txt](./real-device-logs/dispatch-git-log.txt) 与 [dispatch-ws-tree.txt](./real-device-logs/dispatch-ws-tree.txt)。

## 发现的问题

- 插件：无。
- 驱动：
  - 首次运行 R2 失败。块头正则在整个请求 JSON 中搜索，先命中调度提示词里的格式示例 `kind="<kind>"`。改为只在用户消息中查找后通过，不涉及插件。
  - 宿主 `controller.presetForSession` 对工作会话返回 `undefined`，驱动改用请求中的 `send_report` 工具与 `sa-worker` 提示词段判断预设生效。

## 未覆盖

- mock 模型按脚本发出工具调用，无法验证模型是否遵守新提示词：
  - 工作会话是否按变更选择正确的 `kind`，并在本地模式照常上报。
  - 调度会话是否默认把消息归为新任务，且只在 `completed`、`abandoned` 上报后结束任务。
  - 这些行为需要用真实模型验收。
- 未连接真实飞书，未覆盖飞书侧的通知展示。
- 实机只投递了 `question`。`progress`、`completed`、`abandoned` 与它走同一路径；单元测试覆盖 `progress` 与 `completed`。
- 未做浏览器用例与热更新验证；本分支没有前端改动。
