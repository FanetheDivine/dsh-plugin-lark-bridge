# Changelog

- `lark_notify` 的工具声明改为纯 JSON，剔除 zod 的不可枚举 `~standard` 键；修复同时启用 `dsh-plugin-better-mcp` 时宿主抛出 `parameters must be lossless JSON` 并终止进程的问题。
