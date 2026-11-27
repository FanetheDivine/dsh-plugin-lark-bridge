# Implementation Plan: 调度会话切换会话模型与恢复已归档会话

**Branch**: `feat/072-session-model-restore` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/072-session-model-restore/spec.md`

**Status**: Approved

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: 切换模型调用哪条宿主 API？ -> A: 直接调用目标 Agent 的 `agent.model.select`，不调用 `sessionController.selectModel`，避免改动全局默认模型。
- [D-002] Q: 切换前如何校验？ -> A: 调 `ctx.llm.resolveCallConfig`，与 `session_create` 一致。校验失败不改动会话。
- [D-003] Q: 两个新工具注册在哪个作用域？ -> A: 都注册在 `sa-dispatch` 子行。`session_model` 放在 `sessionController` 注入作用域内，`session_restore` 放在 `registerDispatchTools`。
- [D-004] Q: 恢复任务的实现放在哪？ -> A: `LarkSuperAgentService.restoreSession` 负责编排解除归档、任务恢复与置顶；`NotesStore` 负责归档任务的读取、迁回与台账写入。
- [D-005] Q: 归档任务如何定位？ -> A: 扫描工作区根下 `archive/*/task.json`，取该会话 `archivedAt` 最新的记录。
- [D-006] Q: 恢复写台账的顺序？ -> A: 先迁回报告目录与任务日志，再写台账，再删归档目录，最后按限定路径提交。
- [D-007] Q: 置顶失败如何呈现？ -> A: 不回滚，结果 `pinned: false` 并带 `warning`。
- [D-008] Q: 现有 `WorkspaceRegistryLike` 是否扩展？ -> A: 增加可选的 `pinSession`，与既有可选方法风格一致。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 恢复依赖归档目录中的 `task.json`；迁移目录期间失败会留下半完成状态，重试按幂等路径收敛。

## Summary

给 `sa-dispatch` 预增设两个工具。`session_model` 经宿主模型校验后，把指定会话的模型选择记录到该会话，从下一步生效。`session_restore` 解除归档，恢复因归档结束的任务（台账、报告目录、任务日志、git 提交），并按需恢复置顶。

## Technical Context

**Language/Version**: TypeScript 6.0，Node.js >= 24.9

**Primary Dependencies**: `@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-tools`、`zod`（均为现有依赖，不新增）

**Storage**: 调度工作区内的 JSON 台账与目录：`message-task-status.json`、`archive/<taskId>/`、`reports/<taskId>/`、`task-logs/<taskId>.jsonl`；写入后按限定路径 git 提交

**Testing**: `vitest` 单元测试（模拟 `ctx`），真实宿主端到端验证（`real-device-test` skill）

**Target Platform**: DSH 宿主 0.2.2-rc.5，Windows/Linux

**Project Type**: DSH 插件（单包，多入口）

**Performance Goals**: 单次工具调用只读一次台账与至多一次归档目录扫描

**Constraints**: 宿主类型只做 type-only 导入；工具参数用纯 JSON schema；不改变全局默认模型；台账写入沿用 `runSerial` 串行与原子替换

**Scale/Scope**: 两个新工具、一个服务方法、一个存储方法；不新增运行时依赖

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增或升级 `@deepseek-ai/*` 依赖，继续使用 0.2.2-rc.5 |
| II. 测试同步 | 通过 | 新增 `tests/session-model.test.ts`、扩展 `tests/lark-super-agent-service.test.ts`、`tests/lark-super-agent-notes.test.ts`、`tests/sa-dispatch.test.ts`，并做真实宿主验证 |
| III. 文档结构 | 通过 | 用户可见行为写入 `README.md`；工具与台账机制写入 `docs/how-it-works.md`；`CHANGELOG.md` 的 Unreleased 增加条目；注释只写职责 |
| IV. 质量门禁 | 通过 | 完成后运行 `pnpm format && pnpm check` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与公网 URL |

## Project Structure

### Documentation (this feature)

```text
specs/072-session-model-restore/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── session-model.md
│   └── session-restore.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── sa-dispatch/
│   ├── index.ts            # 注册两个新工具
│   ├── prompt.ts           # 提示词补充模型切换与恢复规则
│   ├── session-model.ts    # 新增：切换会话模型
│   └── tools.ts            # 新增 session_restore
└── lark-super-agent/
    ├── api.ts              # 新增 restoreSession 契约与 pinSession
    ├── notes.ts            # 新增 latestArchivedTask / restoreTask
    └── service.ts          # 实现 restoreSession

tests/
├── session-model.test.ts                  # 新增
├── sa-dispatch.test.ts                    # 工具注册与参数转换
├── lark-super-agent-notes.test.ts         # 归档任务读取与恢复
└── lark-super-agent-service.test.ts       # 恢复编排与置顶失败
```

**Structure Decision**: 沿用既有单包结构。工具定义在 `src/sa-dispatch`，存户与台账逻辑在 `src/lark-super-agent`，两侧通过 `api.ts` 的接口耦合。

## Complexity Tracking

无偏离项。