# Changelog

## Unreleased

- `SA-调度会话` 新增 `list_models` 工具：一次查询宿主当前全部 provider、model 与各路由支持的 reasoning effort，结果可直接用于 `session_create` 的模型参数；模型服务不可用时给出明确错误，个别 provider 或 model 目录失败时跳过并在结果中标注。
- 修复首条消息含换行的会话被 `session_manage` 接管后，台账校验失败导致 `task_update` 报 `task not found` 的问题。任务消息正文现允许多行，会话标题中的换行折叠为空格，台账校验失败时 `task_update` 与 `task_end` 给出明确错误。
- 精简 `README.md` 的「关于调度会话」与「在场状态」章节，聚焦用户交互与配置说明。

