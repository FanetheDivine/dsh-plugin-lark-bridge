# Implementation Plan: 归档通知改为 pre-step 注入并补充调度信号分层文档

**Branch**: `feat/075-prestep-archive-notice` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/075-prestep-archive-notice/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

决策编号沿用规格 D-001..D-012；实现层面的取舍见 [research.md](./research.md)。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 归档通知在调度会话下次运行前不可见；工作区切换后旧工作区的待注入记录不再注入；注入依赖事件日志确认，崩溃窗口内至多重复一次。 | Reason: 用户要求「都按推荐，自行推进至合并 PR」，免中途确认。

## Summary

`<task_session_archived>` 从即时 `steer` 改为「持久化待注入记录 + 下一次 `agent/pre-step` 注入」：

- 归档时仍立即以 `session_archived` 结束任务，并把待注入记录写入调度工作区的 `archive-notices.json`。
- `TaskLogInjector` 在调度会话 pre-step 时读出待注入记录，与任务日志合成同一条注入消息，顺序为任务快照、日志条目、归档通知。
- 已注入判定沿用事件日志扫描：块带 `id` 属性，扫描到该 `id` 后删除记录；没扫描到就下次继续注入。
- `session_restore` 恢复任务时删除该任务的待注入记录。
- 调度会话提示词改为「不因它通知用户」。
- 新增 `docs/dispatch-signals.md`，按紧急、重要、日志三类列出成员与投递方式。

## Technical Context

**Language/Version**: TypeScript（Node ≥ 22，ESM）

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5（与宿主同版本，宪章 I）；不新增依赖

**Storage**: 调度工作区新增 `archive-notices.json`；沿用 `message-task-status.json`、`task-logs/`、`archive/<taskId>/`

**Testing**: vitest（`tests/helpers.ts` 模拟 ctx）；`pnpm build` 末尾的 `test:dist` 回归产物

**Target Platform**: DSH 宿主进程内

**Project Type**: 单包 DSH 插件

**Performance Goals**: 无新增吞吐要求；每次 pre-step 读取一个记录文件

**Constraints**: 归档不唤起调度会话；注入消息与任务日志共用一次 pre-step；记录删除以事件日志为准

**Key Dependencies**: `agent/pre-step` 注入（`managed/index.ts:157-176`）、`session/event` 扫描（`task-log-injector.ts:91-119`）、`runSerial` 与 `commitFilesInQueue`（`git.ts`）

## Constitution Check

| 条款 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增、不改动 `@deepseek-ai/*` 版本 |
| II. 测试同步 | 通过 | `managed-task-log.test.ts` 增加归档通知注入、去重、重启、恢复用例；`lark-super-agent-service.test.ts` 改归档通知断言；`lark-super-agent-blocks.test.ts` 与 `sa-dispatch.test.ts` 同步块形态与提示词 |
| III. 文档结构 | 通过 | 新增 `docs/dispatch-signals.md`；更新 `docs/how-it-works.md`、`docs/known-risks.md`、`README.md` 与 `AGENTS.md` 文档索引 |
| IV. 质量门禁 | 通过 | 每阶段 `pnpm format && pnpm check`，收尾 `pnpm build` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与占位符 |

Complexity Tracking：无需偏离记录。

## Phase 0: Research

见 [research.md](./research.md)。要点：

1. 注入通道复用 `TaskLogInjector`：一次 pre-step 只多一条消息，去重逻辑已在扫描事件日志。
2. 持久化放调度工作区文件，`runSerial` 串行；`state.json` 由主行独占，跨行写入会与主行缓存冲突。
3. 已注入判定用块内 `id`；扫描来源为 `lark-task-log` 的消息，记录在扫描后删除。
4. `archive-notices.json` 与任务日志一样不做每次提交，避免噪声；归档目录删除与恢复提交不受影响。

## Phase 1: Design

### 结构

- `src/lark-super-agent/archive-notices.ts`（新增）
  - `ARCHIVE_NOTICES_FILE = 'archive-notices.json'`。
  - `ArchiveNotice { id, taskId, sessionId, time }`，`id` 为 `<taskId>:<time>`。
  - `readArchiveNotices(root)`、`appendArchiveNotice(root, notice)`、`removeArchiveNotices(root, predicate)`：全部在 `runSerial(root)` 内读写，文件缺失按空列表。
- `src/lark-super-agent/blocks.ts`
  - `taskSessionArchived` 增加 `id` 属性。
- `src/lark-super-agent/service.ts`
  - `notifyArchived`：结束任务后追加待注入记录；没有工作区时只记日志。
  - `restoreSession`：恢复任务成功后删除该任务的待注入记录，失败记 warning。
- `src/lark-super-agent/managed/task-log-injector.ts`
  - `ScanState` 增加已注入归档 `id` 集合。
  - `build` 追加待注入归档通知块；没有新日志但有通知时也返回消息。
  - 扫描后删除已出现的记录；失败只记日志。
- `src/lark-super-agent/managed/index.ts`
  - 给 `TaskLogInjector` 传 `logger`。
- `src/sa-dispatch/prompt.ts`
  - 归档段改为「随下次注入到达，不要因它通知用户」。

### 状态与文案

注入消息来源保持 `lark-task-log`，宿主已按非用户消息渲染。归档块 `<task_session_archived id="…" sessionid="…" taskid="…"/>`。

## Phase 2: Tasks 预览

见 [tasks.md](./tasks.md)：存储与归档接线、注入与去重、提示词与文档、质量门禁。