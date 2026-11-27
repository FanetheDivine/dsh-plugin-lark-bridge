# Tasks: 被管理会话提问改为打断并注入 S 要求自行上报

**Input**: Design documents from `specs/074-ask-report-reminder/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章 II 要求测试同步，测试先行。

**Organization**: 按用户故事分阶段，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事

## Path Conventions

单插件布局：源码在 `src/`，测试在 `tests/`。

---

## Phase 1: Setup

**Purpose**: 干净基线

- [x] T001 在 worktree 运行 `pnpm install` 与 `pnpm check`，确认改动前全部通过

**Checkpoint**: 基线可复现。

---

## Phase 2: Foundational（阻塞全部用户故事）

**Purpose**: 守卫与文案的共享结构

- [ ] T002 [P] `tests/managed-ask-guard.test.ts`：改写拦截用例——deny 且不调用 `intercept`、`takeRules` 返回待注入批、重复参数去重、不同会话隔离、`takeFallback` 取走清空、`noteReported` 清空；确认失败
- [ ] T003 [P] `tests/managed-task-rules.test.ts`：`blockedQuestionsText` 与 `taskRulesMessage` 的正文断言（题面、表头、选项、多选标记、参数缺失兜底）；确认失败
- [ ] T004 `src/lark-super-agent/managed/ask-guard.ts`：删除 `intercept`/`intercepted`/`interceptCall`/`ASK_REPORTED_NOTICE`；`beforeExecute` 记入待注入内容并 deny；新增 `takeRules`、`takeFallback`、`noteReported`、`flattenQuestions`；更新 `ASK_BLOCKED_ERROR`
- [ ] T005 `src/lark-super-agent/managed/task-rules.ts`：`taskRulesMessage(blocked?)` 与 `blockedQuestionsText(questions)`；更新 `TASK_RULES_TEXT` 收尾要求（任务目的、当前状态、提问与选项）

**Checkpoint**: 守卫单测与文案单测通过。

---

## Phase 3: User Story 1 - 提问转成一次自足的上报（P1）

- [ ] T006 `tests/lark-super-agent-index.test.ts`：改写行接线用例——拒绝后下一步注入含提问的 S、插件不投 `sendReport`、不调用 `concludeTurn`；确认失败
- [ ] T007 `src/lark-super-agent/managed/index.ts`：删除 `intercept` 装配与 `markIntercepted` 调用，`agent/pre-step` 用 `takeRules` 构造 S
- [ ] T008 [P] `src/lark-super-agent/managed/report-tool.ts`：`buildSendReportTool` 增加可选 `onReport`
- [ ] T009 `src/lark-super-agent/managed/index.ts`：装配 `onReport`，`kind === 'question'` 时调用 `noteReported`

**Checkpoint**: 用户故事 1 的单测通过。

---

## Phase 4: User Story 1 补投兜底

- [ ] T010 `tests/lark-super-agent-index.test.ts`：轮次结束仍有待补投提问 → 补投一次 `origin=ask_intercept`、置 `waiting_user`、不再补 `turn_end`；任务不存在时不补投
- [ ] T011 `src/lark-super-agent/managed/index.ts`：`session/event` 的 `turn/end` 先 `takeFallback`，`markIntercepted` 后异步补投

**Checkpoint**: 补投分支单测通过。

---

## Phase 5: User Story 2 与 3 - 未管理会话、重复与并发（P2、P3）

- [ ] T012 [P] `tests/managed-ask-guard.test.ts`：未被管理会话保持原决策、无 S；并行批次多次拦截只保留一条 S 且合并内容
- [ ] T013 [P] `tests/lark-super-agent-index.test.ts`：调度会话与未被管理会话不注入 S

**Checkpoint**: P2、P3 单测通过。

---

## Phase 6: 文档与质量门禁

- [ ] T014 [P] `docs/how-it-works.md`：提问拦截、S 注入两行与相关段落改为现行行为
- [ ] T015 [P] `docs/known-risks.md`：新增「提问送达依赖模型遵循 S」风险
- [ ] T016 `CHANGELOG.md`：Unreleased 条目
- [ ] T017 运行 `pnpm format && pnpm check && pnpm build && pnpm test:dist`

**Checkpoint**: 全部门禁通过。
