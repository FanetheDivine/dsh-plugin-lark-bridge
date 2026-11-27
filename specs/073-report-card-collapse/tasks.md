---

description: "Task list for 073-report-card-collapse"

---

# Tasks: 上报卡片折叠开关

**Input**: Design documents from `/specs/073-report-card-collapse/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 包含测试任务。宪章要求代码变更同步新增或更新 `tests/`。

**Organization**: 按阶段组织，每个阶段对应一个 commit。

## Phase 1: 文档与依赖就绪

- [x] T001 在 worktree 安装依赖并运行 `pnpm check` 确认基线通过
- [x] T002 提交本特性文档：`specs/073-report-card-collapse/` 下的 spec、plan、research、data-model、quickstart、checklists 与 tasks

## Phase 2: 上报卡片折叠开关与无障碍样式（US1 & US2）

- [x] T003 [US1] 在 `src/client/locales.ts` 的 `zh` 与 `en` 字典中增加 `report.collapse`（`收起` / `Collapse`）与 `report.expand`（`展开` / `Expand`）
- [x] T004 [US1] 更新 `src/client/report-card.tsx`：默认展开（`expanded = true`），在头部增加 `<button type="button" className="dsh-lark-report-toggle" aria-expanded={expanded}>` 与折叠态单行任务摘要 `.dsh-lark-report-head-desc`，折叠时隐藏简介、正文与附件列表，展开时恢复，并在 `FALLBACK` 补齐英文默认文案
- [x] T005 [US2] 更新 `src/client/report-card.css`：增加 `.dsh-lark-report-head-desc`、`.dsh-lark-report-toggle`、`.dsh-lark-report-toggle-icon` 样式与 `:focus-visible` 焦点环，保留 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 的 `color: var(--dsw-alias-label-primary)` 规则
- [x] T006 [US1] 更新 `tests/report-card.test.ts`：覆盖默认展开、点击折叠隐藏主体并显示头部单行摘要、点击展开恢复完整内容、各 `kind`（`progress` / `question` / 自定义 / 空）一致、键盘可访问属性与中英文回退文案
- [x] T007 [US2] 更新 `tests/card-styles.test.ts`：校验折叠开关与头部摘要样式规则，并确认 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 主前景色规则未回退

## Phase 3: 文档同步与质量门禁

- [ ] T008 更新 `README.md`、`docs/how-it-works.md` 与 `CHANGELOG.md` 的 Unreleased 条目，说明上报卡片默认展开并支持折叠/展开
- [ ] T009 运行 `pnpm format && pnpm check && pnpm build`，确认类型检查、lint、源码测试与产物测试全部通过

## Dependencies

- T001 → T002 → T003 → T004 → T005 → T006/T007 → T008 → T009

## Parallel Opportunities

- T006 与 T007 修改不同测试文件，可在 T005 完成后并行。

## Implementation Strategy

1. Phase 1 准备 worktree 依赖与设计文档。
2. Phase 2 完成上报卡片折叠开关、样式与单元测试。
3. Phase 3 同步文档并通过 `pnpm check` 与 `pnpm build` 门禁。
