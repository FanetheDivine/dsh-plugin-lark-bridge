---
description: "任务列表：任务会话消息不含会话元信息"
---

# Tasks: 任务会话消息不含会话元信息

**Input**: Design documents from `specs/076-task-message-metadata/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**Tests**: spec FR-009 要求测试断言，包含测试任务。

**Organization**: 按用户故事分组；全部故事共享同一提示词常量与测试文件，故事任务顺序执行。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无依赖）
- **[Story]**: 所属用户故事（US1–US5）
- 描述含确切文件路径

## Phase 1: Setup

**Purpose**: worktree 与依赖已就绪，无初始化任务。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 提示词文案是所有故事的共同落点。

- [X] T001 按 plan.md「设计」修改 `SA_DISPATCH_PROMPT` 三处：「Start a task」的 session_create 句只留任务请求；「Add messages to a task」新增两条总约束；「Change a session's model」补「Send the task session nothing about the switch.」 src/sa-dispatch/prompt.ts

---

## Phase 3: User Story 1 - 首个任务消息只写任务内容 (Priority: P1)

**Goal**: 首条 prompt 不含工作区与模型元信息。

**Independent Test**: 新用例断言 Start a task 文案与全文不含 `its target workspace`。

- [X] T002 [US1] 新增用例「提示词禁止向任务会话暴露会话元信息」：断言 `section('Start a task')` 含 `The prompt holds only this task's request`，`SA_DISPATCH_PROMPT` 不含 `its target workspace` tests/sa-dispatch.test.ts

---

## Phase 4: User Story 2 - 补充指令与回答只写指令本身 (Priority: P1)

**Goal**: 投递与记录文字同口径，用户原话照转。

**Independent Test**: 用例断言 Add messages to a task 的总约束文字。

- [X] T003 [US2] 扩展用例：断言 `section('Add messages to a task')` 含 `Leave session metadata out`、`task_update add_message alike`、`user's own words pass through as they are`、`model route`、`working directory`、`session id`、`[model changed: ...]` tests/sa-dispatch.test.ts

---

## Phase 5: User Story 3 - 失败后的重试消息不解释失败原因 (Priority: P2)

**Goal**: 元信息清单含上一轮失败原因。

**Independent Test**: 用例断言失败原因项。

- [X] T004 [US3] 扩展用例：断言 `section('Add messages to a task')` 含 `the previous turn's failure and its cause` tests/sa-dispatch.test.ts

---

## Phase 6: User Story 4 - 切换模型只改路由并告知用户 (Priority: P2)

**Goal**: 模型切换不通知任务会话。

**Independent Test**: 用例断言模型小节补句。

- [X] T005 [US4] 扩展用例：断言 `section("Change a session's model")` 含 `Send the task session nothing about the switch` tests/sa-dispatch.test.ts

---

## Phase 7: User Story 5 - 重发请求只写要报告的内容 (Priority: P3)

**Goal**: 重发请求既有约束保持。

**Independent Test**: 运行测试，重发请求与小节顺序断言通过。

- [X] T006 [US5] 运行 `pnpm test:code`，确认「提示词按顺序包含全部小节」与重发请求相关既有断言通过 tests/sa-dispatch.test.ts

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T007 [P] 在调度提示词段落「发往任务会话的消息只有两类」一条后加元信息约束一条（含宿主事实来源、用户原话照转、任务所需路径照常） docs/how-it-works.md
- [X] T008 [P] 「被管理会话与调度消息」加残余风险一条：元信息约束靠调度模型遵守提示词，插件不做运行期文字过滤 docs/known-risks.md
- [X] T009 运行 `pnpm format && pnpm check`，修正发现的问题

---

## Dependencies

- T001 阻塞 T002–T006。
- T002–T005 同文件顺序执行；T006 在 T005 后。
- T007、T008 仅依赖 T001，可与 T002–T006 并行。
- T009 最后。
- 每个 Phase 对应一个 commit（implement 阶段执行）。

## Implementation Strategy

- MVP：T001 + T002（US1）。
- 增量：US2–US5 逐步扩展断言；Polish 补文档与门禁。