---

description: "Task list for simplifying README last two sections"
---

# Tasks: 精简 README 最后两节

**Input**: Design documents from `/specs/055-simplify-readme-sections/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, quickstart.md

**Tests**: 纯文档精简变更，不新增测试文件，通过 `pnpm format && pnpm check` 验证质量门禁。

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: User Story 1 & User Story 2 - 精简 README 最后两节与质量校验 (Priority: P1) 🎯 MVP

**Goal**: 精简 `README.md` 的「关于调度会话」与「在场状态」两节，只保留核心用法、不在电脑旁时的飞书交互与配置说明，并通过质量门禁。

**Independent Test**: 阅读 `README.md` 最后两节核对验收条件，并运行 `pnpm format && pnpm check`。

- [x] T001 [US1] 精简 `README.md` 的「关于调度会话」一节，保留默认预设说明、新建或接管任务会话、配置页设置任务模型与预设三项内容，移除 `session_create`、`task_type` 等工具与参数名及轮次自动上报与归档细节
- [x] T002 [US2] 精简 `README.md` 的「在场状态」一节，说明在电脑旁与离开时的飞书交互（离开时调度会话经飞书联系用户，被管理会话的提问与进度经调度会话发到飞书，飞书回复即可继续），并保留侧栏图标点击切换、按网页/飞书输入自动切换、定时切换（支持跳过周末和节假日）三项内容，移除图标颜色/悬停、初始态、时间选择器操作、单次触发与节假日缓存细节
- [x] T003 运行 `pnpm format && pnpm check` 并校验 `specs/055-simplify-readme-sections/quickstart.md`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: T001 → T002 → T003（修改同一文件 `README.md` 并执行门禁校验）
