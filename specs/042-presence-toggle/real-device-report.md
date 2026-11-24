# 实机测试报告 0.3.0（feat/042-presence-toggle）

## 环境

- 宿主版本：`@deepseek-ai/dsh` 0.2.2-rc.5，全局安装。
- profile：`rdt-042`，位于隔离的 `DSH_HOME`，插件以链接方式安装当前检出。
- 模型：`real-device-test` 的 mock provider，回复「mock：已收到」，每个请求写入 `requests.jsonl`。
- 主行 `workspaceRoot` 为空，事件监听不启动，未连接真实飞书。飞书输入以 `source.kind: 'lark-bridge'` 的消息模拟。
- 后端驱动 `rd-042.mjs` 经宿主 `runProfile` 启动；浏览器驱动 `rd-042-browser.mjs` 用 Playwright 打开本机 Chrome。

## 后端用例

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| RD-1 装载 | PASS | `lark-super-agent` 与主行激活；行配置为两个开关 `true`；初始状态 `local` |
| RD-2 调度会话首次提醒 | PASS | 首个请求含 `User presence: the user is at the computer`；第二轮不重复，会话中提醒为 `['local']` |
| RD-3 飞书输入 | PASS | 全局状态变为 `remote`；请求含 `away from the computer`；提醒为 `['local', 'remote']` |
| RD-4 手动切换与上报 | PASS | `set('local')` 后上报唤醒的一步插入 `local` 提醒；上报来源不改变状态 |
| RD-5 工作会话 | PASS | 插入 `remote` 提醒；提示词含 `Follow where the user is`，不含「用户在电脑前」；调度消息被包装 |
| RD-6 默认预设会话 | PASS | 不插入提醒；其 GUI 输入把全局状态改为 `local` |
| RD-7 关闭飞书开关 | PASS | 行配置热更新，`fiber.uid` 不变；飞书消息不改变状态 |
| RD-8 停用调度行 | PASS | 启动时、停用时、重新启用后 `/lark-bridge/presence` 的匹配依次为已注册、无、已注册；停用时服务下线 |

## 浏览器流程

| 用例 | 结果 | 关键断言 |
| --- | --- | --- |
| BR-1 初始图标 | PASS | 页脚按钮 36×36，`data-presence="local"`，提示「在电脑旁 · 点击切换为离开」 |
| BR-2 单击切换 | PASS | 2 秒内变为手机图标，路由返回 `remote`，提示「离开 · 点击切换为在电脑旁」 |
| BR-3 多页同步 | PASS | 另一标签页约 2 秒同步 |
| BR-4 折叠侧栏 | PASS | 按钮带 `data-rail="rail"`，可见且单击可切换 |
| BR-5 未注册路径 | PASS | 返回无正文类型的 404，前端按非 JSON 处理 |
| BR-6 行配置页 | PASS | 两个开关初始开启；关闭飞书开关保存后补丁写入 `larkInputSetsRemote: false` |
| BR-7 停用调度行 | PASS | 补丁停用该行后约 5 秒按钮消失，恢复后约 4 秒出现 |

截图见 [real-device-shots](./real-device-shots/)：

- `br1-local.png`：展开侧栏的初始图标。
- `br4-collapsed.png`：折叠侧栏的图标。
- `br6-config.png`：行配置页。

## 发现的问题

- 插件：首轮 RD-8 发现启动时路由未注册。`lark-super-agent` 行在 `webServer` 就绪前激活，`ctx.get('webServer')` 取不到服务。改为 `ctx.inject(['webServer'], ...)` 可选依赖后重跑通过，并补充单元测试。
- 驱动：飞书鉴权弹窗会遮挡页面，浏览器驱动在每个流程前关闭它。
- 文档：未注册路径实测为 404 而非 SPA 首页，已更新 research 与 how-it-works。

## 未覆盖

- 隔离 profile 没有安装 `dsh-plugin-practical-tool-bundle`，未在实机中观察本按钮与扫帚、重启按钮的并排效果；排序依据 `order: 52`。
- 未连接真实飞书，`lark_notify` 渠道选择依赖模型遵守提示词，需人工验收。
