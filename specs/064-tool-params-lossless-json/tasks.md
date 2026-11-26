# Tasks: 修复工具参数声明不是无损 JSON 导致的宿主崩溃

**Input**: Design documents from `specs/064-tool-params-lossless-json/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [quickstart.md](./quickstart.md)

**Tests**: 规格 FR-006 要求测试，按 TDD 顺序编写：先失败，再修实现。

**Organization**: 按用户故事分阶段，每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事

## Path Conventions

单插件布局：源码在 `src/`，测试在 `tests/`。

---

## Phase 1: Setup

**Purpose**: 确认干净基线

- [X] T001 运行 `pnpm install` 与 `pnpm check`，确认改动前全部通过

**Checkpoint**: 基线可复现。

---

## Phase 2: Foundational（阻塞全部用户故事）

**Purpose**: 提供宿主等价的无损 JSON 校验函数

- [X] T002 [P] 新增 `tests/support/lossless-json.ts`：导出 `assertLosslessJson(value)`，按 [data-model.md](./data-model.md) 的规则递归校验，通过时返回深拷贝，失败时抛 `Error` 且消息含失败路径。规则：只接受 null、布尔、字符串、有限数字（拒绝 `-0`、`NaN`、`Infinity`）；数组必须是原生 `Array.prototype` 且除 `length` 外只有连续下标；对象原型必须是 `null` 或原生 `Object.prototype`，自有键全为可枚举字符串键；沿路径不得出现循环引用

**Checkpoint**: 校验函数可用于全部声明断言。

---

## Phase 3: User Story 1 - 声明通过宿主的无损 JSON 校验 (Priority: P1) 🎯 MVP

**Goal**: 全部已注册工具的声明都能被克隆，宿主枚举不再抛异常。

**Independent Test**: `pnpm test:code` 中 `tests/tool-schema.test.ts` 通过，`lark_notify` 声明不触发校验失败。

- [X] T003 [US1] 新增 `tests/tool-schema.test.ts`：用 `makeCtx` 收集三行插件的 `_registeredTools`（主行 `apply`、`registerDispatchTools` 加 `larkSuperAgent` 桩、`lark-super-agent` 的 `apply`），对每个工具的 `parameters` 调用 `assertLosslessJson`；同一批声明连续校验 10 次，断言结果一致
- [X] T004 [US1] 运行 `pnpm test:code`，确认 T003 失败，失败信息指向 `parameters.~standard`
- [X] T005 [US1] 修改 `src/tools.ts` 的 `parametersOf`：剔除 `$schema` 并复制成纯 JSON 副本，使其只含可枚举字符串键
- [X] T006 [US1] 运行 `pnpm test:code`，确认全部通过

**Checkpoint**: 声明可被宿主克隆，P1 完成。

**Commit**: `fix(064): 工具声明改为纯 JSON 以通过宿主克隆`

---

## Phase 4: User Story 2 - 工具参数声明保持不变 (Priority: P2)

**Goal**: 模型看到的参数结构与运行时行为不变。

**Independent Test**: `tests/tools.test.ts` 断言键集合与字段结构，并通过校验函数。

- [X] T007 [US2] 修改 `tests/tools.test.ts`：断言 `lark_notify.parameters` 的自有键恰为 `type`、`properties`、`required`、`additionalProperties`；`properties.text` 与 `properties.reply_to` 为字符串，`required` 为 `['text']`；声明通过 `assertLosslessJson`
- [X] T008 [US2] 运行 `pnpm test:code`，确认通过

**Checkpoint**: 声明结构固定，发送与校验行为未变。

**Commit**: `test(064): 固定 lark_notify 声明结构`

---

## Phase 5: User Story 3 - 同类写法被测试拦住 (Priority: P3)

**Goal**: 校验函数自身覆盖边界，越界声明在提交前失败。

**Independent Test**: `tests/support/lossless-json.test.ts` 全绿。

- [ ] T009 [P] [US3] 新增 `tests/support/lossless-json.test.ts`：覆盖不可枚举键、symbol 键、`-0`、`NaN`、类实例、稀疏数组、循环引用与深拷贝独立性；每例断言抛出的消息含对应路径
- [ ] T010 [US3] 运行 `pnpm test:code`，确认通过

**Checkpoint**: 校验函数可信，回归防线成立。

**Commit**: `test(064): 覆盖无损 JSON 校验的边界`

---

## Phase 6: Polish

**Purpose**: 文档与质量门禁

- [ ] T011 [P] 在 `docs/how-it-works.md` 通知小节补一句：声明由 zod 生成后复制成纯 JSON，剔除 `$schema` 与 `~standard`，供宿主克隆
- [ ] T012 [P] 在 `CHANGELOG.md` 增加一条：`lark_notify` 的声明改为纯 JSON，修复启用 `dsh-plugin-better-mcp` 时宿主抛 `must be lossless JSON` 并终止进程
- [ ] T013 运行 `pnpm format && pnpm check`，确认通过

**Commit**: `docs(064): 记录声明生成方式`

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1：无依赖
- Phase 2：依赖 Phase 1
- Phase 3：依赖 Phase 2（需要校验函数）
- Phase 4：依赖 Phase 3（修复后结构断言才有意义）
- Phase 5：依赖 Phase 2，可与 Phase 3、Phase 4 并行
- Phase 6：依赖 Phase 3 至 Phase 5

### Within Each Phase

- 测试先写并确认失败，再改实现
- 修实现后必须重跑 `pnpm test:code`

### Parallel Opportunities

- T009 与 T003 至 T008 触及不同文件，可并行
- T011 与 T012 触及不同文件，可并行

---

## Parallel Example: Phase 3 与 Phase 5

```text
任务 A（US1）：新增 tests/tool-schema.test.ts 并修改 src/tools.ts
任务 B（US3）：新增 tests/support/lossless-json.test.ts
```

---

## Implementation Strategy

### MVP First

Phase 1 至 Phase 3 即可消除崩溃：校验函数、全部工具声明断言与 `parametersOf` 修复。

### Incremental Delivery

1. Phase 3 完成 → 声明可克隆，崩溃消除
2. Phase 4 完成 → 结构固定，防止修复改变模型可见参数
3. Phase 5 完成 → 校验函数自身可信
4. Phase 6 完成 → 文档与质量门禁

---

## Notes

- 校验规则与宿主 `snapshotJsonValue` 等价，宿主升级时先复核再改测试
- 每个阶段一个 commit
- 不重建 `dist`，产物在发布时生成
