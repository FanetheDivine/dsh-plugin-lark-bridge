# Implementation Plan: 加入管理时自动上报会话最后文本

**Branch**: `fix/080-session-manage-auto-report` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/080-session-manage-auto-report/spec.md`

**Status**: Approved

## Open Decisions

无。实现选择由代码库探索确定，见 `Clarifications`。

## Clarifications

### Session 2026-11-27

- [D-001] Q: 接管上报的判定放在哪里 -> A: 放在轮次上报观察器 `TurnReporter`。它已观察全部会话事件，并持有每轮文本、是否调用过 `send_report` 与结束原因；接管时重放同一判定，无需新增会话历史读取。
- [D-002] Q: 为什么接管时没有上报 -> A: `turn/end` 时观察器删除轮次状态；该轮在未管理时结束时 `finish` 直接返回，状态已丢失，接管后无法补发。
- [D-003] Q: 并发上报如何串行 -> A: `TurnReporter` 增加每会话 Promise 队列，`finish` 与接管补发都排入同一队列；轮次结束先观察到时先执行，接管后执行。
- [D-004] Q: 如何避免接管与轮次结束对同一轮各投递一次 -> A: 轮次状态保留，记录该轮已投递到的任务标识；接管补发在同一任务上发现该标识即跳过。标记按任务标识，不按正文内容。
- [D-005] Q: 服务如何触发补发 -> A: 服务新增一个补发回调设置项；`managed/index.ts` 在装配时把 `TurnReporter.catchUp` 交给服务；`manageSession` 在 `createTask` 之后 `await` 补发并吞掉异常，`session_create` 的建任务路径不触发补发。
- [D-006] Q: 轮次状态保留多久 -> A: 保留到下一次 `turn/start` 覆盖；每个会话最多一条，内存占用与轮次无关。
- [D-007] Q: 测试如何覆盖并发 -> A: 在 `tests/managed-turn-report.test.ts` 用可控的 `managedTask`/`sendReport` 延迟制造「轮次结束已排队、接管先建立任务」的交错；在 `tests/lark-super-agent-service.test.ts` 覆盖 `manageSession` 触发补发的接线与失败场景。
- [D-008] Q: 文档更新范围 -> A: `docs/how-it-works.md` 的「被管理会话能力」与「上报投递与失败监听」两处补充接管补发；`README.md` 工具说明保持不变。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 插件加载前已结束的轮次不补发；并发去重依赖会话内串行队列 | 用户指示：自行推进，合并 PR

## Summary

修复 `session_manage` 接管会话后缺少最后文本自动上报的缺陷。根因是轮次上报观察器在 `turn/end` 时清空轮次状态，未管理会话的该轮因此既不投递也不留痕。修复让观察器保留最后轮次状态（结束原因、文本、是否上报、已投递任务），接管时以同一判定重放并投递 `progress` 上报；同时用每会话串行队列与任务标识标记，避免与同轮 `turn/end` 上报重复。

## Technical Context

**Language/Version**: TypeScript（ESM，Node >= 24.9）

**Primary Dependencies**: `@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-tools`（版本与宿主对齐，0.2.2-rc.5）

**Storage**: 调度工作区文件（`message-task-status.json`、`reports/`、`task-logs/`），经现有 `NotesStore`、`ReportStore` 写入；本次不改格式

**Testing**: vitest（`pnpm run test:code`），单元测试使用 `tests/helpers.ts` 的 `makeCtx`

**Target Platform**: DSH 宿主插件（Windows/macOS/Linux）

**Project Type**: 单一 TypeScript 库（插件），源码在 `src/`，测试在 `tests/`

**Performance Goals**: 接管时增加一次内部判定与一次既有上报存档/投递；不增加会话历史扫描

**Constraints**: 不改 `session_manage` 工具结果、错误文案与上报文件格式；不新增来源标记

**Scale/Scope**: 每会话一条保留轮次状态；改动 `src/lark-super-agent/managed/turn-report.ts`、`src/lark-super-agent/managed/index.ts`、`src/lark-super-agent/service.ts`、`src/lark-super-agent/api.ts` 与相关测试、文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 条款 | 结果 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级 `@deepseek-ai/*` 依赖 |
| II. 测试同步 | PASS | 计划新增接管补发、并发与失败场景的单元测试；无宿主装载变化，无需实机回归 |
| III. 文档结构 | PASS | 机制细节只写 `docs/how-it-works.md`；`README.md` 不涉及工具细节；分支推送时补 CHANGELOG 条目 |
| IV. 质量门禁 | PASS | 提交前运行 `pnpm format && pnpm check`，合并前 `pnpm check` |
| V. 公开引用 | PASS | 文档与 spec 只使用仓库内相对路径 |

复核（Phase 1 后）：PASS，设计未引入依赖、格式或文档归属变化。

## Project Structure

### Documentation (this feature)

```text
specs/080-session-manage-auto-report/
├── plan.md              # 本文件
├── research.md          # Phase 0
├── data-model.md        # Phase 1
├── quickstart.md        # Phase 1
├── checklists/
│   └── requirements.md
└── spec.md
```

### Source Code (repository root)

```text
src/lark-super-agent/
├── api.ts                        # 服务接口：新增补发回调设置项
├── service.ts                    # manageSession 建任务后触发补发
└── managed/
    ├── index.ts                  # 装配：把 TurnReporter.catchUp 交给服务
    └── turn-report.ts            # 轮次状态保留、每会话串行队列、补发判定

tests/
├── managed-turn-report.test.ts   # 补发条件、并发与重复场景
├── lark-super-agent-service.test.ts # manageSession 接线与失败场景
└── managed-*.test.ts             # 现有被管理会话能力回归

docs/how-it-works.md              # 被管理会话能力与上报投递说明
```

**Structure Decision**: 沿用现有单一库结构；补发逻辑属于被管理会话能力，放在 `managed/turn-report.ts`，服务只负责在接管入口调用。

## Complexity Tracking

无 Constitution Check 违规。