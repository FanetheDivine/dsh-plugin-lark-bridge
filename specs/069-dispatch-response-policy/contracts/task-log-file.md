# 契约：任务日志文件

- 路径：`task-logs/<taskId>.jsonl`，UTF-8，每行一个 JSON 对象，字段见 [data-model.md](../data-model.md)。
- 写入：仅插件在调度工作区串行队列内追加；写前确认任务未结束；不 git 提交。
- 读取：调度会话 pre-step 注入时，插件按未注入的条目读取；全新会话快照读取各任务最新报告之后的条目。
- 归档：任务结束时整文件 `rename` 到 `archive/<taskId>/task-log.jsonl`，该次 git 提交包含源文件删除与归档新文件。
- 归档后插件与调度会话都不再读取该文件。
