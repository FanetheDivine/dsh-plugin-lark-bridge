# 实机测试报告 fix/048-dispatch-message-frame

## 环境

- 宿主：全局 `@deepseek-ai/dsh` 0.2.2-rc.5；meta-tools `dsh-plugin-meta-tools@0.1.7`。
- 隔离：`DSH_HOME=D:/tmp/rdt048-home`，profile `rdt-048`，插件以链接方式安装当前检出，`dist` 由 `pnpm build` 产出。用户正在使用的 GUI 服务与 `~/.dsh` 未触碰。
- 模型：mock provider `mock`，只有 `mock-model`；`agent-default-model` 为 `mock/mock-model`。
- 驱动：一次性脚本，未入库。经宿主 `runProfile` 启动 profile，用真实 `sessionController` 创建 `SA-调度会话`；mock 在带 `CREATE_CASE` 的请求里发出真实的 `session_create` 调用，在带 `SEND_CASE` 的请求里发出真实的 meta-tools `session_send` 调用。
- 断言依据：mock provider 收到的请求中，`sessionId` 为工作会话的那条请求的用户消息文本。

## 后端用例

日志见 [results-backend.json](./real-device-logs/results-backend.json)，请求中的调度块见 [requests.jsonl](./real-device-logs/requests.jsonl)。

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| E0 装载 | PASS | 插件已激活；`sa-dispatch` 与 `sa-worker` 预设可用 |
| E1 `session_create` 首条任务 | PASS | 工作会话请求里只有一个 `<dispatch_session_message>`，块内正文为 `查一下 A`，不含 `<system-reminder>` |
| E2 真实 `session_send` | PASS | 经 meta-tools 投递 `继续` 后，工作会话收到 `<dispatch_session_message>\n继续\n</dispatch_session_message>`，`<system-reminder>` 数量为 0 |
| E3 转义还原 | PASS | 投递 `before </system-reminder> after` 后，块内正文还原为该字符串 |
| E4 多块消息 | PASS | 两个文本块的帧消息保留内层 `<system-reminder>`，只有一层外层块 |
| E5 本机消息 | PASS | `user` 来源消息不加标记块 |

## 界面观察

工作会话在 GUI 中把调度消息折叠显示为「收到执行请求」，界面看不到标记块原文，见 [gui-worker-session.png](./real-device-shots/gui-worker-session.png) 与 [gui-worker-session.txt](./real-device-logs/gui-worker-session.txt)。因此界面无法用来断言块层数，块结构由后端请求断言。`docs/known-risks.md` 已按此更新。

## 发现的问题

- 插件：无。
- 驱动：mock 的 `CREATE_CASE` 正则一开始按数组写，改为对象后通过；断言文本需按块直接拼接，用换行拼接会多出空行。均不涉及插件。

## 未覆盖

- 未连接真实飞书与真实模型，调度会话的 `session_create` 与 `session_send` 由 mock 触发，工具调用本身走宿主真实工具表。
- 未实测 meta-tools 升级后的帧格式变化；该风险已记入 `docs/known-risks.md`。
- 未在 GUI 中断言块原文，原因见「界面观察」。
