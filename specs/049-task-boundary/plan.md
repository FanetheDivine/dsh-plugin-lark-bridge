# Implementation Plan: 任务边界与上报规则

**Branch**: `fix/049-task-boundary` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Status**: Waived

## Open Decisions

无。

## Clarifications

### Session 2026-11-25

- [P-001] Q: `kind` 的类型放在哪里？ -> A: `src/lark-super-agent/api.ts` 新增 `ReportKind` 与 `REPORT_KINDS`，`SendReportInput.kind` 必填。服务和两个预设子行共用这份类型。
- [P-002] Q: 非法 `kind` 在哪一层拒绝？ -> A: 工具 schema 用 `enum` 加 `required` 拒绝；`validateReportInput` 再校验一次，服务被直接调用时同样拒绝。校验在存档与投递之前。
- [P-003] Q: `kind` 如何出现在投递块与存档里？ -> A: `<work_session_message>` 增加属性 `kind="…"`，放在 `taskid` 之后；上报 Markdown 的 front matter 增加 `kind` 行。见 [contracts/send-report.md](./contracts/send-report.md)。
- [P-004] Q: 工具返回值是否变化？ -> A: 不变，`kind` 只进投递块与存档。
- [P-005] Q: 提示词如何组织？ -> A: 工作会话提示词合并为「Report every task change」一节，两种模式共用；模式一节只讲正文是否对用户可见。调度会话提示词改写「Classify each user message first」与「Handle worker communication」，加入 `kind` 到状态的映射。
- [P-006] Q: 验证方式？ -> A: 更新 blocks、reports、service、sa-worker、sa-dispatch 五个测试文件；`pnpm full-check`；实机按 `real-device-test` 技能验证 `send_report` 的 `kind` 投递。

## Review Record

- 2026-11-25 | Decision: Waived | Scope: current full document | Open items: none | Risks: 用户要求规格通过后自行实现，跳过计划访谈与审查

## Summary

`send_report` 增加必填 `kind`，投递块与存档带上该值。工作会话在两种在场状态下用同一套上报规则。调度会话默认把每条消息归为新任务，只在 `completed` 或 `abandoned` 上报时结束任务。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`

**Primary Dependencies**: 宿主 `@deepseek-ai/*`，`@deepseek-ai/dsh-tools` 的 `defineTool`

**Storage**: 调度工作区 `reports/<taskId>/<reportId>.md` 的 front matter 增加 `kind`

**Testing**: vitest `code`；实机测试

**Constraints**: 服务不按 `kind` 改任务状态；任务状态取值不变

**Scale/Scope**: 4 个源文件、2 段提示词、5 个测试文件与文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 无依赖变化，通过 |
| II. 测试同步 | 更新 5 个测试文件，`pnpm full-check`，实机验证，通过 |
| III. 文档结构 | 机制写 `docs/how-it-works.md`，风险写 `docs/known-risks.md`，用户可见的上报规则写 `README.md`，变更写 `CHANGELOG.md`，通过 |
| IV. 质量门禁 | 改完运行 `pnpm format && pnpm check`，通过 |
| V. 公开引用 | 不新增本机绝对路径或仓库外引用，通过 |

设计后复核：结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/049-task-boundary/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/send-report.md
└── tasks.md
```

### Source Code

| 文件 | 变更 |
| --- | --- |
| `src/lark-super-agent/api.ts` | 新增 `ReportKind`、`REPORT_KINDS`，`SendReportInput.kind` |
| `src/lark-super-agent/reports.ts` | 校验 `kind`，front matter 写入 `kind` |
| `src/lark-super-agent/blocks.ts` | `<work_session_message>` 增加 `kind` 属性 |
| `src/lark-super-agent/service.ts` | 投递时传入 `kind` |
| `src/sa-worker/tools.ts` | `send_report` 增加必填 `kind` 参数 |
| `src/sa-worker/prompt.ts` | 统一上报规则 |
| `src/sa-dispatch/prompt.ts` | 归类规则、首条要求范围、`kind` 到状态的映射 |
| `tests/` | blocks、reports、service、sa-worker、sa-dispatch |
| `README.md`、`docs/how-it-works.md`、`docs/known-risks.md`、`CHANGELOG.md` | 同步 |

**Structure Decision**: 沿用现有目录，不新增模块。

## 风险

- 归类与结束规则靠提示词执行，需要实机验收。
- 已运行的工作会话在下一步拿到新工具声明；旧调用缺 `kind` 时报参数错误，模型需重试。
