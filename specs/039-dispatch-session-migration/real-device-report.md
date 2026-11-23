# 实机测试报告 0.2.0 c45938f（feat/039-dispatch-session-migration）

## 环境

- 宿主版本：`@deepseek-ai/dsh` 0.2.2-rc.5，全局安装。
- profile：`rdt-039`，位于隔离的 `DSH_HOME`。
  - 插件以链接方式安装当前检出。
  - 模型使用 `real-device-test` 的 mock provider，并扩展了 `TOOL_CASE:<base64url {name,args}>` 标记，用于按名调用任意工具。
- 桥接状态：在隔离 `DSH_HOME` 下手写 `lark-bridge/state.json`。
  - `sessionId` 指向测试中新建的 `SA-调度会话` 会话。
  - `workspaceRoot` 为 Linux 风格路径 `/c/.../dispatch-ws`。
  - 用户真实的 `~/.dsh/lark-bridge/state.json` 未被读写，修改时间早于测试。
- 主行 `workspaceRoot` 保持空值，事件监听不启动，未连接真实飞书。
- 驱动：在 profile 目录运行的 `rd-039.mjs`，通过宿主 `runProfile` 启动，以会话事件、调度工作区文件与 git 日志作为断言依据。

## 后端用例

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| RD-1 四行装载 | PASS | `dsh-plugin-lark-bridge`、`lark-super-agent`、`preset-sa-dispatch`、`preset-sa-worker` 的 `fiber.state` 均为 2；`larkSuperAgent` 服务存在；元数据标题依次为「用飞书和DSH对话」「飞书任务与调度会话」「SA-调度会话」「SA-工作会话」 |
| RD-2 预设名册 | PASS | `agentPresets.list()` 含 `sa-dispatch`（名称为 `SA-调度会话`）与 `sa-worker`（名称为 `SA-工作会话`），两者都没有 `broken`；默认预设仍为 `standard` |
| RD-3 调度工具 | PASS | `sessionController.create` 按 `sa-dispatch` 新建会话。请求工具表含五个调度工具、meta-tools 的 `session_create`/`session_pin`/`session_archive` 与 `lark_notify`，不含 `ask_user_question` 与 `send_report`。`workspace_note_set` 与 `task_create` 在 Linux 风格路径对应的原生目录写入两份 JSON，各提交一次 git |
| RD-4 上报注入 | PASS | 按 `sa-worker` 新建会话。工作会话的工具表含 `send_report`，不含 `ask_user_question` 与 `lark_notify`。`send_report` 返回 `delivered: true` 且带 `taskId`。调度会话收到带 `sessionid`、`reportid`、`taskid` 的 `<work_session_message>` 用户消息并被唤醒；`reports/<taskId>/<reportId>.md` 已写入，git 日志含 `lark-super-agent: report <reportId>` |
| RD-5 停用调度行 | PASS | 停用 `lark-super-agent` 后，主行保持激活。工作会话请求不含 `send_report`，调度会话请求不含 `task_create`，仍含 `lark_notify`。重新启用后调度行恢复激活 |

调度工作区最终的 git 日志：

```text
lark-super-agent: report report-20261123181521-3be283
lark-super-agent: update task-20261123181520-1623
lark-super-agent: create task-20261123181520-1623
lark-super-agent: note aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee
```

## 浏览器流程

未执行。RD-1 与 RD-2 在宿主 loader 与预设名册层面验证，Plugins 页与预设选择器读取的是同一份数据。

## 发现的问题

- 插件：无。
- 驱动：首轮 mock 补丁漏掉 `toolCase` 声明，工作会话一轮以错误结束。这一轮附带验证了 `sa-worker` 的失败监听，修正驱动后重跑全部通过。

## 产物

- profile 目录中的 `rd-results.json`、`requests.jsonl`、`test-sessions/` 与 `dispatch-ws/`。验证结束后随 profile 一并删除。
