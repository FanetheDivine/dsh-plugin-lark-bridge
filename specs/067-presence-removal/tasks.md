# Tasks: 移除用户在场机制

**Input**: Design documents from `/specs/067-presence-removal/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**Tests**: 规格 FR-014 要求测试同步，本清单包含测试任务。

**Organization**: 按用户故事分阶段，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[Story]**: 所属用户故事
- 每条任务都带确切文件路径

## Path Conventions

- 单插件布局：`src/`、`tests/`、`docs/` 位于仓库根目录。

## 阶段说明

仓库已就绪，没有独立的 Setup 与 Foundational 阶段：第一阶段直接交付用户故事 1，改动不依赖新增基础设施。所有阶段都在 `refactor/067-presence-removal` 分支内按顺序推进，每个阶段结束提交一次。

---

## Phase 1: User Story 1 - 任务会话不等待无法回答的提问 (Priority: P1) 🎯 MVP

**Goal**: 被管理会话的 `ask_user_question` 一律被拒绝并在下一次请求前收到 S；会话开始被管理与插件加载时，结束已在等待的提问。

**Independent Test**: `tests/managed-ask-guard.test.ts` 与 `tests/lark-super-agent-index.test.ts` 断言无条件拒绝、取消、S 注入；不需要在场状态。

**Commit**: `refactor(067): 无条件拦截被管理会话提问`

### Tests for User Story 1

- [X] T001 [P] [US1] 重写 `tests/managed-ask-guard.test.ts`：覆盖被管理会话一律 `deny`、他方 `deny`/`cancel` 原样返回、未被管理与会话缺失时放行、`cancel(sessionId)` 中止控制器并取消网关请求、`sweep()` 只为被管理会话取消、网关缺失或抛错时只记日志、S 标记只生效一次。
- [X] T002 [P] [US1] 更新 `tests/lark-super-agent-index.test.ts`：用任务台账驱动被管理会话的提问拦截与下一次请求中的 S；删除依赖 `presence.set('remote')` 的用例。

### Implementation for User Story 1

- [X] T003 [US1] 重写 `src/lark-super-agent/managed/ask-guard.ts`：删除 `PresenceStore` 依赖与订阅；`beforeExecute` 先 `await next()`，保留他方 `deny`/`cancel`，对其余被管理会话调用 `cancel(sessionId)` 后返回 `{ kind: 'deny', reason: ASK_BLOCKED_ERROR }`；`aroundExecute` 为所有提问登记中止控制器；`cancel` 中止控制器并取消网关里该会话的 `user-questions/request`，同时排队 S；`sweep` 在加载时遍历网关请求并按 `isManaged` 取消；错误文案改为「本会话不能直接向用户提问，改用 `send_report` 的 `kind: question`」；删除 `interruptAll` 与因在场提前返回的分支。
- [X] T004 [US1] 更新 `src/lark-super-agent/managed/index.ts`：`AskGuard` 构造去掉 `presence`；调用 `void askGuard.sweep()`；经 `service.setManagedSessionListener((id) => askGuard.cancel(id))` 接线。
- [X] T005 [US1] 更新 `src/lark-super-agent/api.ts` 与 `src/lark-super-agent/service.ts`：接口增加 `setManagedSessionListener(listener: (sessionId: string) => void): void`；实现在 `createTask` 成功后通知该会话；同步更新 `tests/tool-schema.test.ts`、`tests/session-create.test.ts`、`tests/list-models.test.ts` 的服务桩。
- [X] T006 [US1] 更新 `src/lark-super-agent/managed/task-rules.ts`：S 正文改为「本会话不能直接向用户提问，调用 `send_report` 的 `kind: question`」，保留 `lark-task-rules` 来源与 `form: 'notice'`，保留同一会话最多一条与 `hasTaskRules` 去重。
- [X] T007 [US1] 运行 `pnpm check`，确认本阶段通过后提交。

**Checkpoint**: 拦截行为可独立验证，在场状态仍保留供后续阶段使用。

---

## Phase 2: User Story 2 - 桥接会话统一经飞书回复 (Priority: P2)

**Goal**: 桥接会话的回复与转达一律经 `lark_notify`，正文最多一句；调度会话不再收到在场提醒。

**Independent Test**: `tests/sa-dispatch.test.ts` 断言不插入 `sa-presence` 提醒、提示词无「Track where the user is」、桥接提醒含统一渠道与一句话规则。

**Commit**: `refactor(067): 桥接会话统一经 lark_notify 回复`

### Tests for User Story 2

- [X] T008 [P] [US2] 更新 `tests/sa-dispatch.test.ts`：删除在场提醒与状态切换用例；断言 `agent/pre-step` 不修改消息、提示词不含在场段落、`Handle reports` 不含渠道短语。

### Implementation for User Story 2

- [X] T009 [US2] 更新 `src/reminder.ts`：`BRIDGE_REMINDER` 改为「回复用户时调用 `lark_notify`」「成功送达后本轮正文最多一句概述，可以为空，完整内容只写在通知里」「通知失败时正文保留完整内容」；删除「其他来源的用户消息按普通方式回复」与「会话里的 text 块尽量少输出」。
- [X] T010 [US2] 更新 `src/sa-dispatch/prompt.ts`：删除「Track where the user is」整段；`Handle reports` 的转达句子去掉「through the channel for the current presence」。
- [X] T011 [US2] 更新 `src/sa-dispatch/index.ts`：删除 `agent/pre-step` 提醒插入与 `service.presence` 使用。
- [X] T012 [US2] 运行 `pnpm check`，确认本阶段通过后提交。

**Checkpoint**: 渠道规则集中在桥接提醒；非桥接的调度会话行为不变。

---

## Phase 3: User Story 3 - 删除在场状态与界面 (Priority: P3)

**Goal**: 删除全局在场状态、路由、闹钟、节假日、页脚按钮与配置页在场分区；配置页改名为任务配置页。

**Independent Test**: `tests/client.test.ts` 断言只注册 `TaskConfigPage` 且渲染无在场字段；`tests/lark-super-agent-index.test.ts` 断言行不再注册在场路由；`pnpm check` 通过。

**Commit**: `refactor(067): 删除在场状态与界面`

### Tests for User Story 3

- [X] T013 [P] [US3] 删除 `tests/presence.test.ts`、`tests/presence-routes.test.ts`、`tests/presence-schedule.test.ts`、`tests/presence-client.test.ts`、`tests/presence-alarms.test.ts`、`tests/presence-alarms-client.test.ts`。
- [X] T014 [P] [US3] 更新 `tests/client.test.ts`：改用 `TaskConfigPage`，断言槽位注册、摘要文案与渲染结果不含两个开关、时间编辑与节假日提示。
- [X] T015 [P] [US3] 更新 `tests/model-defaults.test.ts` 与 `tests/preset-defaults.test.ts`：改用 `TaskConfigForm` 与 `hooks.taskConfig`。

### Implementation for User Story 3

- [X] T016 [P] [US3] 删除 `src/lark-super-agent/presence.ts`、`routes.ts`、`schedule.ts`、`alarms.ts`、`holidays.ts`。
- [X] T017 [US3] 更新 `src/lark-super-agent/index.ts`：删除 `PresenceStore`、`HolidayCalendar`、`PresenceScheduler`、路由注册、`agent/pre-step` 观察与 `webServer` 注入；`inject` 保持 `['tools']`。
- [X] T018 [US3] 更新 `src/lark-super-agent/config.ts`（删除 `guiInputSetsLocal`、`larkInputSetsRemote`、`presenceAlarms` 与两个读取函数，保留任务模型与 `taskPreset`）、`src/lark-super-agent/api.ts`（删除 `presence`）、`src/lark-super-agent/service.ts`（删除 `presence` 与 `DEFAULT_SWITCHES`）、`src/constants.ts`（删除 `HOLIDAY_*`、`PRESENCE_TICK_MS`）、`src/config.ts`（删除 `holidayCachePath` 与 `HOLIDAY_CACHE_FILE` 引用）、`src/lark-super-agent/managed/task-rules.ts`（用本地会话结构替换 `PresenceSessionLike`）。
- [X] T019 [US3] 删除 `src/client/presence-controller.ts`、`presence-button.tsx`、`presence-alarms-editor.tsx`、`presence-alarms.css`。
- [X] T020 [US3] 将 `src/client/presence-config.tsx` 改名为 `src/client/task-config.tsx`：删除两个开关字段、闹钟字段、两个分区、节假日提示、`PresenceController` 依赖与相关 CSS；导出改为 `TASK_ROW_ID`、`TASK_ROW_KEY`、`TaskConfigForm`、`TaskConfigFields`、`TaskConfigState`、`TaskConfigInjected`、`TaskConfigPage`；hook 键改为 `taskConfig`；保留普通/复杂任务模型、默认任务类型与任务预设。
- [X] T021 [US3] 更新 `src/client/index.ts`：删除页脚按钮挂载、`PresenceController`、在场表单与 `RAIL_CSS`；挂载 `TaskConfigPage`；摘要文案与注入改用 `taskConfig`。
- [X] T022 [US3] 更新 `src/client/api.ts`（删除 `Presence`、`PresenceStatus`、`fetchPresence`、`writePresence` 与节假日类型）与 `src/client/locales.ts`（删除 `presence.*`、闹钟与节假日文案，`presenceConfig.*` 改为 `taskConfig.*`，zh/en 键集保持一致）。
- [X] T023 [US3] 更新 `cordis.patch.yml`：删除 `guiInputSetsLocal`、`larkInputSetsRemote` 与注释。
- [X] T024 [US3] 运行 `pnpm check`，确认本阶段通过后提交。

**Checkpoint**: 后端与前端不再有在场实现；Tailwind 与专属 UI 仍在，构建照常。

---

## Phase 4: User Story 3 - 移除 Tailwind 构建与专属依赖 (Priority: P3)

**Goal**: 删除只在场所用到的 UI 移植件、Tailwind 输入与构建脚本、九项专属依赖。

**Independent Test**: `pnpm build` 不再执行 Tailwind；`grep` 无 `tailwind` 与 `src/client/ui`；`pnpm check` 通过。

**Commit**: `refactor(067): 移除 Tailwind 构建与专属依赖`

- [ ] T025 [US3] 删除 `src/client/ui/` 下 7 个文件、`src/client/tailwind.css`、`src/client/tailwind.generated.css`、`scripts/build-client-css.mjs`。
- [ ] T026 [US3] 更新 `package.json`：删除九项依赖与 `css:build` 脚本，`dev`、`check`、`build`、`test:code` 去掉 `css:build`；运行 `pnpm install` 更新 `pnpm-lock.yaml`。
- [ ] T027 [US3] 运行 `pnpm check` 与 `pnpm build`，确认 `dist/client.js` 仍内联上报卡片与官方选择器样式后提交。

**Checkpoint**: 构建链只保留 `@tsdown/css`。

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 文档、变更记录、实机验收。

**Commit**: `docs(067): 更新在场机制移除后的文档`

- [ ] T028 [P] 更新 `README.md`：删除「在场状态」章节，写入「桥接会话的回复经飞书送达，正文最多一句」。
- [ ] T029 [P] 更新 `docs/how-it-works.md`：删除在场状态、自动切换时间、节假日与时间控件小节；更新路由表（只剩 status 与 check）、被管理会话能力表（无条件拦截）、桥接提醒、依赖与组成表。
- [ ] T030 [P] 更新 `docs/known-risks.md`：删除「用户在场状态」小节。
- [ ] T031 [P] 更新 `docs/development.md`：文件地图、测试表、构建说明去掉 `css:build` 与在场文件。
- [ ] T032 在 `CHANGELOG.md` 增加本次变更条目。
- [ ] T033 按 `quickstart.md` 执行真实宿主验收（A1、B6 至 B8、C6 至 C8），记录报告与截图。
- [ ] T034 运行 `pnpm format && pnpm check && pnpm build`，确认全部通过后提交。

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 无前置，可直接开始。
- Phase 2 依赖 Phase 1 的 `managed/index.ts` 与 `service.ts` 改动。
- Phase 3 依赖 Phase 2 删除 `service.presence` 的唯一使用方。
- Phase 4 依赖 Phase 3 删除 `src/client/ui/` 的使用方。
- Phase 5 依赖全部代码阶段。

### Within Each Phase

- 先写或改测试，再改实现；阶段结束前必须绿。
- 删除文件后同一阶段内更新所有引用。
- 每阶段最后一个任务运行 `pnpm check` 并提交。

### Parallel Opportunities

- T001 与 T002 可并行（不同测试文件）。
- T013、T014、T015 可并行（不同测试文件）。
- T016、T019 可并行（不同目录），T020 依赖 T019 的删除结果。
- T028 至 T031 可并行（不同文档）。

---

## Parallel Example: Phase 3

```bash
# 测试文件可同时改写：
Task: "删除 6 个在场测试文件"
Task: "更新 tests/client.test.ts"
Task: "更新 tests/model-defaults.test.ts 与 tests/preset-defaults.test.ts"

# 删除后端与前端在场实现可并行：
Task: "删除 src/lark-super-agent/presence.ts 等 5 个文件"
Task: "删除 src/client/presence-controller.ts 等 4 个文件"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 并独立验证：被管理会话的提问被拒、S 注入、管理时取消等待。
2. 完成 Phase 2：渠道统一，调度会话不再依赖在场提醒。
3. 完成 Phase 3 与 Phase 4：删除在场实现、界面与构建。
4. Phase 5 更新文档并做实机验收。

### Incremental Delivery

- 每个阶段结束都能通过 `pnpm check`，可单独评审与回滚。
- Phase 1 与 Phase 2 不依赖前端删除，后端行为先落地。
- Phase 3 保留 Tailwind 构建，缩小单次 commit 范围。
- Phase 4 只动构建与依赖，失败时回滚成本低。

---

## Notes

- [P] 任务只涉及不同文件，可与同阶段其他 [P] 任务并行。
- 在场状态的删除分两步：Phase 2 先停止使用，Phase 3 再删除，避免跨故事耦合。
- 服务桩的三处更新必须在 Phase 1 内完成，否则 `pnpm check` 的类型检查失败。
- T033 的验收只读插件代码；发现缺陷另开分支修复，不在本分支顺手改。
