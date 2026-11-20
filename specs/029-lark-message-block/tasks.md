# Tasks: 飞书消息块与回复提醒

**Input**: Design documents from `/specs/029-lark-message-block/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: 宪章 II 要求代码变更同步测试，因此每个用户故事都包含测试任务。

**Organization**: 任务按用户故事分组，每个阶段可独立实现与验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且无未完成依赖
- **[Story]**: 所属用户故事（US1、US2、US3）
- 描述包含确切文件路径

## Path Conventions

单包插件：`src/`、`tests/` 位于仓库根目录。

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 确认 worktree 内可运行测试与格式检查

- [X] T001 确认 worktree 工具链：在仓库根与 worktree 分别运行 `../../node_modules/.bin/vitest --version`、`../../node_modules/.bin/biome --version`，记录不依赖 `pnpm install` 的测试命令，写入本次会话的执行记录

**Checkpoint**: 工具链可用，后续任务可直接运行测试

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 消息来源与共享格式化，所有用户故事的前置

**⚠️ CRITICAL**: 本阶段完成前不能开始任何用户故事

- [X] T002 [P] 新建 `src/message.ts`：声明 `MessageSourceMap` 的 `'lark-bridge'` 键（`{ kind: 'lark-bridge'; reminder?: true }`），导出 `LARK_SOURCE`、`REMINDER_SOURCE`、`isLarkMessage`、`isReminderMessage`
- [X] T003 [P] 修改 `src/utils.ts`：`formatTime` 输出 `YYYY-MM-DD HH:mm:ss`（Asia/Shanghai，`hourCycle: 'h23'`）；新增 `escapeAttribute` 转义 `"` 与 `<`
- [X] T004 修改 `src/sessions.ts`：删除文件内的 `MessageSourceMap` 声明，改从 `src/message.ts` 导入来源；新增 `isBridgeSession(session)`，比较 `state.sessionId` 与 `session.id`

**Checkpoint**: 共享模块就绪，用户故事可以开始

---

## Phase 3: User Story 1 - 飞书消息以块注入 (Priority: P1) 🎯 MVP

**Goal**: 注入的用户消息文本是一个 `<lark-message message_id time>` 块，块内只有正文。

**Independent Test**: 向机器人发一条文本消息，检查会话中用户消息的文本内容。

### Tests for User Story 1

- [X] T005 [P] [US1] 更新 `tests/bridge.test.ts`：断言块匹配 `^<lark-message message_id="[^"]+" time="[^"]+">`、块内只有正文、空正文用类型占位、`</lark-message>` 被转义、不含 `<system-reminder>`
- [X] T006 [P] [US1] 更新 `tests/sessions.test.ts`：断言 `followup` 内容只有块文本、来源是 `{ kind: 'lark-bridge' }`；新增 `isBridgeSession` 命中与未命中用例

### Implementation for User Story 1

- [X] T007 [US1] 修改 `src/bridge.ts`：`formatFeishuReminder(event, senderName)` 改为 `formatLarkMessage(event)`，按 `message_id`、`time` 顺序输出块并转义正文
- [X] T008 [US1] 修改 `src/sessions.ts`：`inject(block)` 用 `LARK_SOURCE` 投递块文本；删除 `reminderMessage` 与 `reminder()` 调用
- [X] T009 [US1] 运行 code 测试（`../../node_modules/.bin/vitest run --project code`）并修复 US1 相关失败

**Checkpoint**: User Story 1 可独立验证，块注入生效

---

## Phase 4: User Story 2 - 回复规则提醒 (Priority: P1)

**Goal**: 桥接会话中出现一条中文说明性 `<system-reminder>`，说明块含义与四条回复规则。

**Independent Test**: 新建桥接会话并发一条飞书消息，检查该次请求包含提醒。

### Tests for User Story 2

- [X] T010 [P] [US2] 新建 `tests/reminder.test.ts`：提醒文案含四条规则；`agent/pre-step` 在表层缺少提醒时把提醒插到第一条块之前；表层已有提醒或本批已有提醒时不插入；非桥接会话不插入；`decision.kind === 'reject'` 与空批次原样返回

### Implementation for User Story 2

- [X] T011 [US2] 新建 `src/reminder.ts`：`BRIDGE_REMINDER` 文案常量、`createReminderMessage()`、`installReminderGuard({ ctx, sessions, logger })`，按 [plan.md](./plan.md#4-提醒与补注srcreminderts) 的流程实现
- [X] T012 [US2] 修改 `src/index.ts`：构造 `SessionManager` 后调用 `installReminderGuard`，用 `ctx.effect` 释放监听
- [X] T013 [US2] 运行 code 测试并修复 US2 相关失败

**Checkpoint**: User Story 1 与 2 可独立验证，提醒随第一条块进入请求

---

## Phase 5: User Story 3 - 压缩后仍有提醒 (Priority: P1)

**Goal**: 表层提醒被压缩摘要覆盖后，下一次模型请求前补回一条，且不重复。

**Independent Test**: 压缩桥接会话后触发下一次 `agent/pre-step`，检查表层提醒条数。

### Tests for User Story 3

- [X] T014 [US3] 在 `tests/reminder.test.ts` 增加压缩场景：把表层替换为一条摘要后触发 `agent/pre-step`，提醒条数从零变为一；连续触发保持一条

### Implementation for User Story 3

- [X] T015 [US3] 复核 `src/reminder.ts` 的 `surfaceHasReminder`：遍历 `session.surface.nodes` 并用 `session.eventAt(seq)` 读取事件，确保替换后的表层能被正确判定；必要时修正
- [X] T016 [US3] 运行 code 测试并修复 US3 相关失败

**Checkpoint**: 三个用户故事全部可独立验证

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文档同步与发布门禁

- [X] T017 [P] 更新 `README.md`：功能列表改为 `<lark-message>` 块与提醒
- [X] T018 [P] 更新 `docs/how-it-works.md`：消息与会话两节补充块格式与压缩后补注
- [X] T019 [P] 更新 `docs/known-risks.md`：补充提醒依赖模型遵守、旧会话不补提醒
- [X] T020 运行 `pnpm format && pnpm check`，修复格式与检查问题
- [X] T021 运行 `pnpm build`，确认 dist 测试通过
- [X] T022 更新 `CHANGELOG.md`：按分支规则在 push 前增加条目
- [ ] T023 按 [quickstart.md](./quickstart.md) 在真实宿主完成人工验收

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 Phase 1
- **User Stories (Phase 3–5)**: 依赖 Phase 2；按 P1 顺序执行
- **Polish (Phase 6)**: 依赖全部用户故事

### Within Each User Story

- 测试先写并确认失败
- 实现集中在 `src/`
- 每个阶段运行一次 code 测试
- 每个阶段一个 commit

### Parallel Opportunities

- T002 与 T003 并行（不同文件）
- T005 与 T006 并行（不同测试文件）
- T017、T018、T019 并行（不同文档）

---

## Parallel Example: User Story 1

```bash
Task: "更新 tests/bridge.test.ts 断言块格式"
Task: "更新 tests/sessions.test.ts 断言注入内容与 isBridgeSession"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 与 Phase 2
2. 完成 Phase 3（User Story 1）
3. 验证块注入，形成 MVP

### Incremental Delivery

1. Phase 3：块注入
2. Phase 4：提醒进入请求
3. Phase 5：压缩后补注
4. Phase 6：文档与发布门禁

---

## Notes

- [P] 任务文件不同且互不依赖
- 每个阶段对应一个 commit（AGENTS.md）
- 真实宿主验收依赖用户配合
