# Changelog

## Unreleased

- `send_report` 的 `files` 相对路径按调用会话的当前工作目录解析，不再落到宿主进程目录；附件校验失败的错误给出解析后的绝对路径与基准目录。
