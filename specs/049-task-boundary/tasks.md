---

description: "Task list for 049-task-boundary"
---

# Tasks: 任务边界与上报规则

**Input**: Design documents from `specs/049-task-boundary/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/send-report.md

**Tests**: 宪章要求代码变更同步测试，每个阶段都含测试任务。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: 确认基线

- [X] T001 运行 `pnpm install && pnpm check`，确认基线通过

---

## Phase 2: Foundational

**Purpose**: `send_report` 的 `kind`，US1 与 US3 共用

- [X] T002 在 `src/lark-super-agent/api.ts` 新增 `ReportKind` 与 `REPORT_KINDS`，取值 `progress`、`question`、`completed`、`abandoned`；`SendReportInput.kind` 必填
- [X] T003 在 `src/lark-super-agent/reports.ts` 的 `validateReportInput` 校验 `kind`，取值之外抛错；`reportMarkdown` 的 front matter 在 `taskId` 之后写 `kind`
- [X] T004 在 `src/lark-super-agent/blocks.ts` 的 `workSessionMessage` 增加 `kind` 属性，位于 `taskid` 之后并转义
- [X] T005 在 `src/lark-super-agent/service.ts` 的 `sendReport` 投递时传入 `kind`
- [X] T006 在 `src/sa-worker/tools.ts` 的 `send_report` 增加必填 `kind` 参数，`enum` 为四个取值，描述说明各取值含义
- [X] T007 [P] 更新 `tests/lark-super-agent-blocks.test.ts`：投递块含 `kind` 属性
- [X] T008 [P] 更新 `tests/lark-super-agent-reports.test.ts`：存档含 `kind`；缺少或非法 `kind` 时抛错且不写文件
- [X] T009 [P] 更新 `tests/lark-super-agent-service.test.ts`：投递块带 `kind`；非法 `kind` 不投递
- [X] T010 [P] 更新 `tests/sa-worker.test.ts`：`send_report` 透传 `kind`；schema 中 `kind` 必填且为四值枚举

---

## Phase 3: User Story 1 - 在电脑前时调度会话仍掌握任务进展 (Priority: P1)

**Goal**: 两种在场状态使用同一套上报规则

**Independent Test**: 提示词断言本机模式也要求上报四类内容

- [ ] T011 [US1] 改写 `src/sa-worker/prompt.ts`：新增两种模式共用的上报一节，按 `kind` 上报里程碑进度、需求变更、提问、完成与放弃；本机模式只说明另外在正文对话；结果与待决问题并存时上报 `question`
- [ ] T012 [US1] 更新 `tests/sa-worker.test.ts` 的提示词断言：本机模式不再含「not reported」；含四个 `kind` 取值

---

## Phase 4: User Story 2 - 独立任务互不串扰 (Priority: P1)

**Goal**: 默认新任务，首条要求只带本任务内容

**Independent Test**: 提示词断言归类规则与首条要求范围

- [ ] T013 [US2] 改写 `src/sa-dispatch/prompt.ts` 的「Classify each user message first」：默认新任务；只有引用未结束任务的消息或点名其标题或 id 才归入；无法判断先问；引用已结束任务时新建任务，只带被引原文与本次消息；一条消息含多条无关指令时拆分
- [ ] T014 [US2] 在 `src/sa-dispatch/prompt.ts` 的「Dispatch work」要求首条任务要求只含本任务的消息与目标工作区信息，不引用其他任务
- [ ] T015 [US2] 更新 `tests/sa-dispatch.test.ts` 的提示词断言

---

## Phase 5: User Story 3 - 任务按上报类型结束 (Priority: P1)

**Goal**: 只有 `completed` 与 `abandoned` 结束任务

**Independent Test**: 提示词断言 `kind` 到状态的映射

- [ ] T016 [US3] 改写 `src/sa-dispatch/prompt.ts` 的「Handle worker communication」与「Maintain the session list」：上报块示例带 `kind`；`progress` 设 `in_progress`，`question` 设 `waiting_user`，`completed` 与 `abandoned` 转达后设 `completed` 并归档会话；其他上报不结束任务；在电脑旁时在正文转达完整问题
- [ ] T017 [US3] 更新 `tests/sa-dispatch.test.ts` 的提示词断言

---

## Phase 6: Polish

- [ ] T018 [P] 更新 `docs/how-it-works.md`：`send_report` 的 `kind`、投递块属性、存档字段、两个预设的提示词规则
- [ ] T019 [P] 更新 `docs/known-risks.md`：归类与结束规则依赖模型遵守；旧调用缺 `kind` 时报错
- [ ] T020 [P] 更新 `README.md` 的「关于两个预设」：工作会话总会上报，只有完成或放弃结束任务
- [ ] T021 [P] 在 `CHANGELOG.md` 的 `## Unreleased` 增加条目
- [ ] T022 运行 `pnpm format && pnpm check` 与 `pnpm full-check`，全部通过
- [ ] T023 按 `real-device-test` 技能在隔离 profile 实机验证，报告写入 `specs/049-task-boundary/real-device-report.md`

---

## Dependencies

- Phase 2 完成后才能开始 Phase 3 至 Phase 5。
- Phase 4 与 Phase 5 改同一文件，按顺序执行。
- T018 至 T021 可与 Phase 3 至 Phase 5 并行。
- T023 依赖 T022 通过。

## Parallel Example

- Phase 2：T007 至 T010 在 T002 至 T006 完成后并行。
- Phase 6：T018 至 T021 并行。

## Implementation Strategy

每个阶段一个 commit。MVP 为 Phase 2 加 Phase 3：调度会话在两种状态下都收到带类型的上报。
