# Quickstart: 任务边界与上报规则

## 自动检查

```sh
pnpm format && pnpm check
pnpm full-check
```

预期：全部通过。

## 实机场景

按 `real-device-test` 技能在隔离 profile 运行。

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 上报类型 | 工作会话调用 `send_report`，`kind` 为 `question` | 调度会话收到带 `kind="question"` 的块；存档含 `kind` |
| 非法类型 | 调用时缺少 `kind` | 工具报参数错误，调度会话无新消息 |
| 本机完成 | 在场状态为在电脑旁，工作会话完成任务 | 工作会话发出 `kind: completed` 上报 |
| 结束任务 | 调度会话收到 `completed` 上报 | 任务归档，会话归档 |
| 独立任务 | 任务 A 进行中，发一条无关指令 | 新建任务 B，首条要求不含 A 的内容 |
