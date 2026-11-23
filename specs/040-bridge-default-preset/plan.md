# Implementation Plan: 桥接会话默认预设

**Branch**: `feat/040-bridge-default-preset` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/040-bridge-default-preset/spec.md`

**Status**: Approved

## Open Decisions

无。

## Clarifications

### Session 2026-11-23

规格阶段已确认：

- [D-001] 默认值取预设 id `sa-dispatch`。
- [D-002] 移除预设菜单里的「跟随宿主默认」项；空值只作为旧配置遗留与运行时回退。
- [D-003] 已保存的预设值保持原值。
- [D-004] 不做实机验证；只更新现有测试。

计划阶段已确认：

- [P-001] 移除清空项：宿主文本字段把空文本当作清除，保存后值回落到 schema 缺省值，选项失效。
- [P-002] 测试只更新现有用例：`tests/plugin.test.ts` 的默认值断言与 `tests/client.test.ts` 的菜单断言。
- [P-003] 在实现提交里加 `CHANGELOG.md` 条目；版本号保持 `0.3.0`。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 已有用户保持旧预设；预设行停用时每次新建会话写回退警告；移除清空项后只能改 profile 配置回到跟随宿主默认

## Summary

把插件配置 `sessionPreset` 的缺省值从空串改为 `sa-dispatch`，新装用户在配置页直接看到 `SA-调度会话`，飞书消息新建的桥接会话使用该预设。移除菜单里的清空项，保留空值作为旧配置遗留与运行时回退。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`

**Primary Dependencies**: 宿主 `@deepseek-ai/*@0.2.2-rc.5`

**Storage**: profile 的 `cordis.patch.yml` 中的插件配置

**Testing**: vitest 的 `code` project；`dist` project 不受影响

**Target Platform**: DSH 宿主，Windows、macOS、Linux

**Project Type**: DSH 插件 npm 包

**Performance Goals**: 不适用，配置读取与新建会话路径不变

**Constraints**: 宿主依赖版本不变；配置页只经 schema 缺省值展示默认值

**Scale/Scope**: 修改 2 个源码文件、2 个测试文件与 4 份文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I 宿主依赖版本 | 通过。不改依赖。 |
| II 测试同步 | 通过。更新 `tests/plugin.test.ts` 与 `tests/client.test.ts` 的现有断言，覆盖默认值与菜单行为。按 D-004 不做实机验证，宪章只要求 SHOULD。 |
| III 文档结构 | 通过。README 写默认值与改选；`docs/known-risks.md` 写改选后的能力缺失；`docs/how-it-works.md` 写取值与回退机制；`CHANGELOG.md` 加条目。 |
| IV 质量门禁 | 通过。实现阶段运行 `pnpm format && pnpm check`。 |
| V 公开引用 | 通过。新增文档只引用仓库内路径。 |

设计完成后复核：结论不变。

## 设计

### 改动清单

| 编号 | 文件 | 改动 | 依据 |
| --- | --- | --- | --- |
| C-01 | `src/config.ts` | `Config` schema 与 `DEFAULT_CONFIG` 的 `sessionPreset` 缺省值改为 `sa-dispatch`；更新注释说明默认值与空值含义 | FR-001 |
| C-02 | `src/client/preset-select.tsx` | `menuItems` 去掉「跟随宿主默认」项；`currentText` 保留空值的「跟随宿主默认」文案，供旧配置显示 | FR-005 |
| C-03 | `tests/plugin.test.ts` | 默认值断言与 `DEFAULT_CONFIG` 期望改为 `sa-dispatch` | D-004 |
| C-04 | `tests/client.test.ts` | 菜单用例改为「首项为预设、不可用已存值补足」，删除清空项断言；空值文案用例改名说明旧配置 | D-004 |
| C-05 | `README.md` | 「飞书任务与调度会话」的启用步骤去掉手动选预设，写明默认预设与改选方式 | FR-008 |
| C-06 | `docs/known-risks.md` | 「预设手动选择」改为「预设默认与改选」，写明默认值与改选后的能力缺失 | FR-008 |
| C-07 | `docs/how-it-works.md` | 配置小节写明 `sessionPreset` 缺省 `sa-dispatch`，空值表示跟随宿主默认 | 宪章 III |
| C-08 | `CHANGELOG.md` | 新增 Unreleased 的 Changed 条目 | P-003 |

### 行为

- 新装且未保存过预设：配置页显示 `SA-调度会话`，新建桥接会话使用 `sa-dispatch`。
- 已保存预设：配置页显示所存预设，新建会话使用该预设。
- 已保存空值：配置页显示「跟随宿主默认」，新建会话跟随宿主。
- 预设不可用或名册不可读：新建会话回退宿主默认，写入一次警告。

### 验证

按 [quickstart.md](./quickstart.md) 运行测试与门禁。实机验证按 D-004 跳过。

### 风险

- 已有用户仍使用旧预设，行为不变。
- 预设行停用时每次新建会话写一条回退警告。
- 移除清空项后，用户只能通过修改 profile 配置回到跟随宿主默认。

## Project Structure

### Documentation (this feature)

```text
specs/040-bridge-default-preset/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── config.ts              # C-01 默认值
└── client/
    └── preset-select.tsx  # C-02 菜单项

tests/
├── plugin.test.ts         # C-03
└── client.test.ts         # C-04
```

**Structure Decision**: 单包插件，改动落在既有配置模块、客户端预设选择器、对应测试与文档。

## Complexity Tracking

无偏离。
