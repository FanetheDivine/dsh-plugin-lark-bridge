# Implementation Plan: 上报先存档后投递、调度会话归档即重建与未读补投

**Branch**: `fix/071-report-archive-delivery` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/071-report-archive-delivery/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- 实机验证方案：在隔离 profile 中扩展 `real-device-test` 的 mock provider 与驱动，直接调用 `larkSuperAgent.sendReport` 与 `send_report` 工具，断言会话事件、工作区文件与 git 提交。
- `SendReportResult` 的 `reportId` 与 `reportPath` 在已存档结果中出现；无工作区结果只有 `delivered` 与 `reason`。`send_report` 输出 schema 把这两个字段标为可选。
- 投递队列与创建单飞都在进程内实现，宿主只有单一插件实例。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 投递语义为至少一次，极端并发下同一报告可能重复列出；解归档不写回桥接状态；新建或重试失败时报告停在未读状态，等待下次投递补投；实机验证依赖宿主 `resolveAgent` 的 `session/not-found` 错误码。

## Summary

把 `send_report` 的执行顺序改为「存档 → 提交 → 唤起或新建调度会话 → 投递」，投递失败保留存档并返回未送达结果。已归档的调度会话按不存在处理，飞书注入与上报路径都新建会话。任务台账记录 `deliveredReportIds`，每次投递块列出全部未读报告并要求先读。投递按工作区串行，新建调度会话单飞，投递前复核归档状态并重试一次。

## Technical Context

**Language/Version**: TypeScript（Node ≥ 22，ESM）

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5（宿主同版本，宪章 I）

**Storage**: 调度工作区 `message-task-status.json`（新增 `deliveredReportIds`）与 `reports/<taskId>/*.md`；桥接状态 `state.json`

**Testing**: vitest（`tests/helpers.ts` 模拟 ctx）；实机验证走隔离 profile 与 mock provider

**Target Platform**: DSH 宿主进程内（desktop/web 同一插件）

**Project Type**: 单包 DSH 插件

**Performance Goals**: 一次上报包含一次存档提交、一次状态读取与一次 `steer`；新增未读扫描按未结束任务数量线性

**Constraints**: 投递顺序等于存档顺序；同一工作区同时只有一个调度会话创建任务；投递失败不丢存档

**Key Dependencies**: `sessionController.resolveAgent` 的 `session/not-found` 错误码、`workspaceRegistry.archivedSessionIds`、`sessionController.create`、`agent.steer`/`followup`、`settleSteering`

## Constitution Check

| 条款 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不改动 `@deepseek-ai/*` 依赖与版本 |
| II. 测试同步 | 通过 | 扩展 `lark-super-agent-reports`、`lark-super-agent-service`、`lark-super-agent-blocks`、`lark-super-agent-notes`、`managed-task-log`、`managed-turn-report`、`lark-super-agent-index`；隔离 profile 实机覆盖六个场景 |
| III. 文档结构 | 通过 | `docs/how-it-works.md` 上报投递与任务快照两节、`README.md` 行为说明、CHANGELOG 按分支规则 |
| IV. 质量门禁 | 通过 | 每阶段 `pnpm format && pnpm check`，最后 `pnpm full-check` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与宿主包路径 |

Complexity Tracking：无需偏离记录。

## Phase 0: Research

见 [research.md](./research.md)。要点：

1. 宿主对不存在的会话返回 `{ error }`，`RemoteError.code` 为 `session/not-found`（`dsh-api-session-controller` 的 `resolve`）。
2. 投递顺序用「存档队列内登记投递 Promise，投递链按工作区串行」保证，存档不被投递阻塞。
3. 未读标记存任务台账，避免依赖调度会话的事件日志；存量任务按已读初始化。
4. 新建调度会话复用 `SessionManager.ensure`，在其外层加单飞；飞书注入与上报路径共用同一个 Promise。
5. `send_report` 输出 schema 放宽 `delivered` 与路径字段，客户端卡片仍只认 `delivered === true`。

## Phase 1: Design

数据模型见 [data-model.md](./data-model.md)。验证入口见 [quickstart.md](./quickstart.md)。

### 结构

- `src/lark-super-agent/api.ts`
  - `Task` 新增 `deliveredReportIds: string[]`。
  - `SendReportResult` 改为 `reportId?`、`taskId`、`reportPath?`、`delivered`、`reason?`、`warning?`。
- `src/lark-super-agent/notes.ts`
  - `taskSchema` 新增 `deliveredReportIds`，缺省为空数组；`normalizeTask` 对存量任务按 `reportIds` 初始化。
  - 新增 `markReportsDelivered(entries)`：工作区队列内合并编号、写台账并提交。
- `src/lark-super-agent/reports.ts`
  - `archiveReport` 在提交后调用投递回调，不再在提交前投递；返回 `ArchivedReport` 携带 `delivery?: Promise<DeliveryOutcome>`。
  - 提交失败只记 `warning`，投递继续。
- `src/lark-super-agent/blocks.ts`
  - `taskSessionMessage` 新增 `unreadReports` 与 `snapshot`：输出 `<unread_reports>`、`<task_snapshot>` 与「先读任务与全部报告」的说明。
- `src/lark-super-agent/service.ts`
  - `sendReport`：管理判定 → 无工作区结果 → 存档 → 等待投递结果。
  - `dispatchTarget(state)`：读归档列表；无标识、已归档、`session/not-found` 时调用 `ensureDispatchSession` 新建；其他解析错误返回未送达。
  - 投递链：按工作区串行，`deliverReport` 失败重试一次。
  - `unreadReports(root)`：读取台账，汇总所有未读编号与相对路径。
  - `markDelivered`：投递成功后写 `deliveredReportIds`；失败记 `warning`。
- `src/lark-super-agent/index.ts`
  - 通过 `larkBridgeSessions` 服务注入 `ensureDispatchSession`。
- `src/sessions.ts`
  - `ensure` 外层加按工作区单飞；新增 `ensureDispatchSession(root)` 供上报路径调用。
- `src/index.ts`
  - 提供 `larkBridgeSessions` 服务，转发 `sessions.ensureDispatchSession`。
- `src/lark-super-agent/managed/index.ts`
  - 提问拦截在 `delivered: false` 时抛错，触发既有拒绝回退；只在送达后置 `waiting_user` 与标记本轮已上报。
- `src/lark-super-agent/managed/turn-report.ts`
  - 未送达只记日志。
- `src/lark-super-agent/managed/task-log-injector.ts`
  - 快照新增 `<unread_reports>` 与先读说明。
- `src/sa-dispatch/prompt.ts`
  - 「Handle reports」要求先读任务与全部未读报告；`task_snapshot` 说明同步。

### 投递顺序

1. `sendReport` 调用 `archiveReport`，后者在工作区串行队列内写文件、改台账、提交。
2. 提交完成后 `archiveReport` 调用投递回调；回调把投递任务追加到该工作区的投递链并返回 Promise。
3. `sendReport` 在队列外等待该 Promise，得到送达结果。
4. 下一份存档在队列空闲后开始，它的投递追加在上一条之后，顺序与存档一致。

### 未读标记

- 未读 = `reportIds` 中不在 `deliveredReportIds` 的编号。
- 投递块列出所有任务的全部未读报告；新建会话时额外带任务快照。
- 投递成功后把这些编号合并进各任务的 `deliveredReportIds` 并提交。
- 标记失败只记 `warning`，下一次投递重复列出同一报告。