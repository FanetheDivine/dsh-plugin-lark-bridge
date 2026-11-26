# Tasks: 调度会话更名与任务类型模型配置

**Input**: Design documents from `/specs/054-dispatch-task-type-models/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story. Each phase corresponds to one git commit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

---

## Phase 1: Foundational (任务类型配置模型与服务接口)

**Purpose**: 定义任务类型、分档模型配置 schema 与服务接口，作为后续配置页和 `session_create` 的前置基础。

- [x] T001 在 `src/lark-super-agent/api.ts` 中导出 `TASK_TYPES = ['common', 'complex'] as const` 与 `TaskType = 'common' | 'complex'`，并将 `LarkSuperAgentService.taskModel` 签名更新为 `(taskType?: TaskType) => ModelSelection | undefined`
- [x] T002 更新 `src/lark-super-agent/config.ts`：将 `taskProvider`、`taskModel`、`taskEffort` 替换为 `commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`、`complexTaskProvider`、`complexTaskModel`、`complexTaskEffort`（均为 `Schema.string().default('').volatile()`）与 `defaultTaskType`（`Schema.union([Schema.const('common'), Schema.const('complex')]).default('common').volatile()`）
- [x] T003 更新 `src/lark-super-agent/task-model.ts`：实现 `readDefaultTaskType(config): TaskType`（当 `defaultTaskType` 为 `'complex'` 时返回 `'complex'`，其余返回 `'common'`）与 `readTaskModel(config, taskType?: TaskType): ModelSelection | undefined`（按给定或默认任务类型读取对应前缀的模型三元组）
- [x] T004 更新 `src/lark-super-agent/service.ts` 与 `src/lark-super-agent/index.ts`：使 `SuperAgentService.taskModel(taskType?)` 转发 `readTaskModel(config, taskType)`
- [x] T005 [P] 更新 `tests/task-model.test.ts` 与 `tests/lark-super-agent-index.test.ts`，覆盖普通任务模型、复杂任务模型与 `defaultTaskType` 的实时读取

**Checkpoint**: 宿主配置 schema 与 `readTaskModel(config, taskType)` 完备并通过单元测试。

---

## Phase 2: User Story 1 - 行更名为「调度会话」并配置普通/复杂任务模型与默认任务类型 (Priority: P1) 🎯 MVP

**Goal**: 将 `lark-super-agent` 行更名为「调度会话」、描述改为「用调度会话统一管理其他任务会话」，并在配置页提供「普通任务模型」与「复杂任务模型」选择器及默认任务类型切换按钮。

**Independent Test**: 运行 `tests/metadata.test.ts`、`tests/model-defaults.test.ts`、`tests/presence-client.test.ts` 与 `tests/client.test.ts`，验证行元数据、前端字典、双模型选择器草稿绑定与默认任务类型切换。

- [x] T006 [P] [US1] 更新 `rows/lark-super-agent/locale/zh.json`（`title: "调度会话"`，`description: "用调度会话统一管理其他任务会话"`）、`rows/lark-super-agent/locale/en.json`（`title: "Dispatch session"`，`description: "Manage task sessions from the dispatch session."`）与 `rows/lark-super-agent/icon.svg`
- [x] T007 [P] [US1] 更新 `src/client/locales.ts`：将单一任务会话模型文案替换为普通任务模型（`presenceConfig.commonTaskModel.label` / `description`）、复杂任务模型（`presenceConfig.complexTaskModel.label` / `description`）与默认切换文案（`presenceConfig.taskType.default: '默认'` / `'Default'`、`presenceConfig.taskType.setDefault: '设为默认'` / `'Set as default'`）
- [x] T008 [US1] 更新 `src/client/task-model-field.tsx`：导出 `COMMON_TASK_MODEL_FIELD_NAMES` 与 `COMPLEX_TASK_MODEL_FIELD_NAMES`，支持在模型标题行右侧渲染默认任务类型切换 `Pill`（`data-dsh-lark-default-task-type="common" | "complex"`）
- [x] T009 [US1] 更新 `src/client/presence-config.tsx`、`src/client/presence-controller.ts` 与 `src/client/index.ts`：在 `PresenceConfigForm` 中绑定 `commonTask*`、`complexTask*` 与 `defaultTaskType` 字段，在 `src/client/index.ts` 中创建两个 `ModelDefaults` 实例注入 `PresenceConfigPage`，渲染「普通任务模型」与「复杂任务模型」两个选择项
- [x] T010 [P] [US1] 更新 `tests/model-defaults.test.ts` 与 `tests/presence-client.test.ts`，验证普通/复杂任务模型字段读写、默认任务类型切换及配置页渲染

**Checkpoint**: User Story 1 的行更名与前端配置页完整可用并通过测试。

---

## Phase 3: User Story 2 - 调度会话创建任务会话时按任务类型或默认类型选择模型 (Priority: P1)

**Goal**: `session_create` 增加可选参数 `task_type`（`common` / `complex` / 空值），并在工具描述与 `SA-调度会话` 提示词中规定：任务类型对应用户预先设定的模型配置，`provider`/`model`/`effort` 将其覆盖，除非用户明确说明否则都不传。

**Independent Test**: 运行 `tests/session-create.test.ts` 与 `tests/sa-dispatch.test.ts`，验证 `task_type` 空值、`common`、`complex`、非法值校验、显式 `provider`/`model`/`effort` 覆盖优先级以及提示词与工具描述。

- [x] T011 [US2] 更新 `src/sa-dispatch/session-create.ts`：新增 `task_type` 参数，更新工具与参数描述（说明 `task_type` 对应用户预先设定的普通/复杂任务模型配置，`provider`/`model`/`effort` 将其覆盖，除非用户明确说明否则都不传），实现 `task_type` 校验（仅允许 `'common'`、`'complex'` 或空串/省略）及模型解析优先级（显式 `provider`/`model`/`effort` > `service.taskModel(taskType)` > 宿主默认）
- [x] T012 [P] [US2] 更新 `src/sa-dispatch/prompt.ts` 的 `Start a task` 节：规定除非用户明确要求任务类型或具体模型，否则 `task_type` 传空值且不传 `provider`、`model`、`effort`
- [x] T013 [P] [US2] 更新 `tests/session-create.test.ts` 与 `tests/sa-dispatch.test.ts`，覆盖 `task_type` 参数契约、空值默认、显式类型、非法值报错、显式模型覆盖及提示词断言

**Checkpoint**: User Story 2 完整实现并通过全部工具与提示词测试。

---

## Phase 4: Polish & Cross-Cutting Concerns (文档同步与全量构建校验)

**Purpose**: 同步用户文档、开发者文档、预设补丁注释与变更日志，并通过全量质量门禁。

- [x] T014 [P] 更新 `cordis.patch.yml`、`README.md`、`docs/how-it-works.md`、`docs/known-risks.md` 与 `CHANGELOG.md`：将「飞书任务与调度会话」更新为「调度会话」，同步普通/复杂任务模型、默认任务类型与 `session_create` 的 `task_type` 说明
- [x] T015 运行 `pnpm format && pnpm full-check` 完成代码格式化、类型检查、lint、源码测试、构建与产物测试

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Foundational)**: 无前置依赖，定义共享类型、配置 schema 与服务接口。
- **Phase 2 (User Story 1)**: 依赖 Phase 1。
- **Phase 3 (User Story 2)**: 依赖 Phase 1，与 Phase 2 互不阻塞。
- **Phase 4 (Polish)**: 依赖 Phase 2 与 Phase 3。

### Parallel Opportunities

- Phase 2 中 `T006`（行元数据）与 `T007`（前端字典）可并行。
- Phase 3 中 `T011`（`session-create.ts`）与 `T012`（`prompt.ts`）可并行。

---

## Parallel Example: User Story 1 & User Story 2

```bash
# Phase 2 内并行更新元数据与前端字典：
Task: "T006 [P] [US1] 更新 rows/lark-super-agent/locale/*.json 与 icon.svg"
Task: "T007 [P] [US1] 更新 src/client/locales.ts"

# Phase 3 内并行更新 session_create 与调度提示词：
Task: "T011 [US2] 更新 src/sa-dispatch/session-create.ts"
Task: "T012 [P] [US2] 更新 src/sa-dispatch/prompt.ts"
```

---

## Implementation Strategy

### Incremental Delivery

1. 完成 Phase 1（Foundational）并提交 commit。
2. 完成 Phase 2（User Story 1：更名与配置页）并提交 commit。
3. 完成 Phase 3（User Story 2：`session_create` 与调度提示词）并提交 commit。
4. 完成 Phase 4（Polish：文档同步与 `pnpm full-check`）并提交 commit。
