# Tasks: 调度提示词规定任务会话的置顶与归档

**Input**: Design documents from `/specs/060-dispatch-session-pin/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: 宪法原则 II 要求变更同步测试，包含测试任务。

**Organization**: 三个用户故事改同一份提示词文本，合并为一个实现阶段；阶段对应 commit。

## Phase 1: 规格与计划产物

**Goal**: Spec Kit 产物随分支落盘。

**Independent Test**: `specs/060-dispatch-session-pin/` 含 spec、plan、research、quickstart、tasks 与需求清单。

- [x] T001 [P] 写入 `specs/060-dispatch-session-pin/spec.md`、`plan.md`、`research.md`、`quickstart.md` 与 `tasks.md`
- [x] T002 写入 `specs/060-dispatch-session-pin/checklists/requirements.md` 并核对全部条目

**Checkpoint**: commit `docs(060): 补充调度会话置顶与归档规格`

## Phase 2: US1、US2、US3 — 提示词要求置顶与归档

**Goal**: 提示词规定派发与接管后置顶、任务结束后归档，`task_end` 描述删除冲突政策句。

**Independent Test**: `pnpm test:code` 通过；`SA_DISPATCH_PROMPT` 各节包含置顶与归档要求，且不再出现「结束任务不归档会话」。

- [x] T003 [US1] 在 `src/sa-dispatch/prompt.ts` 的 `## Start a task` 追加一步：`session_create` 成功后用 `session_pin` 置顶新会话
- [x] T004 [US2] 在 `src/sa-dispatch/prompt.ts` 的 `## Manage existing sessions` 追加 `session_manage` 后置顶，并把 `session_unmanage` 一句改为任务结束、会话与其置顶保留
- [x] T005 [US3] 在 `src/sa-dispatch/prompt.ts` 的 `## Decide when a task is done` 把「结束任务不归档会话」改为：结束任务后以 `session_archive` 加 `stop_activity: true` 归档会话，`completed` 与 `cancelled` 都归档
- [x] T006 [P] [US3] 在 `src/sa-dispatch/prompt.ts` 新增 `## Keep the session list current` 小节：再次置顶的条件、归档移除置顶、用户取消置顶后不补置顶、置顶或归档失败时说明并继续
- [x] T007 [US3] 在 `src/sa-dispatch/tools.ts` 删除 `task_end` 描述中的 `archive it separately when the user wants that`，保留会话保持未归档的行为事实
- [x] T008 [US1] [US2] [US3] 更新 `tests/sa-dispatch.test.ts`：小节顺序断言加入新小节；新增派发后置顶、接管后置顶、任务结束归档与取消管理保留置顶、失败说明的断言；替换 `It leaves the session unarchived` 断言；补 `task_end` 描述删句断言

**Checkpoint**: commit `fix(060): 调度提示词要求置顶任务会话并在任务结束时归档`

## Phase 3: 文档与质量门禁

**Goal**: 机制文档与变更加入 CHANGELOG，本地门禁通过。

**Independent Test**: `pnpm run full-check` 通过；`docs/how-it-works.md` 不再写「结束任务不归档会话」。

- [x] T009 [P] 在 `docs/how-it-works.md` 的调度提示词条目补充置顶要求，并把「结束任务不归档会话」改为任务结束后归档、取消管理不归档且保留置顶
- [x] T010 [P] 在 `CHANGELOG.md` 的 Unreleased 增加一条：调度提示词要求派发与接管任务后置顶会话，并在任务结束时归档会话
- [x] T011 运行 `pnpm format && pnpm check`，再运行 `pnpm run build` 完成产物测试

**Checkpoint**: commit `docs(060): 同步置顶与归档说明`

## Dependencies

- Phase 2 依赖 Phase 1 的规格产物。
- T003、T004、T005 与 T006 改同一文件，按顺序执行；T007 与测试 T008 依赖 T003 至 T006 的最终措辞。
- Phase 3 依赖 Phase 2；T009 与 T010 可并行。

## Parallel Execution Example

- T006 与 T007 可同时进行；T009 与 T010 可同时进行。

## Implementation Strategy

- 单次实现即可交付全部三个故事：提示词同时覆盖派发、接管与任务结束三个场景。
- Phase 3 只收尾文档与门禁，可以再做一次真实宿主验收。
