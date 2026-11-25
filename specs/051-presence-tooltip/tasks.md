---
description: "Task list for 在场状态按钮即时 tooltip"
---

# Tasks: 在场状态按钮即时 tooltip

**Input**: Design documents from `/specs/051-presence-tooltip/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**Tests**: 由项目宪章要求；先写测试并验证失败，再实现。

**Organization**: 按用户故事组织，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 不同文件且无依赖，可并行
- **[Story]**: 对应用户故事编号
- 所有任务包含具体文件路径

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 准备 tooltip 依赖

- [X] T001 添加 `@radix-ui/react-tooltip` 1.4.1 到 `package.json` 的 devDependencies，并更新 `pnpm-lock.yaml`

**Commit**: `chore(tooltip): add radix tooltip dependency`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 提供两个用户故事共用的 shadcn tooltip 封装

- [X] T002 在 `src/client/ui/tooltip.tsx` 新增 shadcn Tooltip 封装：Radix Portal、`data-dsh-lark-ui`、语义色类名、`TooltipProvider` 支持 `delayDuration={0}`

**Checkpoint**: tooltip 封装可被按钮直接引用

**Commit**: `feat(tooltip): add shadcn tooltip component`

---

## Phase 3: User Story 1 - 悬停立即看到状态与切换结果 (Priority: P1) 🎯 MVP

**Goal**: 悬停或键盘聚焦时立即显示当前状态与点击效果，移出或失焦立即收起

**Independent Test**: 用 jsdom 挂载 `PresenceButton`，验证指针移入与聚焦后 tooltip 出现、移出与失焦后消失，按钮不含 `title`

### Tests for User Story 1

- [X] T003 [US1] 更新 `tests/presence-client.test.ts`：断言按钮无原生 `title`，保留 `aria-label`；验证悬停、聚焦、移出与失焦的真实打开/关闭行为

### Implementation for User Story 1

- [X] T004 [US1] 修改 `src/client/presence-button.tsx`：用 `TooltipProvider`、`TooltipTrigger`、`TooltipContent` 包裹现有按钮，设置零延迟并复用 `presenceLabel`

**Checkpoint**: User Story 1 可独立运行并通过测试

**Commit**: `feat(presence): show immediate status tooltip`

---

## Phase 4: User Story 2 - 提示不干扰切换并适应侧栏边界 (Priority: P2)

**Goal**: 气泡上方优先并自动避让，点击切换行为保持

**Independent Test**: 验证 Radix Content 配置上方优先与碰撞边距，点击后控制器仍切换，失败态文案继续由按钮显示

### Tests for User Story 2

- [ ] T005 [US2] 更新 `tests/presence-client.test.ts`：覆盖点击切换、失败态文案与 tooltip 的上方/碰撞配置

### Implementation for User Story 2

- [ ] T006 [US2] 完善 `src/client/ui/tooltip.tsx` 与 `src/client/presence-button.tsx`：Content 使用 `side="top"`、`collisionPadding={8}`，Portal 样式不阻挡按钮指针事件

**Checkpoint**: 两个用户故事均可独立验证

**Commit**: `test(presence): cover tooltip boundaries and click behavior`

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: 文档与交付门禁

- [ ] T007 更新 `README.md` 的在场状态一节，说明悬停立即显示提示
- [ ] T008 新增 `changelogs/CHANGE.0.4.2.md` 记录 tooltip 行为变化
- [ ] T009 运行 `pnpm format && pnpm check` 并修复发现的问题
- [ ] T010 按 `specs/051-presence-tooltip/quickstart.md` 验证产物，运行 `pnpm build`

**Commit**: `docs(tooltip): document immediate presence hint`

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup → Foundational → US1 → US2 → Polish。
- T003 先于 T004；T005 先于 T006。
- T007 与 T008 可并行；T009、T010 在全部代码与文档变更后执行。

### User Story Dependencies

- US1 只依赖 T002。
- US2 复用 US1 的按钮接线，点击与状态逻辑保持现有控制器行为。

### Parallel Opportunities

- T007、T008 不同文件，可并行。
- 同一测试文件的 T003、T005 顺序执行。

---

## Parallel Example: Polish

```bash
Task: "更新 README.md 的在场状态一节"
Task: "新增 changelogs/CHANGE.0.4.2.md"
```

---

## Implementation Strategy

### MVP First

完成 Phase 1–3 即得到可独立使用的即时提示；随后完成 US2 的边界回归与最终文档。

### Incremental Delivery

1. 新增依赖与 shadcn Tooltip 封装。
2. 接入按钮并验证悬停/聚焦即时显示。
3. 验证上方避让、点击与失败态。
4. 更新文档、运行全量检查并合并。

---

## Notes

- 每个阶段单独 commit。
- 不修改既有状态路由、控制器或会话注入逻辑。
- jsdom 无法验证真实几何布局，实机验证覆盖 Radix 的翻转与避让。
