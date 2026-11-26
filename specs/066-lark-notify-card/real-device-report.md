# 实机验证报告：通知正文卡片与上报正文色

## 环境

- 宿主：DSH `0.2.2-rc.5`，隔离 profile `rdt-066-notify-card`
- 插件：当前 worktree 链接安装，加载本次 `dist/client.js`
- 驱动：本机 Chrome + Playwright
- 外部服务：mock 模型与可控 `lark-cli`，未向真实飞书用户发送消息

## 结果

| 用例 | 结果 | 证据 |
| --- | --- | --- |
| R1 成功通知 | PASS | 卡片只含 `通知正文第一行\n通知正文第二行：**保留记号**`，只有一个正文区域；Markdown 记号原样显示，计算颜色为 `rgb(15, 17, 21)` |
| R2 失败通知 | PASS | mock CLI 返回 `send-failed`；会话事件保留「发送失败」结果，通知卡片数量不变，宿主默认工具结果行为不变 |
| R3 上报正文色 | PASS | 上报正文、任务简介、附件名的计算颜色均为 `rgb(15, 17, 21)`，与宿主主前景令牌一致 |
| R4 历史加载 | PASS | 页面重载后，通知与上报卡片均默认可见，无需展开过程分组 |

`browser-results.json` 保存四项浏览器断言。截图：

- [成功通知正文卡片](./real-device-shots/r1-notify.png)
- [失败通知不新增卡片](./real-device-shots/r2-notify-failure.png)
- [上报卡片正文色](./real-device-shots/r3-report.png)
- [历史加载后的上报卡片](./real-device-shots/r4-history.png)

## 回归与清理

- `pnpm full-check`：54 个源码测试文件、698 项测试通过；2 个产物测试文件、10 项测试通过。
- 调度测试产生的自动提交与台账已从功能分支移除。
- 隔离 GUI 已停止，测试 profile 已删除。
