# Tasks: lark_notify 正文卡片与上报卡片正文色

**Input**: Design documents from `/specs/066-lark-notify-card/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/notify-card.md

**Tests**: 宪章 II 要求测试同步；每个故事先写测试再实现。

## Phase 1: Setup（共享基础设施）

沿用现有 DSH 插件工程与 Conversation Definition 机制，无新增基础设施或依赖，不产生空提交。

## Phase 2: Foundational（阻塞前提）

复用 `src/client/report-node.ts` 已验证的宿主事件模式与 `tests/helpers.ts`，无跨故事基础代码。

## Phase 3: User Story 1 - lark_notify 成功内容以正文卡片展示 (Priority: P1) 🎯 MVP

**Goal**: 成功通知在轮次层级只显示完整 `text`，纯文本保换行。

**Independent Test**: `tests/notify-node.test.ts`、`tests/notify-card.test.ts` 与 `tests/client.test.ts` 通过；实机成功调用只出正文卡片。

- [X] T001 [US1] 在 `tests/notify-node.test.ts` 编写成功结果与调用参数产出 `lark-notify` 节点、正文完整解析、轮次层级与节点复用的失败测试
- [X] T002 [P] [US1] 在 `tests/notify-card.test.ts` 编写卡片只含正文、保留换行、不渲染 Markdown 与额外字段的失败测试
- [X] T003 [US1] 在 `src/client/notify-node.ts` 实现 `text` 解析、现有成功结果识别、`lark-notify-result` Definition 注册与 `groupTree: 'turn'` 节点构造
- [X] T004 [P] [US1] 在 `src/client/notify-card.tsx` 实现只渲染 `text` 的纯文本卡片组件
- [X] T005 [P] [US1] 在 `src/client/notify-card.css` 实现上报风格外框、保留换行与 `--dsw-alias-label-primary` 正文色
- [X] T006 [US1] 在 `src/client/index.ts` 注册通知 Definition 与 `conversation.chat.node` 的 `lark-notify` 渲染器
- [X] T007 [US1] 更新 `tests/client.test.ts` 验证通知 Definition 与 Chat 节点注册，并运行本故事测试

**Commit**: `feat(066): 成功通知以纯文本正文卡片展示`

## Phase 4: User Story 2 - 上报与通知正文和对话正文同色 (Priority: P1)

**Goal**: 两类卡片的主要内容都使用宿主正文主前景令牌。

**Independent Test**: `tests/card-styles.test.ts` 通过；实机截图中卡片内容与普通助手正文同色。

- [X] T008 [US2] 在 `tests/card-styles.test.ts` 编写上报与通知卡片容器使用 `--dsw-alias-label-primary` 的失败测试
- [X] T009 [US2] 修改 `src/client/report-card.css`，将 `.dsh-lark-report` 默认色从次要前景色改为 `--dsw-alias-label-primary`，保留辅助层级
- [X] T010 [US2] 运行 `tests/card-styles.test.ts`、`tests/report-card.test.ts` 与 `tests/notify-card.test.ts`，确认只改颜色且上报结构不变

**Commit**: `fix(066): 上报与通知正文使用对话正文颜色`

## Phase 5: User Story 3 - 未送达的调用保持默认展示 (Priority: P2)

**Goal**: 进行中、失败、中断与历史缺调用时不产生通知卡片。

**Independent Test**: 非成功结果被排除，空正文不产节点，既有上报与通知工具回归通过。

- [X] T011 [US3] 在 `tests/notify-node.test.ts` 补充进行中无结果、失败结果、非 append 副本、其他工具与历史缺调用不产卡片的测试
- [X] T012 [US3] 运行 `tests/notify-node.test.ts`、`tests/report-node.test.ts`、`tests/tools.test.ts`，确认通知失败路径与两个工具后端行为不变

**Commit**: `test(066): 固定未送达通知的默认展示`

## Phase 6: Polish & Cross-cutting Concerns

- [ ] T013 [P] 更新 `README.md` 与 `docs/how-it-works.md`，说明成功通知只显示完整正文及卡片事件来源
- [ ] T014 [P] 更新 `docs/known-risks.md` 与 `CHANGELOG.md`，记录 Chat 接口和成功结果文案依赖及两项 UI 变化
- [ ] T015 运行 `pnpm format && pnpm full-check`，修复全部问题

**Commit**: `docs(066): 记录通知正文卡片与上报正文色`

## Phase 7: 实机验证

- [ ] T016 按 `quickstart.md` 与 `real-device-test` 技能验证成功/失败通知、上报与通知正文色、历史加载和折叠可见性，在 `specs/066-lark-notify-card/real-device-report.md` 记录结果与仓库内截图路径

**Commit**: `test(066): 记录通知与上报卡片实机验证`

## Dependencies & Execution Order

- Phase 1 与 Phase 2 无新增任务，可直接进入 US1。
- US1 不依赖其他故事，是 MVP。
- US2 依赖 US1 的通知卡片文件，需在其后修改或核对样式。
- US3 依赖 US1 的通知节点实现。
- Polish 依赖全部故事完成；实机验证依赖构建通过。

## Parallel Opportunities

- T002 可与 T001 并行编写。
- T004 与 T005 可在 T003 的节点数据契约确定后并行。
- T013 与 T014 可并行更新不同文档。

## Implementation Strategy

1. 先完成 US1，获得只含正文的通知卡片 MVP。
2. 再完成 US2 的颜色统一与 US3 的默认展示回归。
3. 最后更新文档、运行完整门禁并做真实宿主验证。
