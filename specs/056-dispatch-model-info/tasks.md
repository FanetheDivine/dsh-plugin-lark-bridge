# Tasks: 调度会话模型信息查询工具

**Input**: Design documents from `/specs/056-dispatch-model-info/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/list-models-tool.md, quickstart.md

**Tests**: 宪章 II 要求代码与测试同步，每个阶段含对应测试任务。

**Organization**: 按用户故事分阶段；每阶段一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[Story]**: 所属用户故事（US1/US2/US3）
- 描述含确切文件路径

## Phase 1: Setup

**Purpose**: 确认基线干净

- [x] T001 运行 `pnpm check` 确认基线通过后，提交 spec 与 plan 工件（specs/056-dispatch-model-info/）

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 全部用户故事依赖的类型与骨架

- [x] T002 在 src/sa-dispatch/list-models.ts 定义 `LlmCatalogLike` 最小接口（listProviders/listModels/resolveModelInfo，见 research.md R-001）与 `ListModelsResult`、`ProviderEntry`、`ModelEntry`、`SkippedEntry` 类型（见 data-model.md）
- [x] T003 [P] 在 tests/list-models.test.ts 搭建模拟 ctx 与可编程 llm 模拟（参照 tests/session-create.test.ts 与 tests/helpers.ts）

**Checkpoint**: 类型与测试设施就绪

---

## Phase 3: User Story 1 - 查询全部可用模型 (Priority: P1) 🎯 MVP

**Goal**: `list_models` 一次调用返回全部 provider、model 与 effort id

**Independent Test**: 用模拟 llm 调用工具，输出与宿主目录一致的 `{ providers, skipped }`

### Implementation for User Story 1

- [x] T004 [US1] 在 src/sa-dispatch/list-models.ts 实现 `buildListModelsTool`：defineTool 定义 name=`list_models`、空参数表、JSON output schema（contracts/list-models-tool.md），execute 顺序枚举 providers → models → 逐路由 resolveModelInfo 提取 `reasoning.efforts` 的 id 列表
- [x] T005 [US1] 在 tests/list-models.test.ts 测试：工具注册与命名、参数表为空、两个 provider 的完整枚举与顺序、model 无 reasoning 声明时 `efforts` 为空数组、无已注册 provider 时返回 `{ providers: [], skipped: [] }`
- [x] T006 [US1] 运行 `pnpm test:code` 通过后提交（阶段 commit）

**Checkpoint**: US1 独立可用

---

## Phase 4: User Story 2 - 为 session_create 选择模型 (Priority: P2)

**Goal**: 调度会话能注册并调用 `list_models`，结果字段可直接传给 `session_create`

**Independent Test**: apply 后 `list_models` 出现在预设工具中；结果 id 拼写与宿主一致

### Implementation for User Story 2

- [x] T007 [US2] 在 src/sa-dispatch/index.ts 现有 `ctx.inject(['sessionController'])` 块内注册 `buildListModelsTool`，`llm` 以 `scoped.get('llm')` 读取并允许为 undefined（research.md R-004）
- [x] T008 [US2] 在 tests/list-models.test.ts 测试：sa-dispatch apply 后 `list_models` 已注册、execute 返回的 provider/model/efforts 值与模拟 llm 的原始拼写逐字一致
- [x] T009 [US2] 运行 `pnpm test:code` 通过后提交（阶段 commit）

**Checkpoint**: US1 与 US2 均独立可用

---

## Phase 5: User Story 3 - 查询失败时给出可理解结果 (Priority: P3)

**Goal**: 三级失败策略全部落地（research.md R-003）

**Independent Test**: 模拟 llm 未挂载、provider 目录失败、model 解析失败三种状态，行为符合 contracts/list-models-tool.md 失败表

### Implementation for User Story 3

- [x] T010 [US3] 在 src/sa-dispatch/list-models.ts 实现失败策略：llm 为 undefined 时 execute 抛可读错误；provider `listModels` 失败跳过并记 `{ provider, error }`；model `resolveModelInfo` 失败跳过并记 `{ provider, model, error }`；`skipped` 按失败顺序排列
- [x] T011 [US3] 在 tests/list-models.test.ts 测试：llm 未挂载时 execute 拒绝且错误可读、provider 级跳过不阻断其余 provider、model 级跳过不阻断同 provider 其余 model、skipped 顺序与字段正确
- [x] T012 [US3] 运行 `pnpm test:code` 通过后提交（阶段 commit）

**Checkpoint**: 全部用户故事独立可用

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文档与质量门禁

- [x] T013 [P] 在 README.md「关于调度会话」补一句：调度会话可用 `list_models` 查询当前可用模型
- [x] T014 [P] 在 docs/how-it-works.md 预设工具列表（约 191 行）加 `list_models`
- [x] T015 运行 `pnpm format && pnpm check`（宪章 IV）与 quickstart.md 场景 1-6 核对，通过后提交（阶段 commit）

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6，逐级阻塞
- US1（Phase 3）是 MVP；US2/US3 依赖 US1 的工具实现

### Parallel Opportunities

- T002 与 T003 可并行
- T013 与 T014 可并行

## Implementation Strategy

- 按 Phase 顺序串行执行，每阶段一个 commit
- MVP = Phase 1-3；完成后即可实机验证查询能力

## Notes

- 每个 phase 对应一个 commit（AGENTS.md 开发流程）
- 全部完成后建议按 quickstart.md「端到端确认」在真实宿主验证
