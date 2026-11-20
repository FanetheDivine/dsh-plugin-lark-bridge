# Implementation Plan: 飞书消息块与回复提醒

**Branch**: `feat/029-lark-message-block` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/029-lark-message-block/spec.md`

**Status**: Approved

## Open Decisions

无。需求决策见 [spec.md](./spec.md) 的 `## Clarifications`，实现选择见 [research.md](./research.md)。

## Clarifications

### Session 2026-11-20

无待确认项。实现选择由研究结论与已批准的规格确定。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: 模型是否遵守提醒只能人工验收；压缩由宿主后端执行，插件只覆盖 pre-step 时机

## Summary

把注入的用户消息从 `<system-reminder>` 帧改成 `<lark-message message_id="…" time="…">` 块。新增一条中文说明性 `<system-reminder>`，说明飞书消息块是远程消息、用 `lark_notify` 回复、连续多条只回一次、少输出 text 块、其他消息正常回复。在 `agent/pre-step` 检查桥接会话表层，缺少提醒时把它插到消息块之前，使压缩后仍满足“表层至少一条”的不变量。

## Technical Context

**Language/Version**: TypeScript 6.0，Node.js ≥ 24.9，target es2024

**Primary Dependencies**: `@deepseek-ai/dsh-agent`、`dsh-session`、`dsh-llm`（0.2.2-rc.3）；不新增依赖

**Storage**: 现有 `state.json` 不变

**Testing**: vitest，`code` 与 `dist` 两个 project

**Target Platform**: DSH 插件（Node 宿主）

**Project Type**: 单包插件

**Performance Goals**: 每次 `agent/pre-step` 扫描一次表层节点；单桥接会话历史量级，无需额外索引

**Constraints**: 不改变消息过滤、去重、`lark_notify` 与配置页行为；提醒文案固定中文

**Scale/Scope**: 单用户私聊，单桥接会话

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级 `@deepseek-ai/*` 依赖 |
| II. 测试同步 | PASS | 新增 `tests/reminder.test.ts`，更新 `tests/bridge.test.ts` 与 `tests/sessions.test.ts`；dist 测试由 `pnpm build` 回归 |
| III. 文档结构 | PASS | `README.md` 与 `docs/how-it-works.md` 更新；规格只放需求 |
| IV. 质量门禁 | PASS | 提交前运行 `pnpm format && pnpm check` |
| V. 公开引用 | PASS | 新增文件只引用仓库内相对路径 |

## Project Structure

### Documentation (this feature)

```text
specs/029-lark-message-block/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md          # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── message.ts        # 新增：消息来源声明与消息构造
├── reminder.ts       # 新增：提醒文案、提醒消息与 pre-step 补注
├── bridge.ts         # 修改：格式化 <lark-message> 块
├── sessions.ts       # 修改：注入块消息，暴露会话判定
├── utils.ts          # 修改：时间格式与属性转义
├── index.ts          # 修改：注册 pre-step 补注
└── constants.ts      # 不变

tests/
├── reminder.test.ts  # 新增
├── bridge.test.ts    # 修改
└── sessions.test.ts  # 修改

docs/
└── how-it-works.md   # 修改
README.md             # 修改
```

**Structure Decision**: 沿用单包布局。新增两个模块，分别承担消息构造与提醒逻辑，避免 `sessions.ts` 同时负责持久化、注入与 pre-step 监听。

## Implementation Approach

### 1. 消息来源与构造（`src/message.ts`）

- 声明 `MessageSourceMap` 的 `'lark-bridge'` 键，字段为 `kind` 与可选 `reminder`。
- 导出 `LARK_SOURCE = { kind: 'lark-bridge' }` 与 `REMINDER_SOURCE = { kind: 'lark-bridge', reminder: true }`。
- 导出 `isLarkMessage(message)` 与 `isReminderMessage(message)`，按 `role` 与 `source` 判断。
- `src/sessions.ts` 删除本地 `declare module`，改为从这里导入。

### 2. 块格式化（`src/bridge.ts`、`src/utils.ts`）

- `formatFeishuReminder(event, senderName)` 改为 `formatLarkMessage(event)`，去掉发送者参数。
- 输出多行块，属性按 `message_id`、`time` 顺序，块内只有正文或类型占位。
- `utils.ts` 的 `formatTime` 改为输出 `YYYY-MM-DD HH:mm:ss`；新增 `escapeAttribute` 转义 `"` 与 `<`。
- 正文转义 `</lark-message>`。

### 3. 注入（`src/sessions.ts`）

- `inject(block: string)` 直接构造文本内容为块的用户消息，来源用 `LARK_SOURCE`，再 `agent.followup`。
- 删除 `reminderMessage` 与 `reminder()` 的调用。
- 新增 `isBridgeSession(session)`：读取状态，比较 `state.sessionId` 与 `session.id`。

### 4. 提醒与补注（`src/reminder.ts`）

- `BRIDGE_REMINDER` 保存提醒正文，`createReminderMessage()` 用 `reminder()` 包装并设置 `REMINDER_SOURCE`。
- `installReminderGuard({ ctx, sessions, logger })` 注册 `agent/pre-step`。
- 处理器流程：

```text
const decision = await next()
if (decision.kind === 'reject') return decision
if (decision.messages.length === 0) return decision
if (!(await sessions.isBridgeSession(agent.session))) return decision
if (surfaceHasReminder(session)) return decision
if (decision.messages.some(isReminderMessage)) return decision
const index = decision.messages.findIndex(isLarkMessage)
const messages = decision.messages.toSpliced(index === -1 ? 0 : index, 0, createReminderMessage())
return { ...decision, messages }
```

- `surfaceHasReminder(session)` 遍历 `session.surface.nodes`，用 `session.eventAt(seq)` 取 `user/message` 事件并检查来源。
- 补注失败只记录 `logger.warn`，不阻断本步。

### 5. 接线（`src/index.ts`）

- 构造 `SessionManager` 后调用 `installReminderGuard`，用 `ctx.effect` 释放监听。

### 6. 文档

- `README.md`：功能列表改为 `<lark-message>` 块与提醒。
- `docs/how-it-works.md`：更新“消息”与“会话”两节，补充压缩后补注。
- `docs/known-risks.md`：补充“提醒依赖模型遵守”和“旧会话不补提醒”。

## Reminder Text

提醒是固定中文常量，最终形态：

```text
<system-reminder>
<lark-message> 块是用户通过飞书远程发送的消息。
用户只能看到 lark_notify 发送的内容，看不到本会话的回复。
- 回复飞书消息时调用 lark_notify，把要发给用户的内容放进 text。
- 用户连续发来多条 <lark-message> 时只回复一次，用一次 lark_notify 覆盖全部内容。
- 会话里的 text 块用户看不到，尽量少输出，说明性文字也放进 lark_notify。
- 其他来源的用户消息按普通方式回复，不调用 lark_notify。
</system-reminder>
```

## Testing Strategy

| 层 | 覆盖 |
| --- | --- |
| `tests/bridge.test.ts` | 块属性、正文、空正文占位、`</lark-message>` 转义、时间格式 |
| `tests/reminder.test.ts` | 提醒文案含四条规则；补注位置；已有提醒不补；非桥接会话不补；`reject` 与空批次不补 |
| `tests/sessions.test.ts` | 注入内容只有块、来源为 `lark-bridge`；`isBridgeSession` 命中与未命中 |
| `tests/plugin.test.ts` | `apply` 注册 `agent/pre-step` 监听 |
| dist | `pnpm build` 末尾的 dist 测试回归打包产物 |

测试使用 `tests/helpers.ts` 的模拟 ctx；pre-step 处理器通过 `_onCallbacks` 取出后直接调用。

## Risks

- 模型是否遵守提醒只能人工验收（SC-005）。
- 压缩事件与 pre-step 的先后由宿主决定；补齐发生在这个请求之前，满足不变量。
- 旧版本会话不补提醒，发布说明需要写明。
