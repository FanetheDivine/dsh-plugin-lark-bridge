---
description: "上报卡片头部折叠热区的任务清单"
---

# Tasks: 上报卡片头部折叠热区

**Input**: `specs/077-report-header-toggle/` 下的 spec.md、plan.md、research.md、data-model.md 与 quickstart.md

**Tests**: 宪章要求代码变更同步更新测试，两个用户故事都含测试任务。

**Organization**: 按用户故事分组，每个阶段对应一个 commit。

## Phase 1: Setup

**Purpose**: 准备可运行的工作区

- [x] T001 在工作区执行 `pnpm install`，确认 `pnpm test:code --report-card` 与 `pnpm harness` 可用

---

## Phase 2: Foundational

**Purpose**: 固定实现基线

- [x] T002 [P] 阅读 `src/client/report-card.tsx`、`src/client/report-card.css`、`tests/report-card.test.ts`、`tests/card-styles.test.ts`，确认现有折叠行为与测试断言

**Checkpoint**: 基线明确，用户故事可独立开工

---

## Phase 3: User Story 1 - 点击卡片头部切换折叠 (P1)

**Goal**: 头部整行成为切换控件，点击任意位置折叠或展开

**Independent Test**: 渲染卡片后依次点击标题、类型标签与回执，`data-expanded` 每次都切换

- [x] T003 [P] [US1] 在 `tests/report-card.test.ts` 增加断言：头部元素为 `BUTTON`，`data-dsh-lark-report-toggle` 落在头部按钮上，点击标题、`Tag` 与回执都切换 `data-expanded`，点击附件不切换
- [x] T004 [US1] 在 `src/client/report-card.tsx` 把 `<header>` 换成 `<button type="button" className="dsh-lark-report-head" data-dsh-lark-report-toggle="" aria-expanded={expanded} aria-label={toggleLabel} onClick={...}>`，包含图标、标题、类型标签、折叠态摘要与回执
- [x] T005 [US1] 在 `src/client/report-card.css` 为 `.dsh-lark-report-head` 增加按钮复位（`width: 100%`、`border: none`、`background: none`、`font: inherit`、`color: inherit`、`text-align: start`、`cursor: pointer`）、悬停底色 `--dsw-alias-interactive-bg-hover` 与 `:focus-visible` 焦点环，删除 `.dsh-lark-report-toggle` 规则
- [x] T006 [US1] 运行 `pnpm test:code --report-card` 与 `pnpm typecheck`，修复断言与类型问题

**Checkpoint**: 整行点击可用，视觉布局与当前一致

---

## Phase 4: User Story 2 - 头部只保留箭头 (P1)

**Goal**: 头部没有可见的「收起」「展开」文字，箭头随状态翻转，无障碍名称保留

**Independent Test**: 头部 `textContent` 不含两种文案（中英文），`aria-label` 随状态变化，箭头随 `aria-expanded` 旋转

- [x] T007 [P] [US2] 在 `tests/report-card.test.ts` 断言头部文本不含「收起」「展开」，英文回退不含 `Collapse` / `Expand`，`title` 缺失，`aria-label` 随状态切换
- [x] T008 [US2] 在 `src/client/report-card.tsx` 删除 `.dsh-lark-report-toggle-text` 节点与 `title`，只渲染 `IconChevronDownOutlineRegular`
- [x] T009 [US2] 在 `src/client/report-card.css` 把箭头选中器改为 `.dsh-lark-report-head[aria-expanded="true"] .dsh-lark-report-toggle-icon`，保留 150ms 旋转与 `prefers-reduced-motion` 分支
- [x] T010 [P] [US2] 在 `tests/card-styles.test.ts` 断言头部按钮悬停与焦点环、箭头旋转规则，卡片内边距仍为 `10px 14px 12px`，正文主前景色规则保留
- [x] T011 [US2] 运行 `pnpm test:code --report-card` 与 `pnpm test:code --card-styles`

**Checkpoint**: 头部只有箭头，两态方向相反

---

## Phase 5: Polish

- [ ] T012 [P] 更新 `docs/how-it-works.md` 的上报卡片段落：整行箭头开关，无文字按钮
- [ ] T013 在根目录执行 `pnpm format && pnpm check`，确认格式、类型、lint 与代码测试全部通过

---

## Dependencies

- T001 → T002 → T003 → T004 → T005 → T006 → T007 → T008 → T009 → T010 → T011 → T012 → T013
- T003 与 T007、T010 修改不同测试文件或不同断言块，可并行准备
- 阶段内任务完成后提交一个 commit

## Implementation Strategy

- MVP 为 US1：整行点击即可交付价值
- US2 紧跟其后完成箭头与无障碍收尾
- 每个 Checkpoint 运行对应测试，最终以 `pnpm check` 收口
