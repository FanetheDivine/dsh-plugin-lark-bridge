# Research: 飞书消息队列与批量注入

**Feature**: `specs/032-drop-stale-messages/spec.md` | **Date**: 2026-11-21

## R1 迟到消息的来源

**Decision**: 用监听启动时刻过滤 `create_time` 更早的事件。

**Rationale**: 飞书长连接按 `15 秒 / 5 分钟 / 1 小时 / 6 小时` 重推未确认事件。会话 `67993e96` 的两条迟到消息分别落在 `+5 分 07 秒` 与 `+1 小时 5 分 07 秒`，与重推节奏一致；本地事件总线在首次消息到达前尚未启动，排除本地缓存。

**Alternatives considered**:

- 按到达延迟过滤：需要额外阈值，且飞书时钟与本机存在约 8 秒偏差，判定不稳定。
- 按事件序号或游标过滤：lark-cli 输出没有单调序号。

## R2 ACK 责任

**Decision**: ACK 继续由 lark-cli 完成，插件不额外响应远程。

**Rationale**: 长连接的 ACK 是协议层行为，`event consume` 已处理。插件只需持续读取 stdout，注入耗时不能阻塞读取。

**Alternatives considered**:

- 插件给用户回一条「已收到」：与需求无关，还会产生额外飞书消息。
- 插件延迟 ACK：lark-cli 不暴露 ACK 接口。

## R3 批次的注入形态

**Decision**: 一个用户消息，内部多个 `<lark-message>` 块，块之间空行分隔。

**Rationale**: `SessionManager.inject` 接收一段文本并调用 `agent.followup`；一次调用只产生一轮。提醒补注按 `isLarkMessage` 判断整条消息，多个块不影响命中。

**Alternatives considered**:

- 多条 `followup`：会产生多轮，与需求冲突。
- 一个块内合并全部正文：丢失每条消息的 `message_id` 与 `time` 属性。

## R4 静默窗口的实现位置

**Decision**: 放在 `EventBridge`，用单个 `setTimeout` 句柄。

**Rationale**: 队列就在 `EventBridge`，计时器与队列可以一起清理；`SessionManager` 保持无状态注入职责。

**Alternatives considered**:

- 放在 `SessionManager`：需要把队列状态跨层传递。
- 宿主侧 `inbox` 延迟：宿主没有静默窗口能力。

## R5 注入失败的语义

**Decision**: 整批丢弃，保留 `seen` 记录，不重试。

**Rationale**: 与规格 D-005 一致；`seen` 已在入队前写入，失败后不会因为重推再次注入。

**Alternatives considered**:

- 回队重试：配置未就绪时会形成循环重试，与「自然失败」冲突。

## R6 监听生命周期

**Decision**: 配置保存、工作区增删不停止监听；鉴权身份变化才停止或重启。

**Rationale**: 每次保存配置都重启消费者会制造事件空窗，空窗期间的消息在下一次启动后按旧消息被过滤掉。

**Alternatives considered**:

- 保持每次配置变化重启：实现简单，但会丢消息。

## R7 测试时间来源

**Decision**: 测试直接用 `Date.now()` 构造事件时间，静默窗口用 vitest 假计时器。

**Rationale**: 现有测试用固定历史时间戳；加入启动时刻过滤后会被判定为旧消息。假计时器能让 15 秒等待无需真实等待。

**Alternatives considered**:

- 缩短常量做测试：会让生产常量与测试不一致。
