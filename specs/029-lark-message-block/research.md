# 技术研究：飞书消息块与回复提醒

宿主版本以仓库锁定的 `@deepseek-ai/*@0.2.2-rc.3` 源码为准；结论已在该版本源码中核对。

## R-001 提醒补注机制

**Decision**: 在 `agent/pre-step` 瀑布里把提醒消息折叠进本步已认领的消息批次，插在第一条 `<lark-message>` 之前。

**Rationale**: 宿主 `dsh-agent-instructions` 用同一机制把 `<system-reminder>` 用户消息送入请求。折叠进批次的消息会作为 `user/message` 事件持久化，重放、恢复与压缩后都能从表层重建。`PreStepDecision.enter.messages` 同时满足三个约束：同一请求、提醒在块之前、持久化。

**Alternatives Considered**:

- `agent.inject()`：消息作为待处理上下文，与 `followup` 的先后取决于驱动，无法保证提醒先于块。
- 两次 `agent.followup()`：产生两个 turn，提醒与块不在同一请求。
- 系统提示词 section：节点 0 受压缩保护，但载体是 `system/message`，不符合表层 system-reminder 的要求。

## R-002 桥接会话识别

**Decision**: 用 `StateStore` 中的 `sessionId` 与 `agent.session.id` 比较。

**Rationale**: 压缩可能同时覆盖提醒与全部 `<lark-message>`，仅扫描表层内容会漏判。状态文件在重启后仍在，恢复会话也能识别。

**Alternatives Considered**:

- 表层内容扫描：压缩后可能没有任何 lark 来源消息。
- 进程内集合：宿主重启或会话恢复后丢失。

## R-003 提醒的持久化标记

**Decision**: 复用 `source.kind === 'lark-bridge'`，提醒消息额外带 `reminder: true`。

**Rationale**: 单一来源类型让现有去重与断言保持简单；标记足以区分提醒与消息块。`MessageSourceMap` 的声明从 `src/sessions.ts` 移到共享模块，避免两处重复声明。

**Alternatives Considered**:

- 新增 `'lark-bridge-reminder'` 来源类型：需要第二个映射键，收益只是少一个字段。

## R-004 时间格式

**Decision**: 使用 `Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Shanghai', hourCycle: 'h23', ... })` 输出 `YYYY-MM-DD HH:mm:ss`。

**Rationale**: `sv-SE` 的本地化格式就是短横线日期加空格分隔时间；`hourCycle: 'h23'` 避免午夜显示为 24。

**Alternatives Considered**:

- `zh-CN`：输出 `2026/11/20`，斜杠不符合已确认格式。
- 手工拼接 `formatToParts`：代码更长，收益相同。

## R-005 块边界转义

**Decision**: 正文中的 `</lark-message>` 替换为 `<\/lark-message>`；属性值中的 `"` 替换为 `&quot;`。

**Rationale**: 与现有 `reminder()` 对 `</system-reminder>` 的处理一致，保证块边界唯一。

**Alternatives Considered**:

- 不转义：模型可能把正文当成块结束。

## R-006 提醒文案载体

**Decision**: 中文固定常量放在 `src/reminder.ts`，用现有 `reminder()` 包成 `<system-reminder>`。

**Rationale**: D-005 与 D-008 已确认；复用现有转义逻辑，新增文案只有一处。

**Alternatives Considered**:

- 配置项：宪章要求新增配置要有配置页支持，收益不足。
- 英文文案：与现有注入文本和用户语言不一致。

## R-007 测试与构建

**Decision**: 纯函数测试加 `agent/pre-step` 处理器测试；提交前运行 `pnpm format && pnpm check`；发布产物由 `pnpm build` 末尾的 dist 测试回归。

**Rationale**: 宪章 II 要求测试同步，IV 要求质量门禁。

**Alternatives Considered**:

- 只做真实宿主验收：无法在 CI 覆盖压缩后的补注。
