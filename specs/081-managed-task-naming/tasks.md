---
description: "Task list for feature 081 接管会话的任务名基于会话标题生成"
---

# Tasks: 接管会话的任务名基于会话标题生成

**Input**: Design documents from `specs/081-managed-task-naming/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 必需。代码变更同步测试，见宪章 II。

**Organization**: 三个阶段，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[Story]**: 对应 spec 的用户故事（US1、US2、US3）
- 每项任务包含精确文件路径

## Path Conventions

单一库：`src/`、`tests/` 位于仓库根目录。

## Phase 1: 任务初始标题读取

**目标**: `manageSession` 从宿主 `sessionTitle` 服务读取会话标题，规范化后建任务。
**独立验证**: `tests/lark-super-agent-service.test.ts` 全绿。

- [x] T001 新增标题规范化辅助函数，`manageSession` 改用 `ctx.get('sessionTitle')` 的 `get(agent.session)`，删除 `agent.session.title` 读取，见 `src/lark-super-agent/service.ts`
- [x] T002 从 `SessionLike` 移除不存在的 `title` 字段，见 `src/lark-super-agent/api.ts`
- [x] T003 [P] [US1] 更新接管用例：注入 `sessionTitle.get` 模拟并断言任务初始标题等于会话标题，见 `tests/lark-super-agent-service.test.ts`
- [x] T004 [P] [US3] 新增换行折叠、空标题、空白标题与无 `sessionTitle` 服务的回退用例，见 `tests/lark-super-agent-service.test.ts`

## Phase 2: 提示词命名规则

**目标**: 调度提示词要求基于会话标题生成任务名，`session_manage` 描述同步。
**独立验证**: `tests/sa-dispatch.test.ts` 断言新规则。

- [x] T005 在 `## Manage existing sessions` 写明：`session_manage` 返回会话标题，基于它生成简短任务名并用 `task_update` 写入，命名与 `session_pin` 同一步；标题等于会话 id 时按用户描述命名或询问，见 `src/sa-dispatch/prompt.ts`
- [x] T006 `session_manage` 描述点明任务名取自会话标题，见 `src/sa-dispatch/tools.ts`
- [x] T007 [P] [US1] 断言提示词含基于标题生成任务名的规则与「不使用会话 id」的约束，见 `tests/sa-dispatch.test.ts`

## Phase 3: 文档与变更记录

**目标**: 机制文档与变更记录与行为一致。
**独立验证**: `docs/how-it-works.md` 与 `CHANGELOG.md` 描述与实现一致。

- [x] T008 在 `SA-调度会话` 小节补充接管任务的标题来源与命名规则，见 `docs/how-it-works.md`
- [x] T009 添加 Unreleased 条目，见 `CHANGELOG.md`

## Dependencies

- Phase 1：T001 → T002；T003、T004 依赖 T001。
- Phase 2 依赖 Phase 1：T005、T006、T007。
- Phase 3 依赖 Phase 1 与 Phase 2。
- 每个阶段完成并通过 `pnpm check` 后提交一次。
