# Implementation Plan: 被管理会话提问改为打断并注入 S 要求自行上报

**Branch**: `feat/074-ask-report-reminder` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/074-ask-report-reminder/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

决策编号沿用规格 D-001..D-006，实现层面的取舍见 [research.md](./research.md)。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 复用宿主 `tools/pre-execute` 拒绝与 `agent/pre-step` 注入通道，均为既有依赖；提问送达依赖模型遵循 S，缺口由轮次结束补投兜底

## Summary

被管理会话的 `ask_user_question` 改回「拒绝 + 注入 S」，并把提问内容搬进 S 与补投路径：

- `tools/pre-execute` 对被管理会话的提问返回 `deny`，反馈要求立刻调用 `send_report(kind=question)`；该次调用的题面与选项记入待注入内容。
- `tools/execute` 不再拦截工具体（拒绝已阻止执行），也不再终止轮次；`exec.concludeTurn()` 调用与 `ASK_REPORTED_NOTICE` 结果改写随 `intercept` 一起删除。
- `agent/pre-step` 注入的 S 末尾追加被拦截提问的题面与选项，要求在报告里写清任务目的、当前状态、提问与选项。
- 模型自己的 `send_report(kind=question)` 视为已送达，清空待补投集合。
- 轮次结束时仍有未上报的提问，插件补投一条 `origin=ask_intercept` 的 `question` 上报并置 `waiting_user`，同时抑制该轮 `turn_end` 进度上报。

## Technical Context

**Language/Version**: TypeScript（Node ≥ 22，ESM）

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5（与宿主同版本，宪章 I）

**Storage**: 不变——调度工作区 `message-task-status.json` 与 `reports/<taskId>/*.md`

**Testing**: vitest（`tests/helpers.ts` 模拟 ctx，宪章 II）；真实宿主编译产物由 `pnpm build` 与 `test:dist` 覆盖

**Target Platform**: DSH 宿主进程内

**Project Type**: 单包 DSH 插件

**Performance Goals**: 拦截在调用所在步内完成，无网络等待

**Constraints**: 工具体不运行、`user-questions/request` 不进入等待、轮次继续

**Key Dependencies**: `dsh-tools` 的 `tools/pre-execute` deny 通道（`pipeline.ts:214-226` 生成 `Error: <reason>` 错误结果）与 `dsh-agent` 的 `agent/pre-step` 注入；网关私有 `pendingRemoteEvents`/`cancelRemoteEvent`（既有依赖，不变）

## Constitution Check

| 条款 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增、不改动 `@deepseek-ai/*` 版本 |
| II. 测试同步 | 通过 | `managed-ask-guard.test.ts` 改拦截、S 合并、补投分支；`lark-super-agent-index.test.ts` 改行接线；`test:dist` 回归产物 |
| III. 文档结构 | 通过 | `docs/how-it-works.md` 提问拦截与 S 注入两行；`docs/known-risks.md` 新增提问送达风险；README 无对应描述需改 |
| IV. 质量门禁 | 通过 | 每阶段 `pnpm format && pnpm check`，收尾 `pnpm build` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与占位符 |

Complexity Tracking：无需偏离记录。

## Phase 0: Research

见 [research.md](./research.md)。要点：

1. `tools/pre-execute` 的 `deny` 生成 `Error: <reason>` 错误结果并回到模型，轮次继续（`dsh-tools/src/pipeline.ts:214-226`）；宿主 `ask` 审批不介入（`ask-guard.ts` 返回 `deny` 早于审批）。
2. 拒绝的调用不进入 `tools/execute`，工具体自然不运行。
3. S 的注入点在 `agent/pre-step`，是 070 之前同一问题唯一的既有通道（`managed/index.ts:143-155`）。
4. 补投时机取 `session/event` 的 `turn/end`，与 `TurnReporter` 同一事件；先取补投再观察轮次，使 `markIntercepted` 生效。
5. `sendReport` 在会话未被管理时抛 `NOT_MANAGED_ERROR`（`service.ts:690-691`），补投前用 `managedTask` 判定。

## Phase 1: Design

### 结构

- `managed/ask-guard.ts`
  - 删除 `intercept` 选项、`intercepted` 集合、`interceptCall`、`ASK_REPORTED_NOTICE`。
  - `beforeExecute`：被管理 ask 且他方未拒绝时，记入待注入内容并返回 `{kind:'deny', reason: ASK_BLOCKED_ERROR}`。
  - `aroundExecute`：只保留非被管理会话的可中止信号包装。
  - `afterExecute`：只保留插件中止调用的结果改写。
  - 新增 `takeRules(sessionId): readonly unknown[] | undefined`，返回待注入的提问批列表；`undefined` 表示无需 S。
  - 新增 `takeFallback(sessionId): readonly unknown[] | undefined`，取走待补投提问并清空。
  - 新增 `noteReported(sessionId)`，模型上报 `question` 后清空待补投提问。
  - 新增 `flattenQuestions(payloads)`：把多次调用的参数摊平为问题数组。
- `managed/task-rules.ts`
  - `taskRulesMessage(blocked?)`：正文 = `TASK_RULES_TEXT` + 被拦截提问段。
  - 新增 `blockedQuestionsText(questions)` 渲染题面与选项。
- `managed/index.ts`
  - 删除 `intercept` 装配与 `markIntercepted` 调用。
  - `agent/pre-step` 用 `takeRules` 的返回值构造 S。
  - `session/event` 在 `turn/end` 时先 `takeFallback`，有待补投则 `reporter.markIntercepted` 并异步补投。
  - `buildSendReportTool` 增加 `onReport` 回调，`kind === 'question'` 时调用 `askGuard.noteReported`。
- `managed/report-tool.ts`：新增可选 `onReport` 钩子。

### 状态与文案

`ASK_BLOCKED_ERROR`：说明本会话不能直接提问、用户没有收到这次提问、立刻用 `send_report` 的 `question` 上报任务目的与当前状态、提问本身与选项。

S 追加段：列出被拦截调用的每个问题与选项，要求原样保留提问。

补投正文沿用 `questionReportText`，`origin` 为 `ask_intercept`。

## Phase 2: Tasks 预览

见 [tasks.md](./tasks.md)：守卫与文案测试、行接线测试、实现、文档、质量门禁。
