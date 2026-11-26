# Changelog

## Unreleased

- 修复首条消息含换行的会话被 `session_manage` 接管后，台账校验失败导致 `task_update` 报 `task not found` 的问题。任务消息正文现允许多行，会话标题中的换行折叠为空格，台账校验失败时 `task_update` 与 `task_end` 给出明确错误。
- 精简 `README.md` 的「关于调度会话」与「在场状态」章节，聚焦用户交互与配置说明。

