# Changelog

## Unreleased

- `session_manage` 接管会话时读取宿主会话标题作为任务初始标题，标题缺失时用会话 id；调度提示词要求基于该标题生成任务名并用 `task_update` 写入。
