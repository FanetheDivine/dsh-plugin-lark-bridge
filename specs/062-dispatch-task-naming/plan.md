# Implementation Plan: 调度会话向用户提及任务时同时给出名称与 id

**Branch**: `fix/062-dispatch-task-naming` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/062-dispatch-task-naming/spec.md`

**Status**: Waived

## Open Decisions

无。用户已预授权按推荐默认推进，实现路径记录在 [research.md](./research.md) 的 R-01 至 R-05。

## Clarifications

### Session 2026-11-26

- 无新增实现决策。措辞落点、桥接提醒插入位置、测试断言与文档条目见 research。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current complete plan | Open items: none | Risks: 提及形式只能由提示词与桥接提醒约束，模型可能不遵守；未做实机验证时仅以文本断言覆盖

## Summary

需求：调度会话对用户提及任务必须写成「名称 (id)」全形式。方案为纯文本变更：`SA_DISPATCH_PROMPT` 在 `## Reply style` 增加一条全局形式规则（含名称缺失兜底），并把 `## Start a task` 的「Tell the user the task id and the workspace」改写为该形式；`BRIDGE_REMINDER` 在回复规则列表中加入条件式同形式要求。工具代码、任务台账与被管理会话侧行为不变。测试断言新形式存在与旧裸 id 表述消失，文档同步 `docs/how-it-works.md` 与 `CHANGELOG.md`。

## Technical Context

**Language/Version**: TypeScript（Node ESM，宿主 DSH 插件）

**Primary Dependencies**: `@deepseek-ai/*`（与 `@deepseek-ai/dsh` 同版本）；无新增依赖

**Storage**: 无新存储；提示词与桥接提醒为源码常量

**Testing**: vitest（`pnpm test:code`）；产物新鲜度由 `pnpm build` 末尾的 `test:dist` 校验

**Target Platform**: DSH 宿主当前版本

**Performance Goals**: 不适用

**Constraints**: 只改文本常量；`session_create` 等工具的返回契约不变

**Scale/Scope**: `src/sa-dispatch/prompt.ts`、`src/reminder.ts` 两个源文件，`tests/sa-dispatch.test.ts`、`tests/reminder.test.ts` 两个测试文件，两份文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级依赖 |
| II. 测试同步 | 通过。两个测试文件增加形式断言与旧表述消失断言 |
| III. 文档结构 | 通过，附偏离。`docs/how-it-works.md` 与 `CHANGELOG.md` 同步；`README.md` 按用户需求给定范围不改，记录在 Complexity Tracking |
| IV. 质量门禁 | 通过。实现后运行 `pnpm format && pnpm check`，产物变更运行 `pnpm build` |
| V. 公开引用 | 通过。全部为仓内路径与公网引用，无本机路径 |

## Project Structure

### Documentation (this feature)

```text
specs/062-dispatch-task-naming/
├── spec.md              # 需求规格
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── quickstart.md        # Phase 1 输出
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/
├── sa-dispatch/
│   └── prompt.ts            # Reply style 新增形式规则；Start a task 改写通知句
└── reminder.ts              # BRIDGE_REMINDER 加入条件式同形式要求

tests/
├── sa-dispatch.test.ts      # 新形式断言与旧裸 id 表述消失断言
└── reminder.test.ts         # 桥接提醒含「名称 (id)」断言

docs/
└── how-it-works.md          # 调度提示词条目补充输出形式

CHANGELOG.md                 # Unreleased 条目
```

**Structure Decision**: 变更集中在两份文本常量；无数据模型与外部契约变化，省略 `data-model.md` 与 `contracts/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 宪章 III 要求用户可见行为变化更新 `README.md`，本变更不改 | 用户要求：需求给定文档范围为 `docs/how-it-works.md` 与 `CHANGELOG.md` | 按宪章补 README 会超出用户给定的改动范围 |
