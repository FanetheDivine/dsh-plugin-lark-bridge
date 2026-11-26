# Implementation Plan: 精简 README 最后两节

**Branch**: `docs/055-simplify-readme-sections` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/055-simplify-readme-sections/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

None.

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 用户明确要求跳过审查直接实现、提交 PR 并合并。

## Summary

精简 `README.md` 最后两节（「关于调度会话」与「在场状态」），移除面向开发者的工具名、参数字面量、底层上报归档机制、UI 控件操作与缓存回退细节，只保留用户关心的核心交互与配置说明。

## Technical Context

**Language/Version**: Markdown / TypeScript (Node.js 24.9+)

**Primary Dependencies**: 无新增依赖

**Storage**: N/A

**Testing**: vitest (`pnpm check`)

**Target Platform**: DeepSeek Harness 插件文档

**Project Type**: DSH 插件 (`dsh-plugin-lark-bridge`)

**Performance Goals**: N/A

**Constraints**: 遵守宪章原则 III（文档结构与单一归属）与 `AGENTS.md` 写作规范

**Scale/Scope**: 仅修改 `README.md` 最后两节及发布分支 `CHANGELOG.md`

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. 宿主依赖版本**: PASS（不涉及依赖变更）
- **II. 测试同步**: PASS（纯文档精简，不改变代码行为，现有测试覆盖打包校验）
- **III. 文档结构**: PASS（`README.md` 省略实现细节，被移除的机制细节已在 `docs/how-it-works.md` 与 `docs/known-risks.md` 归属；分支推送时更新 `CHANGELOG.md`）
- **IV. 质量门禁**: PASS（变更后执行 `pnpm format && pnpm check`）
- **V. 公开引用**: PASS（无本机绝对路径或私有 URL）

## Project Structure

### Documentation (this feature)

```text
specs/055-simplify-readme-sections/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
README.md
CHANGELOG.md
```

**Structure Decision**: 仅更新仓库根目录的 `README.md` 与 `CHANGELOG.md`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 跳过 spec 与 plan 的交互式批准等待（记为 Waived） | 用户要求（明确指示「自行实现」「自行pr&合并继续」） | 按 Governance 优先级，用户的明确要求高于默认流程等待 |
