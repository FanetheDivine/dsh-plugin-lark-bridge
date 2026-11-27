# Changelog

## Unreleased

- 上报卡片正文使用主前景色；卡片内的规则覆盖宿主 compact Markdown 变体写在根节点的三级色。
- 被管理会话调用 `ask_user_question` 时，调用被拒绝、轮次继续，下一步注入的 S 要求会话用 `send_report` 上报带任务目的、当前状态与选项的提问，并附上被拦截的问题；轮次结束仍未上报时插件补投一条 `ask_intercept` 提问并置 `waiting_user`。
