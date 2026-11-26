# Implementation Plan: 修复被管理会话提问被拦截后问题丢失或挂起

**Branch**: `fix/070-ask-question-interrupt` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/070-ask-question-interrupt/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

用户要求自行推进；实现决策按探索结论落定，编号沿用规格 D-001..D-005。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 依赖宿主 `concludeTurn`/`concludesTurn` 与网关私有取消接口；宿主升级需重跑实机验证。

## Summary

被管理会话调用 `ask_user_question` 时，把现有「执行前拒绝 + 提示模型改用 send_report」升级为「拦截 + 代为上报 + 置任务状态 + 终止轮次」：`tools/execute` 环绕钩子在工具体运行前接管该调用，插件按调用参数生成 `kind=question`、`origin=ask_intercept` 的上报投递到调度会话，任务 `in_progress → waiting_user`，并通过宿主的 `exec.concludeTurn()` + 成功结果的 `concludesTurn` 数据通道在当前步结束轮次。投递失败退回现有拒绝反馈与 S 注入。

## Technical Context

**Language/Version**: TypeScript（Node ≥ 22，ESM）

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5（宿主同版本，宪章 I）

**Storage**: 不变——调度工作区 `message-task-status.json` 与 `reports/<taskId>/*.md`（文件 + git 提交）

**Testing**: vitest（`tests/helpers.ts` 模拟 ctx；宪章 II）；实机验证走 `real-device-test` 环境（rdt profile）

**Target Platform**: DSH 宿主进程内（desktop/web 同一插件）

**Project Type**: 单包 DSH 插件

**Performance Goals**: 拦截在调用所在步内完成；上报含两次文件读写与一次 `agent.steer`，无网络等待

**Constraints**: 工具体不运行、`user-questions/request` 不进入等待；同批其他工具结果照常入账

**Key Dependencies**: `dsh-tools` 的 `tools/execute`/`tools/post-execute` waterfall、`ToolExecution.concludeTurn()`、`ToolExecutionSuccess.concludesTurn`；`dsh-api-gateway` 私有 `pendingRemoteEvents`/`cancelRemoteEvent`（既有依赖，不变）

## Constitution Check

| 条款 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增、不改动 `@deepseek-ai/*` 版本 |
| II. 测试同步 | 通过 | `managed-ask-guard.test.ts` 扩展拦截/回退/状态/重复上报用例；`lark-super-agent-*` 行接线用例；real-device 复跑 rdt 场景 1/2（宪章 II 的端到端要求） |
| III. 文档结构 | 通过 | `docs/how-it-works.md` 提问拦截一节、`docs/known-risks.md` 风险条目更新；README 行为描述已与新行为一致（`README.md:43`），仅在措辞偏离时微调；CHANGELOG 按分支规则在 push 时补条目 |
| IV. 质量门禁 | 通过 | 每阶段 `pnpm format && pnpm check` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与占位符 |

Complexity Tracking：无需偏离记录。

## Phase 0: Research

见 [research.md](./research.md)。要点：

1. 拦截点选在 `tools/execute` 环绕钩子：`tools/pre-execute` 的 deny 产生错误结果，错误结果不带 `concludesTurn`，无法结束轮次（`dsh-tools/src/pipeline.ts:214-226,567-573`）；`tools/execute` 环绕可跳过工具体、返回成功结果并先调 `exec.concludeTurn()`（`dsh-tool-executor-ptc/src/ptc.ts:626` 为同款用法）。
2. `pre-execute` 钩子保留，但对被管理会话返回 `allow`：避免其他插件的 `ask` 决策把调用拖进审批等待（现有行为即如此，`docs/how-it-works.md`）。
3. 成功结果经 `normalizeDispatchResult`→`createSuccessResult` 校验 `output.schema`：legacy 与 timed 两种 `ask_user_question` 的输出 schema 都接受 `{answers: []}`（`dsh-tool-ask-user/src/index.ts:77-98`、`timed.ts:154-192`）。
4. 模型可见文案经 `tools/post-execute` 的 `accept` 决策替换 `content` 实现；`value` 保持 schema 合法。
5. 轮次终止语义：「a tool result carrying `concludesTurn` ends the turn at its step」，同批其余结果照常入账（`dsh-agent/src/runtime-types.ts:408`）。
6. 自动上报去重：拦截成功后需把该轮标记为已上报，否则 `turn/end` 会再补一条 `turn_end` 进度上报（`managed/turn-report.ts:73-76,109-124`）。
7. 状态落账：`updateTask` 允许同状态提交（`notes.ts:270-274`），`failed → waiting_user` 非法，需先读任务状态判定。

## Phase 1: Design

数据模型与状态转移见 [data-model.md](./data-model.md)。验证入口见 [quickstart.md](./quickstart.md)。

### 结构

- `managed/ask-guard.ts`
  - `AskGuardOptions` 新增 `intercept: (sessionId: string, questions: unknown) => Promise<void>`（由行装配注入，组合 `send_report` 投递、状态落账与 `markIntercepted`）。
  - `questionReportText(questions)`：题面、表头、选项逐条成文（D-001）。
  - `beforeExecute`：被管理 ask → 结束等待 + 返回 `allow`（交给环绕钩子）。
  - `aroundExecute`：被管理 ask → 不调 `next()`；`intercept` 成功 → `exec.concludeTurn()` + 返回 `{isError:false, value:{answers:[]}}`；失败 → 记 S 标记并返回错误结果（回退语义，D-003）。
  - `afterExecute`：拦截成功的调用以 `accept` 替换 `content` 为「已代为上报」说明（D-004）；既有 aborted 改写保留。
- `managed/index.ts`：装配 `intercept` 闭包（`service.sendReport(kind=question, origin='ask_intercept')` → `managedTask` 判 `in_progress` → `updateTask(waiting_user)` → `reporter.markIntercepted(sessionId)`）。
- `api.ts`：`ReportOrigin` 增加 `'ask_intercept'`。
- `managed/turn-report.ts`：新增 `markIntercepted(sessionId)`（当前轮 `reported=true`）。

## Phase 2: Tasks 预览

见后续 `tasks.md`：测试先行（守卫单元 + 行接线）、实现、文档、`pnpm check`、实机复跑与收尾。
