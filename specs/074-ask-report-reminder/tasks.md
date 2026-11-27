# Tasks: 被管理会话提问直接返回上报指令 S

**Input**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)、[data-model.md](./data-model.md)

**Tests**: 依宪章同步测试。每阶段对应一个提交。

## Phase 1: 工具结果与上报链路

- [x] T001 [US1] 在 `src/lark-super-agent/managed/ask-guard.ts` 和 `task-rules.ts` 接管工具调用，返回固定 S 与 `{ answers: [] }`。S 要求用 `send_report(kind=question)` 上报任务目的、当前进展、问题与选项。
- [x] T002 [US1] 从 `src/lark-super-agent/managed/index.ts`、`report-tool.ts` 与 `turn-report.ts` 移除问题记录接线、补发与拦截状态写入。`src/lark-super-agent/api.ts` 保留历史报告来源。
- [x] T003 [US2] 在 `src/lark-super-agent/managed/ask-guard.ts` 保留宿主拒绝与取消决策，以及已在等待的提问取消后的一次 S 提醒。`src/lark-super-agent/service.ts` 将未配置调度工作区的会话视为未管理。
- [x] T004 [US1] 通过 `tests/lark-super-agent-index.test.ts` 验证宿主管线返回正文、原问题不重复、新提问不排队 S、结束轮次不补发及 `send_report` 投递结果。
- [x] T005 [US2] 通过 `tests/managed-ask-guard.test.ts` 和 `tests/lark-super-agent-service.test.ts` 验证并发调用的结果隔离、提问透传与取消既有等待。

## Phase 2: 文档与验证

- [x] T006 同步 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md`、`docs/development.md` 和 `CHANGELOG.md`。
- [x] T007 执行 `pnpm format`、`pnpm check` 与 `pnpm build`。在 [quickstart.md](./quickstart.md) 记录结果与宿主手工验收状态。

本阶段不发版，PR 暂缓。
