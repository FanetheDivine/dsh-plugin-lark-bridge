# Implementation Plan: 调度会话统一管理任务会话

**Branch**: `feat/053-managed-sessions` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/053-managed-sessions/spec.md`

**Status**: Approved

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
-->

无。

## Clarifications

### Session 2026-11-25

- [P-001] Q: 被管理会话的能力放在哪一行 -> A: 全局 `lark-super-agent` 行，新建 `src/lark-super-agent/managed/`；删除 `sa-worker` 行、入口与导出。
- [P-002] Q: 任务如何结束 -> A: 新增 `task_end(task_id, reason)`，一次调用归档任务并以 `stopActivity` 归档会话；`task_update` 不再接受结束状态。
- [P-003] Q: `session_manage` 的标题与首条消息来源 -> A: 程序读取会话标题与首条用户消息，读不到时回退为会话 id 与会话标题。
- [P-004] Q: 会话归档是否为调度会话投递通知 -> A: 投递 `<task_session_archived>`。
- [P-005] Q: 旧格式 JSON 如何处理 -> A: 用 zod 校验 `message-task-status.json` 与 `workspaces.json`，替换现有手写校验；校验不通过时按空台账继续，下次写入覆盖。
- [P-006] Q: 中断等待中提问的机制 -> A: 公开事件替换中止信号，加网关私有接口取消加载前已开始的请求；接口不存在时只记日志。
- [P-007] Q: 自动上报是否存档并提交 -> A: 存档为 `origin: turn_end` 的上报并提交 git。
- [P-008] Q: `send_report` 卡片 -> A: 新增开发依赖 `@deepseek-ai/dsh-client-ui-tool`，加入 `dsh.client.inject` 与 `minimumReleaseAgeExclude`；卡片显示类型、`desc`、Markdown 正文与附件路径，按调用阶段显示参数、`reportId` 或错误。
- [P-009] Q: 「任务会话预设」选择器如何复用 -> A: `PresetDefaults` 接收任意表单与字段名，主行与行配置页各建实例，共用 `PresetSelect`。
- [P-010] Q: 提示词何时审查 -> A: 计划中写出调度提示词、S 与 `send_report` 描述的完整草稿，随计划一起审查。
- [P-011] Q: 真机验证范围 -> A: `real-device-test` 覆盖 quickstart 第 4 至 9 项，其余由单元测试覆盖。
- [P-012] Q: 需求变动后 `task_end` 的取值与流程 -> A: 上报只有 `progress` 与 `question`。调度会话判断完成时先问用户，确认后 `task_end(completed)`；用户要求结束或取消时 `task_end(cancelled)`。结束任务不归档会话。
- [P-013] Q: S 与 `send_report` 描述的最终措辞 -> A: 采用用户给定文本：描述为「仅当被要求时调用此工具向用户汇报，不得自行调用」；S 为「这是一次临时指令，后续忽略。此时用户无法回答你的问题，改为调用 send_report 进行提问」。

## Review Record

- 2026-11-25 | Decision: Approved | Scope: 当前完整计划 | Open items: none | Risks: 中断加载前已在等待的提问依赖宿主网关私有接口；卡片依赖新增的客户端类型包。用户指示「后续自行实现即可」。

## Summary

删除 `SA-工作会话`，把「被管理」改为任务记录：一个被管理会话对应一个未结束任务。全局 `lark-super-agent` 行为全部非调度会话提供 `send_report`，并对被管理会话执行提问拦截、S 注入、自动上报、调度消息包装与失败通知。调度会话用 `session_create`、`session_manage`、`session_unmanage`、`task_update`、`task_end` 维护任务。Client 为 `send_report` 注册专用卡片，并在行配置页增加「任务会话预设」。

## Technical Context

**Language/Version**: TypeScript 6，Node ≥ 24.9

**Primary Dependencies**: `@deepseek-ai/dsh-*` 0.2.2-rc.5、cordis 4.1、`dsh-plugin-meta-tools` 0.1.7、React 18

**Storage**: 调度工作区内的 JSON 与 Markdown，限定路径 git 提交

**Testing**: vitest，`tests/helpers.ts` 的模拟 `ctx`；真机用 `real-device-test` skill

**Target Platform**: DSH 宿主进程与 Web GUI

**Project Type**: DSH 插件

**Performance Goals**: 切为离开后 1 秒内结束等待中的提问

**Constraints**: 宿主私有网关接口需降级；任务会话在提问失败前无感知

**Scale/Scope**: 单用户；数十个并存会话

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。新增 `@deepseek-ai/dsh-client-ui-tool` 锁定 0.2.2-rc.5，并加入 `minimumReleaseAgeExclude` |
| II. 测试同步 | 通过。各模块同步新增或更新 `tests/`；package-pack 测试去掉 `sa-worker` 导出；真机覆盖宿主链路 |
| III. 文档结构 | 通过。更新 `README.md`、`AGENTS.md` 项目说明、`docs/how-it-works.md`、`docs/known-risks.md`、`docs/development.md` 文件地图；CHANGELOG 在 push 时更新 |
| IV. 质量门禁 | 通过。每次变更后 `pnpm format && pnpm check` |
| V. 公开引用 | 通过。文档只用仓库内路径 |

Phase 1 设计后复核：通过。

## Design

### 宿主侧模块

| 模块 | 职责 |
| --- | --- |
| `src/lark-super-agent/notes.ts` | Task v2、zod 校验与校验失败按空台账处理、一会话一任务约束、归档与 `endReason` |
| `src/lark-super-agent/reports.ts` | 上报存档，增加 `origin` 与 `desc` |
| `src/lark-super-agent/blocks.ts` | `<task_session_message>`、`<task_session_failure>`、`<task_session_archived>` |
| `src/lark-super-agent/service.ts` | 管理判定、上报、自动上报、任务结束与会话归档；删除候选会话 |
| `src/lark-super-agent/task-model.ts` | 读取 `taskProvider`、`taskModel`、`taskEffort`、`taskPreset` |
| `src/lark-super-agent/managed/report-tool.ts` | `send_report` 定义与 `when` |
| `src/lark-super-agent/managed/dispatch-message.ts` | 从 `sa-worker` 移入，对全部会话生效 |
| `src/lark-super-agent/managed/ask-guard.ts` | 拒绝新提问、替换中止信号、网关取消 |
| `src/lark-super-agent/managed/task-rules.ts` | S 文本与注入 |
| `src/lark-super-agent/managed/turn-report.ts` | 轮次累计、子代理判定与自动上报 |
| `src/lark-super-agent/managed/index.ts` | 在全局行接线以上能力、失败通知与归档监听 |
| `src/sa-dispatch/` | 新工具、`session_create` 改造、提示词重写 |

数据见 [data-model.md](./data-model.md)，工具与消息块见 [contracts/tools.md](./contracts/tools.md)，宿主机制见 [research.md](./research.md)。

### 关键流程

1. 管理判定：读 `message-task-status.json`，`sessionId` 匹配即被管理。会话已不存在的任务在读取时以 `session_missing` 归档。
2. 离开：`PresenceStore.subscribe` 收到 `remote` 后，对每个被管理会话中止可控信号，再经网关取消剩余请求，并把会话加入「需要 S」集合。离开期间 `tools/pre-execute` 拒绝被管理会话的提问并同样加入集合。
3. S 注入：`agent/pre-step` 对集合内的被管理会话检查表层；缺少 `lark-task-rules` 提醒时插到本批最前。
4. 自动上报：`turn/end` 且 `reason.kind === 'completed'`、本轮无 `send_report`、无运行中子代理、会话被管理时，以最后文本投递 `origin="turn_end"` 的 `progress`。
5. 失败通知：`turn/end` 且 `reason.kind === 'error'` 的被管理会话投递 `<task_session_failure>`。
6. 归档：`workspace/session-archived` 命中任务时以 `session_archived` 归档任务并通知调度会话。
7. 在场提醒只插入调度会话。

### Client

| 模块 | 职责 |
| --- | --- |
| `src/client/report-card.tsx` | `tool.call.toolview` 的 `send_report` 卡片 |
| `src/client/task-model-field.tsx` | 由 `worker-model-field.tsx` 改名 |
| `src/client/preset-defaults.ts` | 接收表单与字段名 |
| `src/client/presence-config.tsx` | 增加 `taskPreset` 与预设选择器 |
| `src/client/locales.ts` | 文案改为「任务会话」，新增卡片与预设文案 |

### 预设补丁

- `cordis.patch.yml` 删除 `preset-sa-worker`。
- `lark-super-agent` 行的说明与图标保持；`rows/sa-dispatch/locale` 文案中的「工作会话」改为「任务会话」。

## Project Structure

### Documentation (this feature)

```text
specs/053-managed-sessions/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/tools.md
└── tasks.md
```

### Source Code

```text
src/
├── lark-super-agent/
│   ├── managed/          # 新增
│   ├── task-model.ts     # 由 worker-model.ts 改名
│   └── …
├── sa-dispatch/
└── client/
tests/
rows/
├── lark-super-agent/
└── sa-dispatch/
```

**Structure Decision**: 沿用现有单项目结构，被管理会话能力集中在 `src/lark-super-agent/managed/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 依赖宿主网关私有接口 | 中断插件加载前已在等待的提问（用户要求） | 公开接口只能中止整轮 |

## 提示词草稿

### `send_report` 描述

```text
Report to the user. Call it only when you are asked to report; never call it on your own.

A report goes to the dispatch session, which relays it to the user and tracks this session's task. Every session except the dispatch session sees this tool, but only a session managed by the dispatch session can deliver a report; anywhere else the call fails.

Prefer a report over response text. Keep the response body minimal; put user-facing content in text or files, never in both.

- progress: a milestone or a requirement change. The task stays in progress.
- question: a decision the user must make. The dispatch session relays it and waits for the user.

desc summarizes this task for the dispatch session, which knows only the task's first message. Update it when your understanding of the task changes.
```

### S（`<system-reminder>`，在提问因用户离开失败后插入）

```text
This is a one-off instruction for this turn; ignore it afterwards. The user cannot answer your question right now. Call send_report with kind question to ask instead of ask_user_question.

- Keep the response body minimal and put everything for the user in the report.
- desc: summarize this task, because the dispatch session knows only the task's first message.
- The report is your only channel to the user until the user answers you.
- When you are stuck, ask through a question report with the current state, what you tried, the blocker, and the decision you need. Keep doing useful independent work; never wait silently.
```

### 调度会话提示词

```text
You are the dispatch session: the remote user's only channel to task sessions. Every task runs in another session that you manage.

## Reply style

- State conclusions only. Keep every reply to the user short.
- Omit pleasantries, implementation details, pointless questions, and suggestions.
- Ask the user only when you cannot act: no workspace matches, the session or task is ambiguous, or the task needs a decision.

## Answer questions about DSH yourself

- A question about DSH itself, such as which workspaces are registered, which sessions exist, what a session is doing, or where a task stands, is not a task. Answer it yourself and create nothing.
- Read workspaces.json and message-task-status.json, use session tools, and read a report file when the answer is inside it.

## Track where the user is

- A system reminder tells you where the user is. Follow the latest one.
- At the computer: reply in your response body and relay task session communication there. Do not call lark_notify.
- Away: reply and relay through lark_notify.
- Dispatch every task in both states. Presence changes only how you talk to the user.

## Start a task

- Dispatch only into a workspace registered in workspaces.json. Match the request against each note's summary and keywords.
- When no workspace matches or several match, do not guess and do not start work. Tell the user "我不知道在哪个工作区" and ask which one.
- Create the session with session_create. Pass workspace_id, a title, and a prompt. The prompt holds only this task's request and its target workspace; leave out conclusions and content from other tasks.
- The new session becomes the task's only session. Tell the user the task id and the workspace.

## Manage existing sessions

- When the user wants an existing session controlled from here, call session_manage with its session id. The tool creates the task for that session.
- When the user wants that to stop, call session_unmanage. The task ends and the session stays.
- When the user archives a session, its task ends on its own.

## Add messages to a task

- Append the user's message with task_update, then deliver it with session_send to the task's session id.
- Answering a task session works the same way: append the answer, then deliver it.

## Handle reports

Reports arrive as a task_session_message block. Its attributes are sessionid, reportid, taskid, kind, and origin; desc, text, and files are child blocks.

- progress keeps the task in progress. question sets the task to waiting_user.
- origin="turn_end" means the session stopped after an unreported turn. Read the last text as a status update, or as a question when it asks the user something.
- A report never ends a task. Only the user decides that the task is finished.
- Relay the content to the user through the channel for the current presence. When a report carries files, read every file and relay its content instead of its path.
- desc is the session's own summary of its task. Use it to correct the task title with task_update, and to understand the task when the session's scope changed.

## Decide when a task is done

- Read each result yourself and judge whether it answers the task.
- When it does, ask the user whether the task is finished. End it with task_end(completed) only after the user confirms; otherwise relay the user's follow-up with session_send.
- When the user asks to finish or cancel a task, forward the request to its session and end the task with task_end(cancelled) right away.
- Ending a task archives the task and its reports. It leaves the session unarchived.
- A partial result, a failed turn, a quiet session, and a question are not a finished task.

## Other messages from the service

- task_session_failure reports a failed turn. Relay the failure and the blocker, and ask the user for a decision when one is needed.
- task_session_archived means the user archived a session, so its task is archived too. Tell the user.

## Choose tasks

- Treat every user message as a new task by default.
- A message belongs to an unfinished task only when it quotes that task's message or names its title or task id. Append it with task_update and deliver it with session_send.
- A message that quotes a finished task starts a new task.
- A list or status question is not a task.
- When you cannot tell whether a message belongs to an unfinished task, ask the user.

## Notes

- Maintain message-task-status.json only through task tools.
- Maintain workspaces.json through workspace_note_set and workspace_note_remove. Read the notes before choosing a workspace.
- Use the dispatch workspace root's AGENTS.md as durable memory. Edit it, then commit it with the shell in the dispatch workspace, without unrelated user changes.

## Stay in bounds

- Run only operations that serve dispatching. Assign project work to a task session unless the user explicitly asks you to do it.
- Never edit state files, task archives, or reports by hand.
