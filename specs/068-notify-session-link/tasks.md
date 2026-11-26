# Tasks: 飞书通知关联会话与跳转

**Input**: Design documents from `/specs/068-notify-session-link/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/notify-session.md、quickstart.md

**Tests**: 宪章 II 要求测试同步；每个故事先写测试再实现。

## Phase 1: Setup（规格与设计）

- [X] T001 提交 `specs/068-notify-session-link/` 下的规格、计划、研究、数据模型、契约、验证步骤与本任务清单

**Commit**: `docs(068): 定义通知会话关联与跳转`

## Phase 2: Foundational（阻塞前提）

沿用现有通知工具、Conversation Definition、Chat 槽位与测试设施，无跨故事基础代码和空提交。

## Phase 3: User Story 1 - 从通知进入来源会话 (Priority: P1) 🎯 MVP

**Goal**: 新通知持久化来源 `sessionId`，有效且未归档的目标显示链接，点击后进入来源会话。

**Independent Test**: 工具结果和元数据携带当前 agent 标识；通知节点恢复标识；卡片按钮调用相同标识的 `openSession`；历史通知只显示正文。

### Tests for User Story 1

- [X] T002 [US1] 更新 `tests/tools.test.ts`，验证成功结果与 `presentationMeta` 包含当前 `sessionId` 且回执文本不变
- [X] T003 [P] [US1] 更新 `tests/notify-node.test.ts`，验证合法元数据进入 `NotifyCardData`，空白、非字符串、数组与缺失元数据被忽略
- [X] T004 [P] [US1] 更新 `tests/notify-card.test.ts`，验证有效未归档会话按钮、点击目标、未知会话只读和历史正文
- [X] T005 [US1] 更新 `tests/helpers.ts` 与 `tests/client.test.ts`，验证 `uiWorkspace` 依赖、`openSession` 注入和新增双语字典

### Implementation for User Story 1

- [X] T006 [US1] 修改 `src/tools.ts`，在成功结果与输出 schema 增加可选 `sessionId`，执行时读取当前 agent 并投影展示元数据
- [X] T007 [US1] 修改 `src/client/notify-node.ts`，从 `tool/result.meta` 解析非空字符串并写入可选 `sessionId`
- [X] T008 [US1] 修改 `src/client/notify-card.tsx`，订阅会话目录与归档快照，显示有效会话链接和只读回退
- [X] T009 [P] [US1] 修改 `src/client/notify-card.css`，实现会话 footer、宿主颜色令牌与长标识换行
- [X] T010 [US1] 修改 `src/client/index.ts` 与 `src/client/locales.ts`，注入 `openSession` 并添加会话相关中英文文案
- [X] T011 [US1] 运行 `tests/tools.test.ts`、`tests/notify-node.test.ts`、`tests/notify-card.test.ts`、`tests/client.test.ts` 与 `tests/card-styles.test.ts`

**Commit**: `feat(068): 通知关联并跳转到来源会话`

## Phase 4: User Story 2 - 识别已归档的来源会话 (Priority: P2)

**Goal**: 已归档目标显示只读标识与明确归档标签，状态变化可订阅。

**Independent Test**: 归档目标没有跳转按钮，显示“已归档”及完整标识；非归档和未知目标保持 US1 行为。

### Tests for User Story 2

- [X] T012 [US2] 更新 `tests/notify-card.test.ts` 与 `tests/client.test.ts`，验证归档标签、无按钮及中英文归档文案

### Implementation for User Story 2

- [X] T013 [US2] 修改 `src/client/notify-card.tsx`、`src/client/locales.ts` 与 `src/client/notify-card.css`，实现只读归档标签与布局
- [X] T014 [US2] 运行 `tests/notify-card.test.ts`、`tests/notify-node.test.ts` 与 `tests/client.test.ts`

**Commit**: `feat(068): 标记已归档的通知来源会话`

## Phase 5: Polish & Cross-cutting Concerns

- [ ] T015 [P] 更新 `README.md` 与 `docs/how-it-works.md`，记录用户行为、持久化元数据与导航机制
- [ ] T016 [P] 更新 `docs/known-risks.md` 与 `CHANGELOG.md`，记录历史兼容和宿主接口依赖
- [ ] T017 运行 `pnpm format && pnpm full-check`，修复全部问题并复核最终 diff

**Commit**: `docs(068): 记录通知会话链接与归档标记`

## Dependencies & Execution Order

- Phase 1 先保存完整设计。
- Phase 2 无新增任务，可直接进入 US1。
- US1 提供会话数据与链接，是 MVP。
- US2 复用 US1 的归档快照和只读布局，在其后增加标签。
- Polish 依赖全部故事完成。

## Parallel Opportunities

- T003 与 T004 可并行编写不同测试文件。
- T009 可在 T008 的 class 名确定后并行调整样式。
- T015 与 T016 可并行更新不同文档。

## Implementation Strategy

1. 先写结果、节点和卡片失败测试，确认新契约尚未满足。
2. 完成 US1 并独立验证来源会话链接。
3. 完成 US2 并验证归档只读状态。
4. 更新文档，运行完整门禁并复核最终变更。
