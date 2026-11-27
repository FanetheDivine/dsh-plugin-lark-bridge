---
description: "Task list for feature 080 加入管理时自动上报会话最后文本"
---

# Tasks: 加入管理时自动上报会话最后文本

**Input**: Design documents from `specs/080-session-manage-auto-report/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 必需。代码变更同步测试，见宪章 II。

**Organization**: 三个阶段，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[Story]**: 对应 spec 的用户故事（US1、US2、US3、US4）
- 每项任务包含精确文件路径

## Path Conventions

单一库：`src/`、`tests/` 位于仓库根目录。

## Phase 1: 核心补发能力（阻塞后续阶段）

**目标**: `TurnReporter` 保留最后轮次，提供 `catchUp`，并与轮次结束上报串行、去重。
**独立验证**: `tests/managed-turn-report.test.ts` 全绿；不依赖服务接线。

- [x] T001 [P] 扩展轮次状态结构：保留 `settled`、`reason`、`reportedTaskId`，`turn/end` 后不再删除状态，下一次 `turn/start` 覆盖，见 `src/lark-super-agent/managed/turn-report.ts`
- [x] T002 增加每会话 Promise 队列，`finish` 与 `catchUp` 排入同一队列，链尾完成后清理键，见 `src/lark-super-agent/managed/turn-report.ts`
- [x] T003 实现 `catchUp(sessionId, taskId)`：依次检查保留状态、`settled`、`reason === 'completed'`、`!reported`、文本非空白、无运行中子代理、`reportedTaskId !== taskId`，通过后调用 `sendReport({ kind: 'progress', text }, sessionId, 'turn_end')` 并记下任务标识，见 `src/lark-super-agent/managed/turn-report.ts`
- [x] T004 [P] [US1] 补发成功、文本空白、异常结束、本轮已 `send_report`、运行中子代理、未结束轮次的测试，见 `tests/managed-turn-report.test.ts`
- [x] T005 [P] [US2] 并发与再次管理测试：轮次结束先排队时接管不重复投递；同一文本在取消管理后再次管理时对新任务再投递一次，见 `tests/managed-turn-report.test.ts`

## Phase 2: 接管接线（依赖 Phase 1）

**目标**: `session_manage` 建立任务后调用补发，失败不影响接管结果。
**独立验证**: `tests/lark-super-agent-service.test.ts` 与 `tests/sa-dispatch.test.ts` 全绿。

- [x] T006 在 `LarkSuperAgentService` 增加补发回调的设置项与字段，见 `src/lark-super-agent/api.ts`
- [x] T007 `manageSession` 在 `createTask` 之后 `await` 补发并吞掉异常；`createTask` 用于 `session_create` 的路径不触发补发，见 `src/lark-super-agent/service.ts`
- [x] T008 装配时把 `TurnReporter.catchUp` 注册给服务，见 `src/lark-super-agent/managed/index.ts`
- [x] T009 [P] [US1] `manageSession` 触发补发、投递失败仍成功的测试，见 `tests/lark-super-agent-service.test.ts`
- [x] T010 [P] [US3] 无助手文本的会话接管不产生上报、工具结果不变的测试，见 `tests/lark-super-agent-service.test.ts`

## Phase 3: 文档与变更记录（依赖 Phase 1、2）

**目标**: 机制文档与变更记录与行为一致。
**独立验证**: `docs/how-it-works.md` 与 `CHANGELOG.md` 描述与实现一致。

- [x] T011 更新「被管理会话能力」表与「上报投递与失败监听」：接管时补发最后轮次文本、与轮次结束串行去重、再次管理重发，见 `docs/how-it-works.md`
- [x] T012 添加分支变更条目，见 `CHANGELOG.md`

## Dependencies

- Phase 1 内部：T001 → T002 → T003；T004、T005 依赖 T003。
- Phase 2 依赖 Phase 1：T006 → T007、T008；T009、T010 依赖 T007。
- Phase 3 依赖 Phase 1 与 Phase 2。
- 每个阶段完成并通过 `pnpm check` 后提交一次。

## Parallel Execution Examples

- Phase 1：T001 完成后，T004 与 T005 可并行编写。
- Phase 2：T009 与 T010 可并行编写；T006、T007、T008 按顺序修改三个文件。
- Phase 3：T011 与 T012 可并行。

## Implementation Strategy

MVP 为 Phase 1 + Phase 2：接管后补发一次，且与轮次结束不重复。Phase 3 随同一 PR 交付。

## Independent Test Criteria

- **US1**：未管理会话完成一轮后 `manageSession`，`sendReport` 以 `turn_end` 来源调用一次，正文等于最后文本。
- **US2**：制造并发交错后同一轮文本只投递一次；再次管理对新任务再投递。
- **US3**：无文本、空白、异常结束、已上报、运行中场景都不投递，接管成功。
- **US4**：`sendReport` 抛错或未送达时接管成功且只记日志。