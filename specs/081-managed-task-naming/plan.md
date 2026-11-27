# Implementation Plan: 接管会话的任务名基于会话标题生成

**Branch**: `fix/081-managed-task-naming` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/081-managed-task-naming/spec.md`

**Status**: Approved

## Open Decisions

无。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 会话标题从哪个宿主接口读取 -> A: `ctx.get('sessionTitle')` 的 `get(session)` 返回最新折叠标题。宿主 `Session` 没有 `title` 属性，标题只存在于 `session/title` 事件与投影中；现有 `agent.session.title` 读取恒为 `undefined`，这是任务名退回会话 id 的根因。
- [D-002] Q: 读取失败如何回退 -> A: 服务缺失、`get` 返回空或标题为空白时用会话 id；换行折叠与首尾去空白沿用现有实现，抽成小函数。
- [D-003] Q: 初始标题与生成名的关系 -> A: `manageSession` 先用会话标题建立任务，作为生成任务名的依据与失败兜底；调度会话随后用 `task_update` 写入生成的任务名。
- [D-004] Q: 提示词如何表述 -> A: 在 `## Manage existing sessions` 写明：`session_manage` 返回会话标题，基于它生成简短任务名并用 `task_update` 写入，命名与 `session_pin` 同一步；标题等于会话 id 时按用户描述命名或询问。
- [D-005] Q: 工具描述是否同步 -> A: 是，`session_manage` 的描述点明任务名取自会话标题。
- [D-006] Q: 测试如何覆盖真实宿主形态 -> A: 从测试会话对象移除伪造的 `title` 属性，改为注入 `sessionTitle.get` 的模拟；新增服务缺失、空标题、换行折叠的用例。
- [D-007] Q: 是否保留 `session.title` 读取作为兼容 -> A: 不保留。宿主类型没有该属性，保留会让测试继续伪造不存在的字段。仅保留 `sessionTitle` 服务与 id 两级。
- [D-008] Q: 文档更新位置 -> A: `docs/how-it-works.md` 的 `SA-调度会话` 小节增加命名规则条目；`CHANGELOG.md` 增加 Unreleased 条目。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 任务名由调度会话生成，遵循程度依赖提示词，无代码兜底 | 用户指示：自行实现 + 合并 PR

## Summary

修复接管会话后任务名退化为会话 id 的缺陷，并在调度提示词中补充命名规则。根因是 `service.ts` 读取宿主 `Session` 上不存在的 `title` 字段。修复改为经 `sessionTitle` 服务读取会话最新标题，规范化后作为任务初始标题；提示词要求调度会话据此生成简短任务名并用 `task_update` 写入。

## Technical Context

**Language/Version**: TypeScript（ESM，Node >= 24.9）

**Primary Dependencies**: `@deepseek-ai/dsh-session-title`（仅类型与运行时 `ctx.get`，不新增依赖，版本与宿主对齐 0.2.2-rc.5）

**Storage**: 调度工作区文件（`message-task-status.json`），经现有 `NotesStore` 写入；格式不变

**Testing**: vitest（`pnpm run test:code`），单元测试使用 `tests/helpers.ts` 的 `makeCtx`

**Target Platform**: DSH 宿主插件（Windows/macOS/Linux）

**Project Type**: 单一 TypeScript 库（插件），源码在 `src/`，测试在 `tests/`

**Performance Goals**: 接管时增加一次内存中的标题折叠读取，不增加会话历史扫描

**Constraints**: 不改任务台账格式、工具结果字段与错误文案；任务名的生成由调度会话完成

**Scale/Scope**: 改动 `src/lark-super-agent/service.ts`、`src/sa-dispatch/prompt.ts`、`src/sa-dispatch/tools.ts` 与相关测试、文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 条款 | 结果 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | `@deepseek-ai/dsh-session-title` 已在 devDependencies 且版本对齐；不新增或升级依赖 |
| II. 测试同步 | PASS | 更新 `manageSession` 用例为真实宿主形态，新增标题读取、回退与提示词断言；无宿主装载变化 |
| III. 文档结构 | PASS | 机制写入 `docs/how-it-works.md`；`README.md` 不描述该话术细节；分支推送前补 CHANGELOG |
| IV. 质量门禁 | PASS | 提交前运行 `pnpm format && pnpm check`，合并前 `pnpm check` |
| V. 公开引用 | PASS | 文档与 spec 只使用仓库内相对路径 |

复核（Phase 1 后）：PASS，设计未引入依赖、格式或文档归属变化。

## Project Structure

### Documentation (this feature)

```text
specs/081-managed-task-naming/
├── plan.md              # 本文件
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── checklists/
│   └── requirements.md
├── tasks.md
└── spec.md
```

### Source Code (repository root)

```text
src/
├── lark-super-agent/
│   ├── service.ts       # manageSession 读取会话标题
│   └── api.ts           # AgentLike / SessionLike 最小接口
└── sa-dispatch/
    ├── prompt.ts        # 调度提示词的命名规则
    └── tools.ts         # session_manage 描述

tests/
├── lark-super-agent-service.test.ts
└── sa-dispatch.test.ts
```

**Structure Decision**: 沿用单库结构，只改既有文件的读取来源、提示词文本与测试，不新增模块。
