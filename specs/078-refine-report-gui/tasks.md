---
description: "上报与通知卡片悬停变色与点击热区的任务清单"
---

# Tasks: 优化上报与通知卡片 GUI 悬停与点击热区

**Input**: `specs/078-refine-report-gui/` 下的 spec.md、plan.md、research.md、data-model.md 与 quickstart.md

**Tests**: 宪章要求代码变更同步更新测试，两个用户故事都含测试任务。

**Organization**: 按用户故事分组，每个阶段对应一个 commit。

## Phase 1: Setup

**Purpose**: 可运行工作区与规格产物入库

- [x] T001 在 worktree 根目录执行 `pnpm install`，运行 `pnpm test:code --card` 确认基线测试通过
- [x] T002 提交 `specs/078-refine-report-gui/` 全部规格产物（spec、plan、research、data-model、quickstart、checklists、tasks）

---

## Phase 2: User Story 1 - 分隔线上方热区切换折叠与悬停整体变色 (P1) 🎯 MVP

**Goal**: 上报卡片容器悬停整体变色，分隔线上方完整区域（含展开态任务简介）是折叠热区

**Independent Test**: `pnpm test:code --report-card` 与 `pnpm test:code --card-styles`：desc 在热区内、点击 desc 切换折叠、悬停与分区样式断言通过

- [x] T003 [P] [US1] 在 `tests/report-card.test.ts` 断言展开态 `.dsh-lark-report-desc` 位于 `button[data-dsh-lark-report-toggle]` 内且点击 desc 切换 `data-expanded`，折叠态不渲染 desc；头部点击用例覆盖 desc 子元素
- [x] T004 [US1] 在 `src/client/report-card.tsx` 把标题行包进 `span.dsh-lark-report-head-row`，展开态 desc 由 `div` 改 `span` 并移入热区按钮作为第二行，删除按钮外的 desc 块
- [x] T005 [US1] 在 `src/client/report-card.css` 容器去掉 padding/gap、加 `transition: background-color 0.1s` 与 `@media (hover:hover)` 整卡 `:hover` 变色（`--dsw-alias-turn-trigger-bg-hover` 回退 `--dsw-alias-interactive-bg-hover`）；head 改纵向 flex、`padding: 10px 14px`、删除自身 hover 底色、焦点环 `outline-offset: -2px`；body/files `padding: 8px 14px 12px` 保留 border-top；reduced-motion 覆盖容器与箭头
- [x] T006 [P] [US1] 在 `tests/card-styles.test.ts` 更新上报卡片断言：容器无 padding、热区 `padding: 10px 14px`、`:hover` 令牌、body/files 分区内边距与 border-top、焦点环、箭头旋转
- [x] T007 [US1] 运行 `pnpm test:code --report-card` 与 `pnpm test:code --card-styles`，修复断言与类型问题

**Checkpoint**: 上报卡片热区铺满分隔线上方，整卡悬停变色

---

## Phase 3: User Story 2 - 通知卡片与上报卡片视觉交互一致 (P2)

**Goal**: 通知卡片同构：热区折叠正文（卡片模式默认折叠显示总结，文本模式默认展开显示「通知」），任务与会话行常显

**Independent Test**: `pnpm test:code --notify-card` 与 `pnpm test:code --card-styles`：两种模式默认状态、热区切换、会话链接独立、常显信息行与文案键断言通过

- [x] T008 [P] [US2] 在 `tests/notify-card.test.ts` 重写卡片模式用例（总结在热区内、默认折叠、无 `<details>`、点击展开）；新增文本模式默认展开与「通知」标题、点击热区收起用例；会话链接改按 `data-dsh-lark-notify-session-link` 定位并断言点击不改变展开状态；折叠态任务与会话行常显；更新历史正文用例；文案用例覆盖 `notify.title`、`notify.collapse`、`notify.expand`
- [x] T009 [US2] 在 `src/client/locales.ts` 新增 `notify.title`（通知 / Notification）与 `notify.collapse`（收起 / Collapse），`notify.expand` 改值为 展开 / Expand
- [x] T010 [US2] 在 `src/client/notify-card.tsx` 渲染热区 `button.dsh-lark-notify-head`（`data-dsh-lark-notify-toggle`、图标 + 总结或 `notify.title` 标题 + 箭头、`aria-expanded`、`aria-label`），`expanded` 初值 `summary === undefined`；正文仅展开时渲染；任务与会话行包进 `footer.dsh-lark-notify-meta` 常显；移除 `<details>`
- [x] T011 [US2] 在 `src/client/notify-card.css` 写同构容器与热区样式（无容器 padding、整卡 `:hover`、热区 `padding: 10px 14px`、焦点环、箭头旋转），body 与 meta `padding: 8px 14px 12px` 带 border-top，meta 行距 6px；移除 session `margin-top` 与 details/summary 样式
- [x] T012 [P] [US2] 在 `tests/card-styles.test.ts` 新增通知卡片断言：`:hover` 令牌、热区 padding、body `pre-wrap` 与分区、meta border-top、箭头旋转
- [x] T013 [US2] 运行 `pnpm test:code --notify-card` 与 `pnpm test:code --card-styles`，修复断言与类型问题

**Checkpoint**: 两张卡片交互与视觉一致

---

## Phase 4: Polish

- [x] T014 [P] 更新 `docs/how-it-works.md` 的 `lark_notify` 卡片段落与上报卡片段落：热区范围、整卡悬停变色、通知卡片折叠模式与常显信息行
- [x] T015 [P] 在 `CHANGELOG.md` 写 `## Unreleased` 条目：两卡片悬停整体变色与热区折叠、通知卡片两种模式
- [x] T016 在根目录执行 `pnpm format && pnpm check` 与 `pnpm build`，确认格式、类型、lint、源码测试与产物测试全部通过

---

## Dependencies

- T001 → T002 → Phase 2 → Phase 3 → Phase 4
- T003 与 T006、T008 与 T012 修改不同测试文件，可并行准备
- T009 先于 T010（字典键类型）；T004/T005 与 T010/T011 各自故事内先测试后实现
- 每个阶段完成后提交一个 commit

## Implementation Strategy

- MVP 为 US1：上报卡片热区与悬停变色即可交付价值
- US2 复用 US1 确立的容器/热区样式模式
- 每阶段以对应测试收口，最终 `pnpm check` 与 `pnpm build` 全量回归
