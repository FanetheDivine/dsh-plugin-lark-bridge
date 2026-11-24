# 实机测试报告 feat/046-session-create-override

## 环境

- 宿主：全局 `@deepseek-ai/dsh` 0.2.2-rc.5。
- 隔离：`DSH_HOME=D:/tmp/rdt046-home`，profile `rdt-046`，插件以链接方式安装当前检出（提交 `c833a7b` 之后的代码）。用户正在使用的 GUI 服务（50918）与 `~/.dsh` 未触碰；测试 GUI 在 3246 端口，已结束。桥接工作区保持未选择，未连接飞书。
- 模型：mock provider `mock`，含 `mock-model`（默认，无 effort）、`mock-worker` 与 `mock-other`（effort 为 low、high）。`agent-default-model` 为 `mock/mock-model`。
- 驱动为一次性脚本，未入库。后端驱动经宿主 `runProfile` 启动，用真实 `sessionController` 创建 `sa-dispatch` 会话；调度会话收到 `DISPATCH_CASE:<json>` 时由 mock 发出真实的 `session_create` 工具调用，工具经宿主工具表执行。
- 断言依据：会话落盘事件的 `model/selection`，以及 mock provider 收到的每个请求的 `provider`、`model`、`reasoningEffort`。
- 浏览器驱动用 Playwright 驱动本机 Chrome。

## 后端用例

日志见 [drive.log](./real-device-logs/drive.log)，结果见 [results-backend.json](./real-device-logs/results-backend.json)；`requests.jsonl` 是重启后 E11 一轮的 mock 请求记录。

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| E0 装载 | PASS | `sa-dispatch`、`sa-worker` 预设可用；默认模型 `mock/mock-model` |
| E1 工具表 | PASS | 调度会话请求携带的 meta-tools 工具共 11 个，`session_create` 只有一个，其余十项（含 `session_list`、`session_get`、`session_send`、`session_pin`、`session_archive`、四个 `workspace_*`）都在；插件加载无重名错误 |
| E2 未配置 | PASS | 调度创建的工作会话无 `model/selection`，首个请求用 `mock-model` |
| E3 已配置 mock-worker/high | PASS | 工作会话 `model/selection` 为 `mock-worker/high`，首个请求即用 `mock-worker`、effort `high`；调度会话自身仍为 `mock-model` 且无选择 |
| E4 手动新建 | PASS | 手动新建的 `sa-worker` 会话与默认预设会话均无选择，用 `mock-model` |
| E5 并发 | PASS | 两个调度创建与一个手动新建同时进行：两个调度创建的会话用 `mock-worker/high`，手动新建的用 `mock-model` |
| E6 显式参数 | PASS | 带 `mock-other`、`low` 时工作会话用显式值，配置不参与 |
| E6b 显式非法 | PASS | 带不存在的模型时工具报 `Invalid model selection`，不创建会话 |
| E7 配置不可用 | PASS | `mock-model` 配 effort `high` 时回退，工作会话无选择、用 `mock-model`，创建照常 |
| E8 半组配置 | PASS | 只有 provider 时按未配置处理 |
| E9 无需重启 | PASS | 运行中把配置改为 `mock-worker/low`，下一次创建即用 `low` |
| E10 默认模型 | PASS | 全程 `agentDefaultModel` 保持 `mock/mock-model`，无 effort |

## 浏览器流程与重启

| 流程 | 结果 | 截图 |
| --- | --- | --- |
| 选择 `mock-worker` 后，根菜单出现「模型」与「推理等级」 | PASS | [menu](./real-device-shots/explore-3-menu.png) |
| 推理等级列出 Default、Low、High | PASS | [effort](./real-device-shots/explore-4-effort-menu.png) |
| 选 High 后选择器显示「RDT mock / mock-worker High」，保存可用 | PASS | [selected](./real-device-shots/save-5-selected.png) |
| 保存后 `cordis.patch.yml` 的 `lark-super-agent` 行写入 `workerProvider: mock`、`workerModel: mock-worker`、`workerEffort: high` | PASS | [saved](./real-device-shots/save-6-saved.png) |
| 结束 GUI 后重新启动，配置页仍显示「RDT mock / mock-worker High」 | PASS | [verify](./real-device-shots/verify-1-config.png) |
| E11 重启后另起宿主，读取 GUI 保存的配置：调度创建的工作会话用 `mock-worker/high`，手动新建与调度会话用 `mock-model`，默认模型不变 | PASS | [results-after-restart.json](./real-device-logs/results-after-restart.json) |

## 发现的问题

- 插件：无。
- 驱动：profile 初始补丁含模板的 `prefix`，主行因未知配置键加载失败，已改为 `workspaceRoot: ""` 后重跑；驱动内解析工具结果的正则两次写错，已修正后重跑，不涉及插件。

## 未覆盖

- 未连接真实飞书与真实模型，调度会话的 `session_create` 由 mock 触发。
- 配置不可用时的警告日志未单独断言，只验证了回退行为。
- 未实测预设内 meta-tools 行被改回 `session_create: true` 的重名场景；该风险依据宿主 `NamedEntries.insert` 源码阅读。
- 未实测旧 profile 升级路径；补丁按组合层生效依据 `cordis.patch.yml` 头部说明。
