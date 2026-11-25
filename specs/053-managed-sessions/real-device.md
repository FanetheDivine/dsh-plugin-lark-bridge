# 实机验证：调度会话统一管理任务会话

- 日期：2026-11-26
- 宿主：全局 `dsh` 0.2.2-rc.5，隔离 profile `rdt-053`，mock provider
- 驱动：在 `real-device-test` 的 `run-test.mjs` 基础上编写的专项脚本，mock 按 `CALL:<工具>:<JSON>` 调用任意工具

| 用例 | 结果 | 说明 |
| --- | --- | --- |
| A1 主行与 `lark-super-agent` 行激活，无 `sa-worker` 行 | PASS | |
| R1 普通会话可见 `send_report`，未管理时报错；调度会话不可见 | PASS | |
| R2 被管理会话的 `send_report` 投递 `kind`、`origin="send_report"` 与 `<desc>` | PASS | |
| R3 未上报的轮次投递 `origin="turn_end"` 的最后一段文本 | PASS | |
| R4 离开时提问被拒，下一次请求含 S | PASS | |
| R6 等待中的提问在切为离开后约 0.3 秒结束并返回离开错误 | PASS | |
| R5 归档被管理会话后任务归档并投递 `<task_session_archived>` | PASS | |

发现并修复的缺陷：

1. `lark-super-agent` 行未声明 `tools` 依赖，宿主拒绝读取 `ctx.tools`，整行未激活。已声明 `inject = ['tools']`。
2. 离开期间提问若被要求审批，拦截不生效，提问进入审批等待。拦截现在同时覆盖放行与待审批两种决定。

未覆盖：

- 插件加载前已在等待的提问经网关取消。无头环境没有 Web GUI 的提问应答方，网关里没有待处理请求。
- `send_report` 卡片与「任务会话预设」选择器的浏览器展示。
