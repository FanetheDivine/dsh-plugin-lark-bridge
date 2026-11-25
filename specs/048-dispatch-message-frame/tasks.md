---

description: "Task list for 048-dispatch-message-frame"
---

# Tasks: 调度消息去掉 system-reminder 嵌套

**Input**: Design documents from `specs/048-dispatch-message-frame/`

**Prerequisites**: plan.md、spec.md、research.md

**Tests**: 规格要求同步测试，每条用户故事都含测试任务。

## Format: `[ID] [P?] [Story] Description`

## Phase 1: Setup

**Purpose**: 确认基线

- [X] T001 运行 `pnpm install && pnpm check`，确认 `dist/` 对应当前代码

---

## Phase 2: Foundational

**Purpose**: 剥离逻辑，两条用户故事共用

- [X] T002 在 `src/sa-worker/dispatch-message.ts` 新增 `unwrapReminder`：单文本块且整段仅一个 `<system-reminder>` 帧时返回正文并还原 `<\/system-reminder>`，其余返回 undefined
- [X] T003 在 `src/sa-worker/dispatch-message.ts` 的 `wrapContent` 前调用 `unwrapReminder`，用剥离结果替换内容块

---

## Phase 3: User Story 1 - 工作会话收到单层调度消息 (Priority: P1)

**Goal**: `session_send` 与 `session_create` 的消息都是单层 `<dispatch_session_message>`

**Independent Test**: 构造帧消息，经 `wrapDispatchMessages` 后文本为单层

- [X] T004 [US1] 更新 `tests/sa-worker.test.ts` 的 `session_send` 用例：断言结果为 `<dispatch_session_message>\nPlease continue.\n</dispatch_session_message>`
- [X] T005 [US1] 在 `tests/sa-worker.test.ts` 新增用例：正文含 `<\/system-reminder>` 时还原为 `</system-reminder>`
- [X] T006 [US1] 在 `tests/sa-worker.test.ts` 新增用例：`session_create` 首条任务与帧消息产生相同的块结构

---

## Phase 4: User Story 2 - 其他消息不受影响 (Priority: P2)

**Goal**: 多块、非文本块与不完整帧原样包装

**Independent Test**: 分别传入这些消息，断言仍保留内层帧

- [X] T007 [US2] 在 `tests/sa-worker.test.ts` 新增用例：两个文本块的帧消息保留内层 `<system-reminder>`
- [X] T008 [US2] 在 `tests/sa-worker.test.ts` 新增用例：正文含 `<system-reminder>` 但整段不是单个帧时原样包装

---

## Phase 5: Polish

- [X] T009 [P] 更新 `docs/how-it-works.md` 的调度消息说明，补剥帧规则
- [X] T010 [P] 更新 `docs/known-risks.md`，补 meta-tools 帧格式依赖
- [X] T011 [P] 在 `CHANGELOG.md` 的 `## Unreleased` 增加条目
- [X] T012 运行 `pnpm format && pnpm check`，全部通过
- [X] T013 按 `real-device-test` 技能在隔离 profile 实机验证，报告写入 `specs/048-dispatch-message-frame/real-device-report.md`

---

## Dependencies

- Phase 2 完成后才能跑 T004 至 T008。
- T009 至 T011 可与代码并行。
- T013 依赖 T012 通过。

## Implementation Strategy

T002、T003 一起提交，测试随同。T013 的实机断言：工作会话请求中调度消息只有一层帧。
