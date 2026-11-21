# Changelog

## [0.2.0] - 2026-11-21

## Unreleased

### Changed

- 飞书消息到达后立即注入。删除注入前的 15 秒静默窗口，每条消息各自一个 `<lark-message>` 块，按创建时间升序串行投递。
- 桥接会话运行中用 `agent.steer` 把消息并入当前 turn，在下一个 step 边界领用；空闲时用 `agent.followup` 开启新 turn。turn 结束时插话仍在队列，改为 followup 投递。

### 风险

- 连续消息不再合并为一个轮次。每条消息各占一次注入，桥接会话的回复次数增加。
- 插话会打断当前 turn 的任务上下文。steer 与 worker 上报共享 next-step 队列，优先级取决于插入位置。
- 监听启动前创建的消息即使被飞书重推也不注入，只写宿主日志。
