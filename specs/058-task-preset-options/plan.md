# Implementation Plan: 任务会话预设移除 SA-调度会话 选项

**Branch**: `feat/058-task-preset-options` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/058-task-preset-options/spec.md`

**Status**: Waived

## Open Decisions

无。实现路径唯一且无实质取舍：在 `PresetDefaults` 名册展示层按预设标识过滤。

## Clarifications

### Session 2026-11-26

- 无待确认实现决策。需求描述已限定过滤范围与兼容性要求。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 已存 `taskPreset = sa-dispatch` 在选择器中显示为「不可用」禁用项，属预期表现。

## Summary

「任务会话预设」与桥接「预设」共用宿主预设名册（`remote.agentPresets.list()`），由 `PresetDefaults` 读取并过滤损坏条目。给 `PresetDefaults` 增加可选的排除标识列表，「任务会话预设」实例传入 `sa-dispatch`，桥接「预设」实例不传。已存值不受过滤影响：`PresetSelect` 现有逻辑已把不在名册中的当前值显示为禁用「不可用」项，`session_create` 读取 `taskPreset` 的路径不变。

## Technical Context

**Language/Version**: TypeScript（Node ESM，宿主 DSH 插件）

**Primary Dependencies**: `@deepseek-ai/*`（与 `@deepseek-ai/dsh` 同版本）、React（宿主提供）

**Storage**: 无新存储；沿用宿主行配置 `taskPreset` 字段

**Testing**: vitest（`pnpm test:code`）

**Target Platform**: DSH 宿主浏览器端配置页

**Performance Goals**: 不适用

**Constraints**: 不新增依赖；不改动 `session_create` 与配置 schema

**Scale/Scope**: 前端两个文件加测试与文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级依赖 |
| II. 测试同步 | 通过。`tests/preset-defaults.test.ts` 新增排除与已存值兼容用例 |
| III. 文档结构 | 通过。`docs/how-it-works.md` 的「任务会话预设」说明同步；CHANGELOG 按 push/merge 规则由 worktree-finish 处理 |
| IV. 主工作区纪律 | 通过。全部变更在本 worktree |

## Project Structure

### Documentation (this feature)

```text
specs/058-task-preset-options/
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── quickstart.md        # Phase 1 输出
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/client/
├── preset-defaults.ts   # PresetDefaults 增加排除标识列表
├── presence-config.tsx  # 定义任务会话预设的排除标识常量
└── index.ts             # taskPresets 实例传入排除标识

tests/
└── preset-defaults.test.ts  # 排除与兼容用例

docs/
└── how-it-works.md      # 「任务会话预设」说明同步
```

**Structure Decision**: 变更集中在浏览器端预设目录模块；无数据模型与外部契约变更，省略 `data-model.md` 与 `contracts/`。

## Complexity Tracking

无违例。
