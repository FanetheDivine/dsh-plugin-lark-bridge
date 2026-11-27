# Changelog

## Unreleased

- 上报卡片正文使用主前景色；卡片内的规则覆盖宿主 compact Markdown 变体写在根节点的三级色。
- 被管理会话调用 `ask_user_question` 时，工具直接成功返回固定指令 S，当前轮次继续。任务模型用 `send_report(kind=question)` 上报任务目的、当前进展、问题与选项；插件不代发提问。
