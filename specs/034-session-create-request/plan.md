# Implementation Plan: 修复桥接会话创建请求

**Branch**: `fix/034-session-create-request` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/034-session-create-request/spec.md`

**Status**: Approved

## Open Decisions

| ID | 问题 | 结论 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| 无 | 待确认决策已全部回答 | - | - | - |

## Clarifications

### Session 2026-11-21

- [I-001] Q: 创建请求保留哪些字段？ -> A: `{ workspaceId, agentPreset? }`，去掉 `cwd` 与 `sessionId`。
- [I-002] Q: `SessionController` 类型是否收缩？ -> A: 收缩到新字段，传错字段编译报错。
- [I-003] Q: 单测断言方式？ -> A: 断言请求键集不含 `cwd` 与 `sessionId`。
- [I-004] Q: 文档范围？ -> A: 更新 `docs/how-it-works.md` 与 `CHANGELOG.md`，不回改 031。
- [I-005] Q: 合并后发布？ -> A: 执行 `pnpm run release` 发布 `0.1.5`。
- [I-006] Q: 实机验证？ -> A: 不验证，用户豁免。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 未在真实宿主验证；已失败批次的消息不会重投；宿主缺少 sessionController 时走 agents.create 分支

## Summary

插件 0.1.4 新建桥接会话时向宿主 `sessionController.create` 同时传 `workspaceId` 与 `cwd`。DSH 0.2.2-rc.5 的 `session/create` 要求二者互斥，调用抛 `session.create accepts workspaceId or cwd, not both`，整批消息注入失败，状态文件仍指向已归档的旧会话，用户看不到新会话。

修复只改创建请求：定位只用 `workspaceId`，移除宿主忽略的 `sessionId`，保留可选 `agentPreset`；模型仍在校验后写入新会话。同步收缩类型、更新单元测试与机制文档。真实宿主验证由用户豁免，风险记录在案。

## Technical Context

**Language/Version**: TypeScript 6.0，Node.js 24

**Primary Dependencies**: `@deepseek-ai/dsh-api-session-controller`、`@deepseek-ai/dsh-workspace`、`@deepseek-ai/dsh-agent`，版本 `0.2.2-rc.5`

**Storage**: 插件状态文件 `~/.dsh/lark-bridge/state.json`

**Testing**: vitest（`tests/sessions.test.ts`）；真实宿主验证经用户豁免

**Target Platform**: DSH 宿主（Windows 桌面版，`0.2.2-rc.5`）

**Project Type**: DSH 插件（单包 TypeScript 库）

**Performance Goals**: 新建会话与注入不引入额外等待；沿用 15 秒静默窗口

**Constraints**: 保持 032 的失败处理（整批丢弃、只写日志）与 031 的预设、模型、标题、置顶语义

**Scale/Scope**: 单工作区、单桥接会话

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不改依赖版本；修复对齐已锁定的 `0.2.2-rc.5` 契约 |
| II. 测试同步 | PASS | 更新 `tests/sessions.test.ts` 并增加请求形状断言；真实宿主验证经用户豁免，风险记录在案 |
| III. 文档结构 | PASS | 行为变化写入 `docs/how-it-works.md#会话` 与 `CHANGELOG.md`；README 无用户可见变化 |
| IV. 质量门禁 | PASS | 每步执行 `pnpm format && pnpm check`；合并前 `pnpm check` |

## Project Structure

### Documentation (this feature)

```text
specs/034-session-create-request/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/session-creation.md
├── checklists/requirements.md
└── tasks.md（由 /speckit-tasks 生成）
```

### Source Code (repository root)

```text
src/
├── sessions.ts          # 新建会话请求与会话装配
└── constants.ts         # 固定标题与静默窗口

tests/
└── sessions.test.ts     # 创建、复用、预设与失败路径

docs/
└── how-it-works.md      # 会话机制
```

**Structure Decision**: 沿用单包结构。改动集中在 `src/sessions.ts` 的创建请求与 `tests/sessions.test.ts` 的模拟控制器。

## Complexity Tracking

无宪章违规项。

## 变更点

| 文件 | 改动 |
| --- | --- |
| `src/sessions.ts` | `SessionController.create` 请求与类型改为 `{ workspaceId, agentPreset? }`，去掉 `cwd` 与 `sessionId` |
| `tests/sessions.test.ts` | 模拟控制器记录请求；新增「请求只含工作区标识」断言；标题测试改用模拟目录 |
| `docs/how-it-works.md` | 会话一节写明定位只用工作区标识 |
| `CHANGELOG.md` | 记录修复条目 |

## 验证

- 单元：`pnpm run test:code -- sessions`。
- 全量：`pnpm format && pnpm check && pnpm build`。
- 实机：不执行。真实宿主验证经用户豁免，风险是宿主契约再次漂移时只能靠单元测试发现。