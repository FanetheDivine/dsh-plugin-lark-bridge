# 契约：上报块

```text
<task_session_message sessionid="…" reportid="…" taskid="…" kind="…" origin="…">
<report_path>reports/<taskId>/<reportId>.md</report_path>
<attachment_paths>
reports/<taskId>/<reportId>-1-<文件名>.md
</attachment_paths>
</task_session_message>
```

- 路径相对
