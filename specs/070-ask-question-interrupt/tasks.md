# Tasks: 修复被管理会话提问被拦截后问题丢失或挂起

**Input**: Design documents from `specs/070-ask-question-interrupt/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章 II 要求测试同步；实机验证按 quickstart 执行。

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

**Purpose**: 拦截机制的共享类型与状态通道

- [x] T002 [P] `src/lark-super-agent/api.ts`：`ReportOrigin` 增加 `'ask_intercept'`（值与含义见 [data-model.md](./data-model.md)）
- [x] T003 [P] `src/lark-super-agent/managed/turn-report.ts`：新增 `markIntercepted(sessionId)`，把当前轮 `reported` 置真；无当前轮状态时为空操作

**Checkpoint**: origin 与去重通道可用。

---

## Phase 3: User Story 1 - 被管理会话的提问立刻转为上报 (P1)

**Independent Test**: quickstart 的实机场景 1 与守卫单测；断言工具体不运行、上报存档、状态 `waiting_user`、轮次同界结束、无网关挂起。

- [ ] T004 [US1] `src/lark-super-agent/managed/ask-guard.ts`：新增 `questionReportText(questions)` 按 [data-model.md](./data-model.md) 的正文格式生成上报文本（非数组/空数组回退固定说明句）
- [ ] T005 [US1] `src/lark-super-agent/managed/ask-guard.ts`：`AskGuardOptions` 增加 `intercept(sessionId, questions)`；`beforeExecute` 对被管理 ask 改为「cancel 旧等待 + 返回 allow」；`aroundExecute` 对被管理 ask 不调 `next()`：成功时记 `intercepted` 集合并 `exec.concludeTurn()` 后返回 `{isError:false, value:{answers:[]}}`，抛错时走 `requireRules` 并返回既有 `ASK_BLOCKED_ERROR` 错误结果；`afterExecute` 对 `intercepted` 命中的调用返回 `{kind:'accept', content:[上报说明文本]}`（文本常量 `ASK_REPORTED_NOTICE`）
- [ ] T006 [US1] `src/lark-super-agent/managed/index.ts`：装配 `intercept` 闭包——`service.sendReport({kind:'question', text:questionReportText(qs)}, sessionId, 'ask_intercept')` → 读 `managedTask`，仅 `in_progress` 时 `updateTask({taskId,status:'waiting_user'})` → `reporter.markIntercepted(sessionId)`
- [ ] T007 [US1] `tests/managed-ask-guard.test.ts`：被管理调用不进入工具体、`concludeTurn` 被调、结果为成功且 `content` 为上报说明、重复调用逐次上报、投递异常回退为拒绝反馈且 `takeRules` 为真、未管理会话直通
- [ ] T008 [US1] `tests/managed-turn-report.test.ts`：`markIntercepted` 后轮次结束不再补 `turn_end` 进度上报
- [ ] T009 [US1] `tests/lark-super-agent-index.test.ts`（或既有行装配测试文件）：行装配后 `send_report` 卡片链路不变，`origin=ask_intercept` 的块属性正确（`src/lark-super-agent/blocks.ts` 无需改动则只断言）

**Checkpoint**: US1 单测全绿。

---

## Phase 4: User Story 2 - 未被管理会话不受影响 (P2)

**Independent Test**: rdt 场景 2 对照；未管理调用进入宿主等待、无上报。

- [ ] T010 [US2] `tests/managed-ask-guard.test.ts`：补充未管理与调度会话调用路径的对照断言（`isManaged` 为假时 `next()` 照常执行、不记 `intercepted`、不排队 S）

**Checkpoint**: US2 断言全绿。

---

## Phase 5: User Story 3 - 上报失败退回拒绝 (P3)

**Independent Test**: 模拟 `intercept` 抛错的单测分支。

- [ ] T011 [US3] `tests/managed-ask-guard.test.ts`：`intercept` 抛错时结果为 `isError:true` 且文本为 `ASK_BLOCKED_ERROR`、`concludeTurn` 未被调用、`takeRules` 返回真

**Checkpoint**: US3 断言全绿。

---

## Phase 6: Polish & Cross-Cutting

- [ ] T012 [P] `docs/how-it-works.md`：「提问拦截」与「S 注入」两节改为拦截 + 代为上报 + 终止轮次的现状描述；`docs/known-risks.md`：补充依赖 `concludeTurn` 数据通道的宿主升级风险（保留既有网关私有接口条目）
- [ ] T013 [P] 核对 `README.md` 提问相关表述（`README.md:43` 已符合新行为），仅在偏离时微调
- [ ] T014 运行 `pnpm format && pnpm check`，重建 `dist/`
- [ ] T015 实机验证：rdt profile 重链本 worktree 后运行 `ask-repro.mjs`，断言 quickstart 场景 1（无网关挂起、上报存档、`waiting_user`、轮次同界结束）与场景 2（对照组仍等待）
- [ ] T016 恢复 rdt profile 插件链接到主工作区，清理 worktree 的临时探针构建产物；按分支规则补 CHANGELOG 条目

**Checkpoint**: 全部验证通过，可提 PR。

---

## Dependencies

- Phase 1 → Phase 2 → Phase 3 → (Phase 4, Phase 5 可并行于 Phase 3 完成后) → Phase 6
- T005 依赖 T002、T004；T006 依赖 T002、T003；T015 依赖 T014

## Parallel Rules

- 同阶段内标记 `[P]` 的任务在不同文件时可并行。
- 阶段之间保持串行，每阶段一个 commit。

## Implementation Strategy

MVP = Phase 1-3（US1 完整可用）；US2/US3 为边界与回退加固；Phase 6 交付收尾。
