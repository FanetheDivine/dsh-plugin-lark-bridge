# Tasks: 调度会话向用户提及任务时同时给出名称与 id

**Input**: Design documents from `/specs/062-dispatch-task-naming/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: 宪法原则 II 要求变更同步测试，包含测试任务。

**Organization**: 三个用户故事改同一组文本常量，合并为一个实现阶段；阶段对应 commit。

## Phase 1: 规格与计划产物

**Goal**: Spec Kit 产物随分支落盘。

**Independent Test**: `specs/062-dispatch-task-naming/` 含 spec、plan、research、quickstart、tasks 与需求清单。

- [x] T001 [P] 写入 `specs/062-dispatch-task-naming/spec.md`、`plan.md`、`research.md`、`quickstart.md` 与 `tasks.md`
- [x] T002 写入 `specs/062-dispatch-task-naming/checklists/requirements.md` 并核对全部条目

**Checkpoint**: commit `docs(062): 起草并澄清任务提及形式规格与计划`

## Phase 2: US1、US2、US3 — 提示词与桥接提醒规定「名称 (id)」形式

**Goal**: 调度会话对用户提及任务一律写成「名称 (id)」；旧裸 id 指令改写；桥接提醒加入同一要求。

**Independent Test**: `pnpm test:code` 通过；`SA_DISPATCH_PROMPT` 含全形式规则且不再出现 `Tell the user the task id and the workspace`；`BRIDGE_REMINDER` 含 `名称 (id)`。

^- [x] T003 [US1] [US2] [US3] 在 `src/sa-dispatch/prompt.ts` 的 `## Reply style` 末尾追加形式规则条目（按 research R-01 措辞）：`"<title> (<task id>)"`、每次提及用全形式、名称取不到时说明并给出 id
^- [x] T004 [US1] 在 `src/sa-dispatch/prompt.ts` 的 `## Start a task` 把末句 `Tell the user the task id and the workspace.` 改为 `Tell the user the workspace and the task as "<title> (<task id>)".`
^- [x] T005 [US2] 在 `src/reminder.ts` 的 `BRIDGE_REMINDER` 中「- 回复用户时引用用户的消息，以提高对应关系的准确性。」之后插入一行（按 research R-02 措辞）：`- 向用户提及任务时写成「名称 (id)」：名称取任务当前标题，id 取 task id；缺少名称时说明并给出 id。`
^- [x] T006 [US1] [US2] [US3] 更新 `tests/sa-dispatch.test.ts`：`## Reply style` 断言含 `"<title> (<task id>)"`、`Every mention uses this full form` 与兜底句；`## Start a task` 断言含 `the task as "<title> (<task id>)"` 且 `SA_DISPATCH_PROMPT` 不再含 `Tell the user the task id and the workspace`；小节顺序断言保持不变
^- [x] T007 [US2] 更新 `tests/reminder.test.ts`：`BRIDGE_REMINDER` 断言含 `名称 (id)`

**Checkpoint**: commit `fix(062): 调度提示词与桥接提醒规定任务提及形式`

## Phase 3: 文档与质量门禁

**Goal**: 机制文档与变更加入 CHANGELOG，本地门禁与产物通过。

**Independent Test**: `pnpm run full-check` 通过；`docs/how-it-works.md` 调度条目含「名称 (id)」。

- [ ] T008 [P] 在 `docs/how-it-works.md` 的调度提示词条目中，「回复只给结论、保持简短」条目之后新增 research R-04 给出的输出形式条目
- [ ] T009 [P] 在 `CHANGELOG.md` 的 Unreleased 增加一条：调度提示词与桥接提醒要求对用户提及任务时写成「名称 (id)」全形式；任务创建通知同步改用该形式
- [ ] T010 运行 `pnpm format && pnpm check`，再运行 `pnpm run build` 完成产物测试

**Checkpoint**: commit `docs(062): 同步任务提及形式说明`

## Dependencies

- Phase 2 依赖 Phase 1 的规格产物。
- T003、T004 改同一文件，按顺序执行；T006 依赖 T003 与 T004 的最终措辞。
- T005 独立于 T003、T004；T007 依赖 T005。
- Phase 3 依赖 Phase 2；T008 与 T009 可并行。

## Parallel Execution Example

- T003/T004 与 T005 可同时进行；T008 与 T009 可同时进行。

## Implementation Strategy

- 单次实现即可交付全部三个故事：一条全局形式规则同时覆盖创建通知、转述与状态场景。
- Phase 3 只收尾文档与门禁，可以再做一次真实宿主验收。
