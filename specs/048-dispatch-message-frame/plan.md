# Implementation Plan: 调度消息去掉 system-reminder 嵌套

**Branch**: `fix/048-dispatch-message-frame` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Status**: Waived

## Open Decisions

无。

## Clarifications

### Session 2026-11-25

- [P-001] Q: 剥离逻辑放在哪一层？ -> A: 放在 `src/sa-worker/dispatch-message.ts` 的 `wrapContent` 之前，按消息判断后替换内容块。包装是唯一读取该来源消息的地方，其他代码不感知 meta-tools 的帧。
- [P-002] Q: 如何判定「整段恰好是一个帧」？ -> A: 只有单个文本块，且 `trim()` 后以 `<system-reminder>\n` 开头、以 `\n</system-reminder>` 结尾，并且正文中不再出现 `<system-reminder>` 或 `</system-reminder>`。逐条排除后剥离，其余原样包装。
- [P-003] Q: 剥离后如何还原转义？ -> A: 正文内的 `<\/system-reminder>` 还原为 `</system-reminder>`，再交给现有 `</dispatch_session_message>` 转义。
- [P-004] Q: 文档与提示词是否改？ -> A: `SA_WORKER_PROMPT` 不改，识别依据仍是 `<dispatch_session_message>`。`docs/how-it-works.md` 补一句剥帧规则，`docs/known-risks.md` 补 meta-tools 帧格式依赖。
- [P-005] Q: 验证方式？ -> A: `tests/sa-worker.test.ts` 覆盖单层、多块、非完整帧、转义还原四条；`pnpm full-check`；实机按 `real-device-test` 技能在隔离 profile 验证工作会话收到的文本。

## Review Record

- 2026-11-25 | Decision: Waived | Scope: current full document | Open items: none | Risks: 用户要求自行实现并实机验证，跳过计划访谈

## Summary

`session_send` 的消息已经是 `<system-reminder>` 帧，本插件再包一层 `<dispatch_session_message>` 造成双层嵌套，且与 `session_create` 首条任务的格式不一致。改为包装前剥离整帧，只留正文。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`

**Primary Dependencies**: 宿主 `@deepseek-ai/*`；`dsh-plugin-meta-tools@0.1.7` 的 `session_send` 帧格式只作为输入约束，不改其代码

**Storage**: 不涉及

**Testing**: vitest `code`；实机测试

**Constraints**: 只改 `SA-工作会话` 的 `agent/pre-step` 包装；剥帧失败时退回原样包装，不丢消息

**Scale/Scope**: 一个源文件加测试与文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 无依赖变化，通过 |
| II. 测试同步 | 更新 `tests/sa-worker.test.ts`，并通过 `pnpm full-check`；实机验证，通过 |
| III. 文档结构 | 机制写 `docs/how-it-works.md`，风险写 `docs/known-risks.md`，变更写 `CHANGELOG.md`，通过 |
| IV. 质量门禁 | 改完运行 `pnpm format && pnpm check`，通过 |
| V. 公开引用 | 不新增本机绝对路径或仓库外引用，通过 |

## 设计

| 文件 | 变更 |
| --- | --- |
| `src/sa-worker/dispatch-message.ts` | 新增 `unwrapReminder`，`wrapContent` 前剥离整帧并还原转义 |
| `tests/sa-worker.test.ts` | 更新双层断言为单层，新增多条边界断言 |
| `docs/how-it-works.md` | 说明剥帧规则 |
| `docs/known-risks.md` | 补 meta-tools 帧格式依赖 |
| `CHANGELOG.md` | Unreleased 条目 |
| `specs/048-dispatch-message-frame/` | spec、plan、research、quickstart、tasks、实机报告 |

## 风险

- 依赖 meta-tools 0.1.7 的帧格式。上游改变格式后剥离失效，退回两层，消息仍可投递。
- 调度模型把飞书原文块贴进 `session_send` 时仍有内容级嵌套，本次不处理。
