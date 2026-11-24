# 实机测试报告 feat/044-worker-session-model

## 环境

- 宿主：全局 `@deepseek-ai/dsh` 0.2.2-rc.5。
- 隔离：`DSH_HOME=D:/tmp/rdt044-home`，profile `rdt-044`，插件以链接方式安装当前检出。用户正在使用的 GUI 服务与 `~/.dsh` 未触碰；测试 GUI 在 3244 端口，已结束。
- 模型：mock provider，含 `mock-model`（默认，无 effort）、`mock-worker` 与 `mock-other`（effort 为 low、high）。`agent-default-model` 为 `mock/mock-model`。
- 后端驱动经宿主 `runProfile` 启动，用真实 `sessionController` 创建 `sa-dispatch` 与 `sa-worker` 会话。调度会话收到 `DISPATCH_CASE` 时由 mock 发出真实的 `session_create` 工具调用（meta-tools）。
- 断言依据：会话落盘事件的 `request/header` 与 `model/selection`。
- 浏览器驱动用 Playwright 驱动本机 Chrome。

## 后端用例（[rd-044.mjs](./real-device-scripts/rd-044.mjs)）

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| E0 装载 | PASS | `sa-dispatch`、`sa-worker` 预设可用；行配置含两个在场开关；默认模型 `mock/mock-model` |
| E1 未配置 | PASS | 调度创建的工作会话无 `model/selection`，实际用 `mock-model` |
| E2 已配置 mock-worker/high | PASS | 工作会话实际用 `mock/mock-worker`、effort `high`；首个请求头即如此；调度会话自身仍为 `mock-model` |
| E3 手动新建 | PASS | 手动新建的 `sa-worker` 会话与默认预设会话均无选择，用 `mock-model` |
| E3b 并发 | PASS | 调度创建进行中并发手动新建 3 个 `sa-worker` 会话，均无选择；被调度创建的那个用 `mock-worker/high` |
| E4 显式参数 | PASS | `session_create` 带 `mock-other`、`low` 时，工作会话用显式值 |
| E5 不可用配置 | PASS | `mock-model` 配 effort `high`（不属于该模型）时回退，工作会话无选择、用 `mock-model`；警告日志未单独断言 |
| E6 半组配置 | PASS | 只有 provider 时按未配置处理 |
| E7 默认模型 | PASS | 全程 `agentDefaultModel` 保持 `mock/mock-model` |

## 浏览器流程（[browser-044.mjs](./real-device-scripts/browser-044.mjs)）

| 流程 | 结果 | 截图 |
| --- | --- | --- |
| 配置页出现「工作会话模型」，初始为「请选择模型」，说明文字指向「用飞书和DSH对话」配置页的「模型」 | PASS | [b1](./real-device-shots/b1-config-before.png) |
| 点击选择器列出 `mock-model`、`mock-worker`、`mock-other` | PASS | [b2](./real-device-shots/b2-picker-open.png) |
| 选 `mock-worker` 后，根菜单出现「模型」与「推理等级」；推理等级列出 Default、Low、High，即所选模型支持的取值 | PASS | [b5](./real-device-shots/b5-effort-menu.png) |
| 选 High 后选择器显示「mock-worker High」，保存按钮可用 | PASS | [b6](./real-device-shots/b6-selected.png) |
| 保存后 `cordis.patch.yml` 的 `lark-super-agent` 行写入 `workerProvider: mock`、`workerModel: mock-worker`、`workerEffort: high` | PASS | [b7](./real-device-shots/b7-saved.png) |
| 重启 GUI 后配置页仍显示「mock-worker High」 | PASS | [b8](./real-device-shots/b8-after-restart.png) |
| 「用飞书和DSH对话」配置页的「模型」仍为「请选择模型」，其配置 `sessionProvider`、`sessionModel`、`sessionEffort` 未写入，补丁里主行配置只有 `workspaceRoot`；`agent-default-model` 仍为 `mock/mock-model` | PASS | [b9](./real-device-shots/b9-main-config.png) |

## 保存后的端到端（[rd-044b.mjs](./real-device-scripts/rd-044b.mjs)）

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| E8 | PASS | 重启后从补丁读取 GUI 保存的配置，不经 `entry.update`；调度创建的工作会话用 `mock-worker/high`，调度会话与手动新建的工作会话用 `mock-model`，默认模型不变 |

## 发现的问题

- 插件：无。
- 驱动：profile 初始补丁含模板的 `prefix`，本插件主行因未知配置键加载失败，已改为 `workspaceRoot: ""` 后重跑。

## 未覆盖

- 未连接真实飞书与真实模型，调度会话的 `session_create` 由 mock 触发。
- E5 的警告日志未单独断言，只验证了回退行为。
- 未验证宿主 `agent/created` 在其他创建入口（例如 `subagent`）下的表现。
