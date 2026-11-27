# 实机验证 071

- 日期：2026-11-27
- 宿主：`@deepseek-ai/dsh` 0.2.2-rc.5
- profile：`rdt-071`（隔离 `DSH_HOME`，mock provider，链接仓库 `dist`）
- 驱动：profile 内脚本，逐场景独立进程；工作区为 profile 下的 `rdt-workspace`

| 场景 | 结果 | 关键断言 |
| --- | --- | --- |
| normal | PASS | `send_report` 工具结果 `delivered: true`；报告文件存在并提交；调度会话收到 `task_session_message`、`unread_report` 与先读说明；台账记录已投递 |
| archived | PASS | 归档旧调度会话后上报，`delivered: true`；桥接状态指向新会话且未归档 |
| missing | PASS | 桥接状态指向不存在的会话，上报后新建会话并送达 |
| unread | PASS | 手工加入未读旧报告后上报，注入块列出旧报告与当前报告，台账标记两份 |
| noworkspace | PASS | 返回 `{ delivered: false, reason: 'no_workspace' }`，桥接状态不变 |
| concurrent | PASS | 两个任务并发上报，只新建一个调度会话，两份报告都送达并各记录一次 |

汇总：6/6 PASS。
