# Implementation Plan: 调度会话模型信息查询工具

**Branch**: `feat/056-dispatch-model-info` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/056-dispatch-model-info/spec.md`

**Status**: Approved

## Open Decisions

none

## Clarifications

### Session 2026-11-26

- [P-D-001] Q: 是否在调度会话提示词中加入 `list_models` 使用指引？ -> A: 不改提示词，只注册工具。
- [P-D-002] Q: 单个 model 的元数据解析失败时怎么处理？ -> A: 跳过该 model 并在结果中标注，与 provider 级失败策略一致。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 跳过失败部分时结果可能不完整，由 skipped 标注缓解（用户指示「自行实现」）

## Summary

在 `SA-调度会话` 预设作用域新增 `list_models` 工具：经宿主 `llm` 服务枚举全部已注册 provider 与 model，逐路由解析支持的 reasoning effort，以结构化 JSON 返回，供 `session_create` 的 `provider`、`model`、`effort` 参数直接选用。llm 未挂载时报可读错误；provider 或 model 级失败跳过并在结果中标注。

## Technical Context

**Language/Version**: TypeScript（ESM，随 DSH 宿主运行）

**Primary Dependencies**: `@deepseek-ai/dsh-tools`（defineTool）、`@deepseek-ai/dsh-llm`（类型与既有依赖，不新增依赖）、`@deepseek-ai/dsh-agent`（既有类型）

**Storage**: N/A（只读宿主目录，无持久化）

**Testing**: vitest（`pnpm test:code`），模拟 `ctx` 来自 `tests/helpers.ts`

**Target Platform**: DSH 宿主插件（`SA-调度会话` 预设作用域）

**Project Type**: DSH 插件（cordis 行 + 工具注册）

**Performance Goals**: 单次调用完成全量枚举；目录规模为个位数 provider，顺序遍历无延迟压力

**Constraints**: 不新增 `@deepseek-ai/*` 依赖；不改动调度提示词；工具仅在 `SA-调度会话` 预设可用

**Scale/Scope**: 新增 1 个工具文件、1 个测试文件、README 与 how-it-works 各一处更新

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增依赖，仅复用既有 `@deepseek-ai/dsh-llm` 类型。 |
| II. 测试同步 | 通过。新增 `tests/list-models.test.ts` 覆盖真实行为；`dsh` 版本不变；实机端到端验证列入 quickstart 建议。 |
| III. 文档结构 | 通过。README「关于调度会话」补工具能力一句；`docs/how-it-works.md` 预设工具列表加 `list_models`；CHANGELOG 按 push/merge 规则由 worktree-finish 处理。 |
| IV. 质量门禁 | 通过。任务含 `pnpm format && pnpm check`。 |
| V. 公开引用 | 通过。全部产物只用仓库相对路径。 |

## Project Structure

### Documentation (this feature)

```text
specs/056-dispatch-model-info/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── list-models-tool.md
└── tasks.md             # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/sa-dispatch/
├── index.ts             # 在现有 inject(['sessionController']) 块内注册 list_models
├── list-models.ts       # 新增：buildListModelsTool 与 llm 目录读取的最小接口
└── tools.ts             # 不改动

tests/
└── list-models.test.ts  # 新增：注册、枚举、两级跳过、未挂载报错、空目录

README.md                # 「关于调度会话」补一句工具能力
docs/how-it-works.md     # 预设工具列表加 list_models
```

**Structure Decision**: 单项目结构；工具实现沿 `session_create` 的既有模式独立成文件，接线集中在 `src/sa-dispatch/index.ts`，测试与 `tests/session-create.test.ts` 同构。

## Complexity Tracking

无宪章偏离，无需记录。
