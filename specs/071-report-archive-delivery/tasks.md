# Tasks: 上报先存档后投递、调度会话归档即重建与未读补投

**Input**: Design documents from `specs/071-report-archive-delivery/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 宪章 II 要求同步测试，每个阶段包含测试任务。

**Organization**: 每个阶段对应一个 commit；阶段内 `[P]` 可并行。

## Phase 1: Setup（共享类型与台账）

**Purpose**: 先落数据模型与结果契约，后续阶段共用。

- [X] T001 在 `src/lark-super-agent/api.ts` 给 `Task` 加 `deliveredReportIds: string[]`，改写 `SendReportResult` 为 `reportId?`、`taskId`、`reportPath?`、`delivered`、`reason?`、`warning?`
- [X] T002 在 `src/lark-super-agent/notes.ts` 的 `taskSchema` 加 `deliveredReportIds`，缺省空数组；`normalizeTask` 对缺失字段按 `reportIds` 初始化；`createTask` 写入空数组
- [X] T003 [P] 更新 `tests/lark-super-agent-notes.test.ts`：旧台账读取后 `deliveredReportIds` 等于 `reportIds`，新任务为空数组
- [X] T004 [P] 更新 `src/lark-super-agent/managed/index.ts` 与 `tests/lark-super-agent-index.test.ts` 中 `sendReport` mock 的结果字段，保持类型通过

**Commit**: `feat(071): 台账记录已投递报告`

---

## Phase 2: Foundational（存档先于投递与投递块）

**Purpose**: 存档与投递拆开，投递块支持未读报告与任务快照。

- [X] T005 改 `src/lark-super-agent/reports.ts`：提交后再调用投递回调，回调返回 `Promise<DeliveryOutcome>`，结果带 `delivery?`；提交失败只记 `warning`
- [X] T006 [P] 改 `src/lark-super-agent/blocks.ts`：`taskSessionMessage` 接受 `unreadReports` 与 `snapshot`，输出 `<unread_reports>`、`<task_snapshot>` 与 `<instructions>`
- [X] T007 [P] 更新 `tests/lark-super-agent-reports.test.ts`：投递在提交之后；投递失败不跳过提交；提交失败仍有 warning
- [X] T008 [P] 更新 `tests/lark-super-agent-blocks.test.ts`：未读段、快照段、转义与顺序

**Commit**: `feat(071): 存档提交后投递并携带未读报告`

---

## Phase 3: User Story 1 - 报告先存档与提交，再投递 (Priority: P1)

**Goal**: `sendReport` 先存档，投递失败保留存档并返回未送达。

**Independent Test**: 解析返回非 `session/not-found` 错误时，报告文件、附件、台账与提交都存在，结果 `delivered: false`。

- [X] T009 [US1] 改 `src/lark-super-agent/service.ts`：`sendReport` 顺序改为管理判定 → 无工作区判定 → 存档 → 等待投递；结果带 `reportPath` 与 `reason`
- [X] T010 [US1] 在 `src/lark-super-agent/service.ts` 新增按工作区投递链与 `DeliveryOutcome`，投递失败转 `delivery_failed`
- [X] T011 [US1] 改 `src/lark-super-agent/report-tool.ts` 输出 schema：`reportId`/`reportPath` 可选，`delivered` 布尔，补 `reason`
- [X] T012 [P] [US1] 更新 `tests/lark-super-agent-service.test.ts`：投递失败仍有文件与提交；成功结果含 `reportPath`；提交失败 warning
- [X] T013 [P] [US1] 更新 `tests/tool-schema.test.ts` 或 `tests/lark-super-agent-index.test.ts`：`delivered: false` 结果可被工具 schema 接受

**Commit**: `fix(071): 上报先存档提交再投递`

---

## Phase 4: User Story 2 - 调度会话归档等同于不存在 (Priority: P1)

**Goal**: 归档、缺失、`session/not-found` 都新建调度会话；飞书注入共用判定。

**Independent Test**: 归档会话后上报，出现新会话、桥接状态更新、结果 `delivered: true`。

- [X] T014 [US2] 改 `src/lark-super-agent/service.ts`：`dispatchTarget` 读 `archivedSessionIds`，缺失、归档、`session/not-found` 调 `ensureDispatchSession` 新建
- [X] T015 [US2] 改 `src/sessions.ts`：`ensure` 按工作区单飞，新增 `ensureDispatchSession(root)`
- [X] T016 [US2] 改 `src/index.ts` 提供 `larkBridgeSessions` 服务；改 `src/lark-super-agent/index.ts` 注入 `ensureDispatchSession`
- [X] T017 [P] [US2] 更新 `tests/lark-super-agent-service.test.ts`：归档后新建、缺失新建、其他解析错误未送达
- [X] T018 [P] [US2] 更新 `tests/sessions.test.ts`：归档会话被重建；并发 `ensure` 只创建一次

**Commit**: `fix(071): 调度会话归档或缺失时由上报路径重建`

---

## Phase 5: User Story 3 - 未读报告完整补投 (Priority: P1)

**Goal**: 每次投递列出全部未读报告；新建会话带快照；成功后标记已投递。

**Independent Test**: 两份未读报告存在时，投递块列出全部路径与先读说明，成功后 `deliveredReportIds` 含全部编号。

- [X] T019 [US3] 改 `src/lark-super-agent/service.ts`：汇总全部任务未读报告，投递成功后 `markReportsDelivered`
- [X] T020 [US3] 改 `src/lark-super-agent/notes.ts`：新增 `markReportsDelivered(entries)`，工作区队列内写台账并提交
- [X] T021 [US3] 改 `src/lark-super-agent/managed/task-log-injector.ts`：快照列未读报告与先读说明
- [X] T022 [US3] 改 `src/sa-dispatch/prompt.ts`：「Handle reports」与 `task_snapshot` 说明先读任务与全部未读报告
- [X] T023 [P] [US3] 更新 `tests/lark-super-agent-service.test.ts`：未读汇总、标记、新建会话快照、标记失败 warning
- [X] T024 [P] [US3] 更新 `tests/managed-task-log.test.ts`：快照未读段与插入顺序

**Commit**: `feat(071): 投递补齐全部未读报告并标记已读`

---

## Phase 6: User Story 4/5 - 并发、重试与无工作区 (Priority: P1/P2)

**Goal**: 并发下顺序、单会话与去重成立；无工作区忽略报告。

**Independent Test**: 三份报告并发且会话缺失时只建一个会话，顺序投递；无工作区不存档。

- [X] T025 [US4] 改 `src/lark-super-agent/service.ts`：投递前复核归档状态，失败重建后重试一次
- [X] T026 [US4] 改 `src/lark-super-agent/managed/index.ts`：提问拦截在 `delivered: false` 时抛错回退，只在送达后置状态与标记
- [X] T027 [US4] 改 `src/lark-super-agent/managed/turn-report.ts`：未送达只记日志
- [X] T028 [US5] 改 `src/lark-super-agent/service.ts`：无工作区返回 `no_workspace`，不存档不建会话
- [X] T029 [P] [US4] 新增并发用例到 `tests/lark-super-agent-service.test.ts`：投递顺序、单飞创建、重试
- [X] T030 [P] [US4] 更新 `tests/managed-turn-report.test.ts` 与 `tests/lark-super-agent-index.test.ts`：未送达日志与拦截回退
- [X] T031 [P] [US5] 新增无工作区用例到 `tests/lark-super-agent-service.test.ts`

**Commit**: `fix(071): 上报投递并发与无工作区处理`

---

## Phase 7: Polish（文档、实机验证与门禁）

- [X] T032 更新 `docs/how-it-works.md`：上报顺序、归档重建、未读补投、任务快照
- [X] T033 更新 `README.md` 与 `docs/known-risks.md`：用户可见行为与至少一次投递风险
- [X] T034 运行隔离 profile 实机验证，覆盖归档重建、不存在新建、未读补投、无工作区、正常投递、并发
- [X] T035 运行 `pnpm format && pnpm full-check`，补 CHANGELOG 条目
- [X] T036 推送分支、创建 PR、等待 CI 与合并、清理 worktree

**Commit**: `docs(071): 说明上报存档顺序与未读补投`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7。
- `T005` 与 `T006` 可以并行；`T007`、`T008` 跟随实现。
- `T014` 依赖 `T009`；`T019` 依赖 `T014`；`T025` 依赖 `T019`。
- `T032`、`T033` 依赖全部实现完成。

## Implementation Strategy

1. 先完成 Phase 1 与 Phase 2，得到可测试的存档顺序与投递块。
2. Phase 3 打通最小可用链路：存档、提交、投递结果。
3. Phase 4 补调度会话重建，Phase 5 补未读与提示词。
4. Phase 6 收并发与回退，Phase 7 做实机与门禁。