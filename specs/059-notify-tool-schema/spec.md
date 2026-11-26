# Feature Specification: 修复 lark_notify 参数声明不是 JSON Schema

**Feature Branch**: `fix/059-notify-tool-schema`

**Created**: 2026-11-26

**Status**: Waived

**Change Category**: 插件变更

**Input**: User description: "dispatch 会话第一次收到飞书消息时没有调用 lark_notify；请求头里 lark_notify 的 parameters 是一个扁平对象，没有 properties 与 required。用 zod 写 schema，名称统一为单下划线。"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-001] Q: 参数声明用什么来源？ -> A: 用 zod 定义，再转成 JSON Schema 交给工具声明。
- [D-002] Q: 工具名用哪种下划线？ -> A: 统一为单下划线 `lark_notify`，与实际声明一致。
- [D-003] Q: 在场状态与调度提示词的渠道冲突是否本次处理？ -> A: 与本次缺陷无关，不处理。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 模型仍可能在名字不一致时选错工具；本次只消除参数声明缺失。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 桥接会话正确声明工具参数 (Priority: P1)

桥接会话的模型拿到 `lark_notify` 声明时，能看到 `text` 必填、`reply_to` 可选。

**Independent Test**: 注册工具后读工具声明，`parameters` 是 `type: object`，含 `properties.text`、`properties.reply_to` 与 `required: ['text']`。

**Acceptance Scenarios**:

1. **Given** 插件注册 `lark_notify`，**When** 读取工具声明，**Then** `parameters.type` 为 `object`，`parameters.properties` 含 `text` 与 `reply_to`。
2. **Given** 声明已修正，**When** 模型调用 `lark_notify` 并传 `text`，**Then** 发送行为与返回结构与现状一致。
3. **Given** 模型漏传 `text` 或传入空串，**When** 调用到达执行体，**Then** 返回 `invalid-text`，不发请求。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `lark_notify` 的 `parameters` MUST 由 zod schema 生成，输出 `type: object` 的 JSON Schema。
- **FR-002**: `text` MUST 声明为必填字符串，`reply_to` MUST 声明为可选字符串，两者保留原有说明文本。
- **FR-003**: 工具名 MUST 为 `lark_notify`，提示词、提醒与文档中的写法 MUST 与之相同。
- **FR-004**: 参数校验的失败码 MUST 保持 `invalid-args`、`invalid-text`、`invalid-reply-to`。

## Success Criteria *(mandatory)*

- **SC-001**: 单元测试断言 `parameters` 含 `type`、`properties.text`、`properties.reply_to` 与 `required`。
- **SC-002**: `pnpm check` 通过，`tests/tools.test.ts` 全绿。

## Assumptions

- 宿主把 `ToolSchema.parameters` 原样交给模型，不做二次包装。
- 在场状态与提示词渠道冲突不属于本次范围。
