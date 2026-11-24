# Feature Specification: 调度会话提示词精简与默认派发

**Feature Branch**: `feat/045-dispatch-prompt-concise`

**Created**: 2026-11-24

**Status**: Approved

**Input**: User description: 修改 SA-调度会话系统提示词：语句简短、只说结论；指令默认视为开新会话的独立任务；指令默认在工作区执行，不知道工作区时报告「我不知道在哪个工作区」。

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [D-001] Q: 提示词在哪里？ -> A: `src/sa-dispatch/prompt.ts` 的 `SA_DISPATCH_PROMPT`，由 `src/sa-dispatch/index.ts` 注册为系统提示词段。
- [D-002] Q: 回复风格如何约束？ -> A: 新增 `Reply style` 一节：只说结论、保持简短，不用礼貌用语、实现细节、无意义的疑问与建议。
- [D-003] Q: 会话复用如何处理？ -> A: 默认每个任务新建 `sa-worker` 会话；只有用户明确要求才复用，无法判断时询问用户。取代「确认复用候选会话」。`task_candidates` 仅用于查找用户要求复用的会话。
- [D-004] Q: 执行位置如何处理？ -> A: 默认交给工作区的工作会话；仅用户明确要求时调度会话亲自执行。不建议由调度会话执行。
- [D-005] Q: 工作区未知时怎么办？ -> A: 无匹配或多个匹配时不猜测、不执行，告知「我不知道在哪个工作区」并询问。取代「请用户登记工作区」。
- [D-006] Q: 其余机制是否保留？ -> A: 保留任务分类、三类笔记、置顶、归档、上报处理与在场渠道规则。

## Review Record

- 2026-11-24 | Decision: Waived | Scope: current full document | Open items: none | Risks: 需求由派发会话转述用户意图，未逐项访谈

## Requirements

- **FR-001**: 提示词 MUST 含 `Reply style` 一节，约束对用户的回复简短、只说结论。
- **FR-002**: 提示词 MUST 默认新建工作会话，仅在用户明确要求时复用，不确定时询问用户。
- **FR-003**: 提示词 MUST 默认在工作区执行，仅在用户明确要求时由调度会话亲自执行。
- **FR-004**: 工作区未知时，提示词 MUST 要求回复「我不知道在哪个工作区」，不自行执行，不把调度会话纳入建议。
- **FR-005**: 提示词 MUST 保留 task、notes、pin、archive 与上报处理规则，且条款之间无矛盾。
