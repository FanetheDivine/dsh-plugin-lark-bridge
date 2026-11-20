---

description: "任务列表：修复桥接会话创建请求"

---

# Tasks: 修复桥接会话创建请求

**Input**: Design documents from `specs/034-session-create-request/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 单元测试是本次修复的验收依据（用户豁免实机验证）。

**Organization**: 任务按用户故事分组，每个阶段一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不冲突
- **[Story]**: 对应用户故事
- 描述包含确切文件路径

## Phase 1: Setup

- [X] T001 运行 `pnpm i` 与 `pnpm run test:code -- sessions`，记录基线结果（27 文件 / 328 用例通过）

---

## Phase 2: Foundational

**Purpose**: 类型与生产代码先对齐宿主契约

- [X] T002 收缩 `src/sessions.ts` 的 `SessionController.create` 请求类型为 `{ workspaceId: string; agentPreset?: string }`
- [X] T003 修改 `src/sessions.ts` 的 `create`：只传 `workspaceId` 与可选 `agentPreset`，用返回的 `sessionId`；回退分支自行生成标识

**Checkpoint**: 类型层不再允许 `cwd` 与 `sessionId`（commit `2b3bdcb`）

---

## Phase 3: User Story 1 - 归档旧会话后收到消息能新建会话 (Priority: P1) 🎯 MVP

**Goal**: 新会话可以创建，消息可以注入。

**Independent Test**: 状态文件指向已归档会话时注入一条消息，断言创建会话、标题、挂载、置顶与状态写入。

### Tests for User Story 1

- [X] T004 [P] [US1] 更新 `tests/sessions.test.ts` 的模拟控制器，按新形状记录请求，`meta.cwd` 取自 setup 的 `cwd`
- [X] T005 [US1] 在 `tests/sessions.test.ts` 增加用例：创建请求的键集只含 `workspaceId` 与可选 `agentPreset`，不含 `cwd`、`sessionId`

**Checkpoint**: `sessions.test.ts` 28 用例通过（commit `3fedf3a`）

---

## Phase 4: User Story 2 - 新会话沿用配置的预设与模型 (Priority: P2)

**Goal**: 预设随创建请求传入，模型写入新会话且不改变宿主默认。

**Independent Test**: 配置可用预设与模型后新建会话，断言请求带 `agentPreset`、模型选择被写入。

- [X] T006 [US2] 更新 `tests/sessions.test.ts` 的预设用例，断言请求包含 `agentPreset` 且不含 `sessionId`
- [X] T007 [US2] 运行 `pnpm run test:code -- sessions`，确认预设与模型的既有断言通过

**Checkpoint**: 预设与模型行为与 031 一致（commit `9f0c5f1`）

---

## Phase 5: User Story 3 - 创建失败可从宿主日志定位 (Priority: P3)

**Goal**: 失败日志与批次消息标识保持可查。

**Independent Test**: `tests/bridge.test.ts` 的注入失败用例仍断言 `failed <n> message`。

- [X] T008 [US3] 核对 `tests/bridge.test.ts` 的失败日志断言，确认无需改动

**Checkpoint**: 现有断言覆盖失败日志，无文件改动

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T009 [P] 更新 `docs/how-it-works.md` 会话一节：新建会话只向宿主传工作区标识
- [X] T010 [P] 在 `CHANGELOG.md` 增加修复条目
- [X] T011 运行 `pnpm format && pnpm check && pnpm build`（329 用例与 4 个 dist 用例通过）
- [X] T012 提交分支并推送，等待 CI
- [ ] T013 合并后执行 `pnpm run release` 发布 `0.1.5`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 Setup，阻塞所有故事
- **US1 (Phase 3)**: 依赖 Phase 2
- **US2 (Phase 4)**: 依赖 US1 的创建路径
- **US3 (Phase 5)**: 无代码依赖
- **Polish (Phase 6)**: 依赖全部故事
- **Release (Phase 7)**: 依赖合并完成

### Parallel Opportunities

- T009 与 T010 可并行
- T008 与 T006 可并行

---

## Implementation Strategy

1. 完成 Phase 1-2，类型与请求对齐宿主契约。
2. 完成 US1，验证归档后新建会话（MVP）。
3. 完成 US2 与 US3 的断言核对。
4. 完成文档与门禁，提交并推送。
5. 合并后发布 `0.1.5`。

## Notes

- 每个阶段一个 commit。
- 实机验证经用户豁免，验收以单元测试为准。
- 已失败批次的消息不会重投，遵循 032 的 D-005。