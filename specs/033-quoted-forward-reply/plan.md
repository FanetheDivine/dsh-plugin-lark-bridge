# Implementation Plan: 引用与聊天记录呈现、精确回复

**Branch**: `feat/033-quoted-forward-reply` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/033-quoted-forward-reply/spec.md`

**Status**: Waived

## Open Decisions

实现决策由 Agent 在用户「自行执行」授权下确定，全部记录在 `## Clarifications`。

- [x] [D-101] 新增模块划分 | A: 新增 `src/quote.ts`，`bridge.ts` 只负责编排 | Depends on: none | Status: answered
- [x] [D-102] 引用读取方式与超时 | A: `im +messages-mget --no-reactions`，user 失败再试 bot，单次 8 秒 | Depends on: none | Status: answered
- [x] [D-103] 渲染函数签名 | A: `formatLarkMessage(event, quote?)`，`handleEvent` 先读引用再格式化 | Depends on: none | Status: answered
- [x] [D-104] 聊天记录判定 | A: `message_type === 'merge_forward'` 时不使用正文，只输出 `<forwarded_messages/>` | Depends on: none | Status: answered
- [x] [D-105] 截断实现 | A: 复用 `splitText` 的单段截断语义，按 UTF-16 单元 500 截断并标「（已截断）」 | Depends on: none | Status: answered
- [x] [D-106] 转义 | A: 正文同时转义 `</quote>` 与 `</lark-message>` | Depends on: none | Status: answered
- [x] [D-107] 通知回复调用 | A: 首段 `im +messages-reply --message-id`，其余段沿用 `+messages-send` | Depends on: none | Status: answered
- [x] [D-108] `reply_to` 校验边界 | A: 只校验非空字符串，格式与可回复性交给飞书 API | Depends on: none | Status: answered
- [x] [D-109] 错误码 | A: 新增 `invalid-reply-to` 与 `reply-failed`，结构沿用 `{ok:false,error}` | Depends on: none | Status: answered
- [x] [D-110] 注入失败回滚 | A: 沿用 `store.forget(id)`，引用读取失败不算注入失败 | Depends on: none | Status: answered
- [x] [D-111] 测试划分 | A: 新增 `tests/quote.test.ts`，扩展 `bridge`、`tools`、`reminder` 测试 | Depends on: none | Status: answered
- [x] [D-112] 文档位置 | A: `docs/how-it-works.md` 消息与通知两节，`CHANGELOG.md` 的 `Unreleased` | Depends on: none | Status: answered
- [x] [D-113] 实机验证 | A: 用本机 lark-cli 手工验证一次引用回复与一次 `reply_to` 通知 | Depends on: none | Status: answered

## Clarifications

### Session 2026-11-21

- [D-101] Q: 新增模块还是扩展 `bridge.ts`？ -> A: 新增 `src/quote.ts`，读取与渲染集中在一个文件，`bridge.ts` 只做编排。
- [D-102] Q: 引用读取用哪个命令与超时？ -> A: `im +messages-mget --no-reactions`，user 身份优先、bot 兜底，单次 8 秒。
- [D-103] Q: 格式化函数怎么接收引用？ -> A: `formatLarkMessage(event, quote?)`，`handleEvent` 在去重后读取引用再注入。
- [D-104] Q: 聊天记录如何判定与输出？ -> A: `message_type === 'merge_forward'` 判定；输出 `<forwarded_messages message_id="om_…"/>`，不使用 lark-cli 渲染的正文。
- [D-105] Q: 引用正文如何截断？ -> A: 按 UTF-16 单元截到 500，截断时追加「（已截断）」。
- [D-106] Q: 转义覆盖哪些结束标记？ -> A: `</quote>` 与 `</lark-message>` 都要转义。
- [D-107] Q: 分段发送时如何调用？ -> A: 首段用 `im +messages-reply`，其余段用 `im +messages-send`，两段共享幂等键前缀。
- [D-108] Q: `reply_to` 校验到什么程度？ -> A: 只要求非空字符串。
- [D-109] Q: 失败返回什么错误码？ -> A: `invalid-reply-to` 与 `reply-failed`，沿用现有错误结构。
- [D-110] Q: 引用读取失败怎么算？ -> A: 不算注入失败，不调用 `forget`，降级后照常注入。
- [D-111] Q: 测试放哪里？ -> A: 新增 `tests/quote.test.ts`，并在 `bridge`、`tools`、`reminder` 测试中补场景。
- [D-112] Q: 文档写在哪？ -> A: `docs/how-it-works.md` 的消息与通知两节，`CHANGELOG.md` 的 `Unreleased`。
- [D-113] Q: 如何验证真实链路？ -> A: 本机 lark-cli 手工触发一次引用回复与一次带 `reply_to` 的通知。

## Review Record

- 2026-11-21 | Decision: Waived | Scope: current full document | Open items: none | Risks: 实现决策由 Agent 在「自行执行」授权下确定；README 不更新（用户要求）；引用渲染依赖 lark-cli 的 `mget` 输出字段

## Summary

飞书事件的注入块扩展两处：引用回复时内联被引消息为 `<quote>` 块，聊天记录消息只给 message_id；同时 `lark_notify` 增加可选 `reply_to`，并在桥接提醒中加入精确回复与读取规则。

技术路径：新增 `src/quote.ts` 负责读取与渲染被引消息；`bridge.ts` 在去重后读取引用并交给格式化；`tools.ts` 首段改走 `im +messages-reply`；`reminder.ts` 追加四条提醒。

## Technical Context

**Language/Version**: TypeScript，ESM，Node >= 24.9.0

**Primary Dependencies**: 本机 `lark-cli`（`im +messages-mget`、`im +messages-reply`、`im +messages-send`）；宿主 `@deepseek-ai/*` 保持 external，不新增依赖

**Storage**: 沿用 `state.json`，去重窗口与字段不变

**Testing**: vitest（`code` 与 `dist` 项目）、biome

**Target Platform**: DSH 宿主，Windows、macOS、Linux

**Project Type**: 单包插件

**Performance Goals**: 单条消息最多两次读取调用；引用读取总耗时不阻塞其他事件处理

**Constraints**: 一条事件只产生一条会话消息；单次读取 8 秒超时；引用正文最多 500 字符

**Scale/Scope**: 改动集中在 4 个源文件、1 个新增源文件与 4 个测试文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增 `@deepseek-ai/*` 依赖，`package.json` 不变 |
| II. 测试同步 | PASS | 新增 `tests/quote.test.ts`，扩展 `bridge`、`tools`、`reminder` 测试；实机验证列入 quickstart |
| III. 文档结构 | VIOLATION | README 归属用户可见行为，但用户决定不改 README；偏离记入 Complexity Tracking |
| IV. 质量门禁 | PASS | 每个阶段提交前运行 `pnpm format && pnpm check` |
| V. 公开引用 | PASS | 规格与计划只使用仓库内路径与公网 URL |

## Project Structure

### Documentation (this feature)

```text
specs/033-quoted-forward-reply/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── bridge.ts        # 事件编排：读取引用后注入
├── quote.ts         # 新增：被引消息读取与 <quote> 渲染
├── reminder.ts      # 追加提醒条目
├── tools.ts         # lark_notify 的 reply_to
└── constants.ts     # 引用长度与超时常量

tests/
├── quote.test.ts    # 新增
├── bridge.test.ts
├── tools.test.ts
└── reminder.test.ts

docs/how-it-works.md
CHANGELOG.md
```

**Structure Decision**: 沿用现有单包结构，新增一个源文件承载引用读取与渲染。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| README 不更新（用户要求） | 用户决定 README 只保留标题、徽章、一句简介与「前置」 | README 没有工具章节，新增参数说明会破坏用户要求的精简结构 |