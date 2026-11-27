# Implementation Plan: 任务会话消息不含会话元信息

**Branch**: `feat/076-task-message-metadata` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/076-task-message-metadata/spec.md`

**Status**: Waived

## Open Decisions

None。实现决策按推荐写回，用户授权免确认自行推进。

## Clarifications

### Session 2026-11-27

- [P-001] Q: 约束文字落在提示词哪些小节？ -> A: 「Add messages to a task」加两条总约束；「Start a task」的 prompt 句只留任务请求；「Change a session's model」补一句切换不通知任务会话。
- [P-002] Q: 测试如何固定？ -> A: `tests/sa-dispatch.test.ts` 新增一个用例断言元信息约束与 `its target workspace` 消失；现有断言保持。
- [P-003] Q: 文档落点？ -> A: `docs/how-it-works.md` 调度提示词段落加一条约束；`docs/known-risks.md`「被管理会话与调度消息」加一条残余风险。
- [P-004] Q: CHANGELOG 何时加条目？ -> A: 分支在 push 或 merge 时加，随 `speckit-worktree-finish` 执行。
- [P-005] Q: 是否做真实宿主端到端验证？ -> A: 不做。纯提示词文案变更，由文本断言固定；残余风险记入 known-risks。用户需要时可用 `real-device-test` 技能验证。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 约束靠提示词遵守，无运行期过滤；未做真实宿主端到端验证。 | Reason: 用户选择「都按推荐，免确认自行推进」。

## Summary

调度会话写入任务会话的文字只表达任务本身与用户原话。会话元信息（模型路由与切换、上一轮失败原因、工作区与工作目录、会话 id）由宿主提供或省略。落点为 `SA_DISPATCH_PROMPT` 文案、`tests/sa-dispatch.test.ts` 断言与两份 docs。

## Technical Context

**Language/Version**: TypeScript，tsdown 构建

**Primary Dependencies**: 无新增；提示词为纯字符串常量

**Storage**: N/A

**Testing**: vitest（`pnpm test:code`），biome（`pnpm check`）

**Target Platform**: DSH 宿主内的 Cordis 插件

**Project Type**: 插件

**Performance Goals**: N/A

**Constraints**: 提示词小节顺序与现有测试断言保持兼容

**Scale/Scope**: 1 个提示词常量、1 个测试文件、2 份文档

## Constitution Check

| 原则 | 结果 | 说明 |
| --- | --- | --- |
| I 宿主依赖版本 | 通过 | 无依赖变更 |
| II 测试同步 | 通过 | 新增提示词断言用例；纯文案变更，不做运行期行为测试；e2e 为 SHOULD，本次不做，风险已记录（P-005） |
| III 文档结构 | 通过 | 机制归 how-it-works，风险归 known-risks，互不复述；README 无用户可见行为变化 |
| IV 质量门禁 | 通过 | 实施后运行 `pnpm format && pnpm check` |
| V 公开引用 | 通过 | 提交文件只含仓库内路径与包名 |

## Project Structure

### Documentation (this feature)

```text
specs/076-task-message-metadata/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md
```

### Source Code (repository root)

```text
src/sa-dispatch/prompt.ts      # SA_DISPATCH_PROMPT 文案
tests/sa-dispatch.test.ts      # 提示词断言
docs/how-it-works.md           # 调度提示词段落
docs/known-risks.md            # 残余风险
```

**Structure Decision**: 只改既有文件，无新增模块。contracts/ 省略：纯内部文案变更，无外部接口。

## 设计

### 提示词目标文案

「Start a task」的 session_create 句：

```text
Create the session with session_create. Pass workspace_id, a title, a prompt, and the user's message_id. The prompt holds only this task's request; leave out conclusions and content from other tasks.
```

「Add messages to a task」新增两条：

```text
- Write only the task itself into a task session: the work to do, the user's own words, or the question to answer. This applies to session_create's prompt, session_send's text, and task_update add_message alike.
- Leave session metadata out of that text: the session's model route and model switches, the previous turn's failure and its cause, its workspace and working directory, and its session id. The host gives the session its working directory, and model switches arrive as the host's [model changed: ...] notice. The user's own words pass through as they are; concrete file paths the task needs, such as report and attachment paths, stay in.
```

「Change a session's model」的「Tell the user the new route.」句后补：

```text
Send the task session nothing about the switch.
```

### 测试

新增用例「提示词禁止向任务会话暴露会话元信息」：

- `section('Add messages to a task')` 含 `Leave session metadata out`、`model route`、`working directory`、`session id`、`[model changed: ...]`。
- `section('Add messages to a task')` 含 `task_update add_message alike` 与 `user's own words pass through as they are`。
- `section('Start a task')` 含 `The prompt holds only this task's request`。
- `SA_DISPATCH_PROMPT` 不含 `its target workspace`。
- `section("Change a session's model")` 含 `Send the task session nothing about the switch`。

### 文档

- `docs/how-it-works.md`：在「发往任务会话的消息只有两类」一条后加一条，写明元信息约束、宿主事实来源、用户原话照转与任务所需路径照常。
- `docs/known-risks.md`「被管理会话与调度消息」：加一条「元信息约束靠调度模型遵守提示词；插件不做运行期文字过滤，模型仍可能把元信息写进任务会话。」

## Complexity Tracking

无宪章偏离。