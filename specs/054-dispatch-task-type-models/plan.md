# Implementation Plan: 调度会话更名与任务类型模型配置

**Branch**: `feat/054-dispatch-task-type-models` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/054-dispatch-task-type-models/spec.md`

**Status**: Waived

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

无。

## Clarifications

### Session 2026-11-26

- [P-001] Q: 行元数据与文档更名方式 -> A: `rows/lark-super-agent/locale/zh.json` 改为标题「调度会话」、描述「用调度会话统一管理其他任务会话」，同步更新英文资源与全部文档引用。
- [P-002] Q: 普通/复杂任务模型与默认任务类型的配置键 -> A: `commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`、`complexTaskProvider`、`complexTaskModel`、`complexTaskEffort` 与 `defaultTaskType`（默认 `'common'`）；删除旧 `taskProvider`、`taskModel`、`taskEffort`。
- [P-003] Q: 配置页双模型选择器与默认按钮 -> A: 两个 `ModelDefaults` 实例分别绑定普通与复杂任务模型字段；每个模型标题旁使用宿主 `Pill` 组件显示「默认」/「设为默认」切换 `defaultTaskType`。
- [P-004] Q: `session_create` 的 `task_type` 参数与模型解析 -> A: 新增可选 `task_type`（`'common'`、`'complex'` 或空串/省略），空值按 `defaultTaskType` 解析对应模型，显式 `provider`/`model`/`effort` 覆盖该模型；工具描述与调度提示词写明非用户明确要求时均传空值或省略。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document（用户在规格审查时明确指示「这个改完后自行推进任务 pr&合并&release」） | Open items: none | Risks: 旧配置键 `taskProvider`、`taskModel`、`taskEffort` 不迁移

## Summary

将 `lark-super-agent` 行更名为「调度会话」，描述改为「用调度会话统一管理其他任务会话」。把原有的单一「任务会话模型」拆分为「普通任务模型」与「复杂任务模型」两组模型配置及 `defaultTaskType`（默认 `'common'`），在配置页提供两个模型选择器和标题旁的「默认」/「设为默认」切换。在 `session_create` 工具中新增 `task_type` 参数，并在工具描述与 `SA-调度会话` 提示词中规定：除非用户明确要求，否则 `task_type` 与 `provider`/`model`/`effort` 均传空值或省略。

## Technical Context

**Language/Version**: TypeScript 6，Node.js ≥ 24.9

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5、`@deepseek-ai/cordis` ~4.1.0、`@deepseek-ai/schemastery` ~3.19.0、React 18

**Storage**: 宿主行配置（volatile 字段）

**Testing**: vitest（`pnpm check`、`pnpm full-check`）

**Target Platform**: DSH 宿主进程与 Web GUI

**Project Type**: DSH 插件

**Performance Goals**: 配置变更热重载即时生效

**Constraints**: 严格配置校验；中英文字典键集一致

**Scale/Scope**: 单项目插件内 10 余个源文件与对应测试、文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增或变更 `@deepseek-ai/*` 依赖版本 |
| II. 测试同步 | 通过。同步更新 `tests/task-model.test.ts`、`tests/session-create.test.ts`、`tests/lark-super-agent-index.test.ts`、`tests/sa-dispatch.test.ts`、`tests/model-defaults.test.ts`、`tests/presence-client.test.ts` |
| III. 文档结构 | 通过。同步更新 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md`、`cordis.patch.yml` 及 `CHANGELOG.md` |
| IV. 质量门禁 | 通过。执行 `pnpm format && pnpm full-check` |
| V. 公开引用 | 通过。全部引用为仓库内相对路径或公网 URL |

Phase 1 设计后复核：全部通过。

## Project Structure

### Documentation (this feature)

```text
specs/054-dispatch-task-type-models/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── session-create.md
└── tasks.md
```

### Source Code (repository root)

```text
rows/
└── lark-super-agent/
    ├── icon.svg
    └── locale/
        ├── zh.json
        └── en.json
src/
├── lark-super-agent/
│   ├── api.ts
│   ├── config.ts
│   ├── index.ts
│   ├── service.ts
│   └── task-model.ts
├── sa-dispatch/
│   ├── prompt.ts
│   └── session-create.ts
└── client/
    ├── index.ts
    ├── locales.ts
    ├── presence-config.tsx
    ├── presence-controller.ts
    └── task-model-field.tsx
tests/
├── lark-super-agent-index.test.ts
├── model-defaults.test.ts
├── presence-client.test.ts
├── sa-dispatch.test.ts
├── session-create.test.ts
└── task-model.test.ts
```

**Structure Decision**: 沿用现有单包结构，在 `src/lark-super-agent/`、`src/sa-dispatch/`、`src/client/` 与 `rows/lark-super-agent/` 原地演进。

## Complexity Tracking

无宪章偏离。
