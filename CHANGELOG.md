# Changelog

## Unreleased

- 归档被管理会话时任务当场结束；`<task_session_archived>` 改为待注入记录，调度会话下一次 pre-step 与任务日志一起注入，不再即时唤起调度会话。
- 新增 `docs/dispatch-signals.md`：按紧急、重要、日志三类说明调度信号的成员与投递方式。
- 上报卡片头部增加「收起」/「展开」折叠开关，默认展开；收起后保留标题、类型标签、单行任务简介预览、送达回执与开关，展开后恢复完整内容。
- 上报卡片正文使用主前景色；卡片内的规则覆盖宿主 compact Markdown 变体写在根节点的三级色。
- 被管理会话调用 `ask_user_question` 时，工具直接成功返回固定指令 S，当前轮次继续。任务模型用 `send_report(kind=question)` 上报任务目的、当前进展、问题与选项；插件不代发提问。
