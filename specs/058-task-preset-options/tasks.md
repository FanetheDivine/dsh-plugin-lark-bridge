# Tasks: 任务会话预设移除 SA-调度会话 选项

**Input**: Design documents from `/specs/058-task-preset-options/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: 宪法原则 II 要求代码变更同步测试，包含测试任务。

**Organization**: 变更集中在前端预设目录模块，US1 是唯一实现故事；US2 与 US3 由同一组参数与现有兜底逻辑满足，归入验证与文档阶段。

## Phase 1: US1 — 任务会话预设可选项不含调度会话

**Goal**: 「任务会话预设」菜单不再列出 `sa-dispatch`，桥接「预设」不受影响。

**Independent Test**: 用携带排除列表的 `PresetDefaults` 读取名册，`rows` 不含 `sa-dispatch`；桥接实例的 `rows` 含 `sa-dispatch`。

- [x] T001 [US1] `PresetDefaults` 构造函数追加可选参数 `excludeIds`（默认空数组），`load()` 过滤名册时一并排除，见 `src/client/preset-defaults.ts`
- [x] T002 [P] [US1] 在 `src/client/presence-config.tsx` 的 `TASK_PRESET_FIELD` 旁导出排除标识常量 `TASK_PRESET_EXCLUDED_IDS = ['sa-dispatch']`
- [x] T003 [US1] 在 `src/client/index.ts` 把 `TASK_PRESET_EXCLUDED_IDS` 传给 `taskPresets` 实例，桥接 `presets` 实例不变
- [x] T004 [US1] 在 `tests/preset-defaults.test.ts` 新增用例：排除列表过滤 `sa-dispatch`；已存草稿 `taskPreset = sa-dispatch` 时 `current` 保留且不被清除；空排除列表名册不变

**Checkpoint**: commit `feat(058): 任务会话预设排除 SA-调度会话 选项`

## Phase 2: US2/US3 — 已存值兼容验证与文档

**Goal**: 已存 `sa-dispatch` 的展示与创建行为不回归，文档同步。

**Independent Test**: `menuItems` 对不在名册中的当前值补禁用项；`session_create` 读取路径无改动；`pnpm run full-check` 通过。

- [x] T001 [US3] 在 `tests/client.test.ts` 的 `menuItems` 用例中确认「当前值不在名册」补禁用项的既有断言覆盖已存 `sa-dispatch` 场景，不足则补
- [x] T002 [US3] 在 `docs/how-it-works.md` 的「任务会话预设」说明处补一句：可选项不含 `sa-dispatch`，已存值照常生效并显示为不可用项
- [x] T003 运行 `pnpm run full-check`（lint、类型、测试、构建、dist 新鲜度）

**Checkpoint**: commit `docs(058): 同步任务会话预设排除说明`

## Dependencies

- Phase 1 内：T001、T002 可并行；T003 依赖 T001、T002；T004 依赖 T001。
- Phase 2 依赖 Phase 1 完成。

## Parallel Execution Example

- T001 与 T002 同时进行；T003、T004 在两者完成后进行。

## Implementation Strategy

- MVP 是 Phase 1：仅排除参数即可满足核心需求。Phase 2 收尾兼容验证与文档。
