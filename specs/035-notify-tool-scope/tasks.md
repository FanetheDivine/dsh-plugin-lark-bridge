---
description: "任务列表：通知工具限定在桥接会话"
---

# Tasks: 通知工具限定在桥接会话

**Input**: Design documents from `specs/035-notify-tool-scope/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 单元测试是本次交付的验收依据（用户选择不做实机验证）。

**Organization**: 任务按用户故事分组，每个阶段一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不冲突
- **[Story]**: 对应用户故事
- 描述包含确切文件路径

## Phase 1: Setup

- [X] T001 在 worktree 运行 `pnpm i`，再运行 `pnpm run test:code -- tools plugin` 记录基线

---

## Phase 2: Foundational

**Purpose**: 测试替身能记录并求值注册选项

- [X] T002 修改 `tests/helpers.ts`：`tools.register` 记录第二个参数，增加 `_toolWhen(name, context)` 按 agent 求值条件

**Checkpoint**: 现有用例仍通过

---

## Phase 3: User Story 1 - 桥接会话照常回复飞书 (Priority: P1) 🎯 MVP

**Goal**: 桥接会话可见并可执行，发送行为不变。

**Independent Test**: 状态文件指向会话 A，以 A 求值条件为 true；执行工具仍调用 CLI。

### Tests for User Story 1

- [X] T003 [P] [US1] 在 `tests/plugin.test.ts` 增加用例：注册带 `when`，状态文件指向会话 A 时以 A 求值为 true
- [X] T004 [US1] 在 `tests/tools.test.ts` 增加用例：桥接 agent 执行时调用 CLI，参数与现有断言一致

### Implementation for User Story 1

- [X] T005 [US1] 修改 `src/tools.ts`：`buildNotifyTool` 依赖增加 `isBridgeAgent`，执行体先校验会话
- [X] T006 [US1] 修改 `src/index.ts`：`ctx.tools.register(notifyTool, { when })`，条件复用 `sessions.isBridgeSession(agent.session)`，异常按 false

**Checkpoint**: 桥接会话路径与现有发送行为一致（commit）

---

## Phase 4: User Story 2 - 其他会话不出现通知工具 (Priority: P1)

**Goal**: 非桥接会话既不可见也不可执行。

**Independent Test**: 以非桥接会话求值条件为 false；执行工具返回 `not-bridge-session` 且不调用 CLI。

### Tests for User Story 2

- [X] T007 [US2] 在 `tests/plugin.test.ts` 增加用例：状态文件为空时任意会话求值为 false
- [X] T008 [P] [US2] 在 `tests/tools.test.ts` 增加用例：非桥接 agent 与缺失 agent 均返回 `not-bridge-session`，CLI 零调用

**Checkpoint**: 非桥接会话完全不可见（commit）

---

## Phase 5: User Story 3 - 桥接会话更换后可见性跟随 (Priority: P2)

**Goal**: 条件按当前状态文件求值，跟随会话切换。

**Independent Test**: 状态文件从 A 改为 B 后，A 求值为 false、B 为 true。

- [X] T009 [US3] 在 `tests/plugin.test.ts` 增加用例：改写状态文件后重新求值两个会话

**Checkpoint**: 可见性跟随状态文件（commit）

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T010 [P] 更新 `README.md`：增加工具小节，说明 `lark_notify` 只在桥接会话可用
- [X] T011 [P] 更新 `docs/how-it-works.md#通知`：作用范围与判定来源
- [X] T012 [P] 在 `CHANGELOG.md` 增加 Unreleased 条目
- [X] T013 运行 `pnpm format && pnpm check && pnpm build`
- [X] T014 提交分支并推送，等待 CI

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 Setup
- **US1 (Phase 3)**: 依赖 Phase 2，产出生产代码
- **US2 (Phase 4)**: 依赖 US1 的条件与守卫
- **US3 (Phase 5)**: 依赖 US1 的条件
- **Polish (Phase 6)**: 依赖全部故事

### Parallel Opportunities

- T003 与 T004 可并行
- T007 与 T008 可并行
- T010、T011、T012 可并行

---

## Implementation Strategy

1. 完成 Phase 1-2，测试替身就绪。
2. 完成 US1，可见性与守卫落地（MVP）。
3. 完成 US2 与 US3 的不可见与切换断言。
4. 完成文档与门禁，提交推送。
5. 用户验收后合并，并发布 `0.1.6`。

## Notes

- 每个阶段一个 commit。
- 不做实机验证，验收以单元测试与构建为准。
- 提醒文案、工具参数与发送实现保持不变。
