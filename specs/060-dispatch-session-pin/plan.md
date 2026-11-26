# Implementation Plan: 调度提示词规定任务会话的置顶与归档

**Branch**: `fix/060-dispatch-session-pin` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/060-dispatch-session-pin/spec.md`

**Status**: Waived

## Open Decisions

无。用户已委托后续流程，实现路径记录在 [research.md](./research.md) 的 R-01 至 R-05。

## Clarifications

### Session 2026-11-26

- 无新增实现决策。提示词结构、宿主语义、测试与文档范围见 research。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current complete plan | Open items: none | Risks: 置顶与归档只能由提示词约束，模型可能不按步骤调用；归档运行中的会话依赖 `stop_activity` 语义；未做实机验证时仅以提示词测试覆盖

## Summary

缺陷：调度提示词没有规定 `session_pin` 的使用时机，并且明确写着结束任务不归档会话。修复只改提示词文本：`session_create` 与 `session_manage` 成功后置顶会话，`task_end` 成功后以 `stop_activity: true` 归档会话，`session_unmanage` 不归档且保留置顶；跨场景规则放入新增小节。`task_end` 描述删除与新规则冲突的政策句，工具代码行为不变。

## Technical Context

**Language/Version**: TypeScript（Node ESM，宿主 DSH 插件）

**Primary Dependencies**: `@deepseek-ai/*`（与 `@deepseek-ai/dsh` 同版本）、`dsh-plugin-meta-tools` 0.1.7（提供 `session_pin` 与 `session_archive`）

**Storage**: 无新存储；提示词与工具描述为源码常量

**Testing**: vitest（`pnpm test:code`）；产物测试由 `pnpm build` 末尾的 `test:dist` 执行

**Target Platform**: DSH 宿主 0.2.2-rc.5

**Performance Goals**: 不适用

**Constraints**: 只改提示词与工具描述；`session_create`、`session_manage`、`task_end`、`session_unmanage` 的代码行为不变

**Scale/Scope**: `src/sa-dispatch` 两个文件、一个测试文件、两份文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级依赖 |
| II. 测试同步 | 通过。`tests/sa-dispatch.test.ts` 更新小节顺序与新规则断言 |
| III. 文档结构 | 通过，附偏离。`docs/how-it-works.md` 与 `CHANGELOG.md` 同步；`README.md` 按用户结论 D-006 不改，记录在 Complexity Tracking |
| IV. 质量门禁 | 通过。实现后运行 `pnpm format && pnpm check`，合并前再跑 `pnpm check` |
| V. 公开引用 | 通过。宿主语义只引用包名与符号，不写本机路径 |

## Project Structure

### Documentation (this feature)

```text
specs/060-dispatch-session-pin/
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
src/sa-dispatch/
├── prompt.ts            # 三处生命周期步骤与新增小节
└── tools.ts             # task_end 描述删除冲突政策句

tests/
└── sa-dispatch.test.ts  # 小节顺序与置顶、归档、失败处理断言

docs/
└── how-it-works.md      # 调度提示词条目与结束任务说明

CHANGELOG.md             # Unreleased 条目
```

**Structure Decision**: 变更集中在调度预设的提示词文本与一个工具描述；无数据模型与外部契约变更，省略 `data-model.md` 与 `contracts/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 宪章 III 要求用户可见行为变化更新 `README.md`，本变更不改 | 用户要求：D-006 限定文档只改 `docs/how-it-works.md` 与 `CHANGELOG.md` | 按宪章补一行 README 会超出用户给定的改动范围 |
