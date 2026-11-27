# Research: 被管理会话提问直接返回上报指令 S

日期：2026-11-27。排查基线为 `9d96e7b`，宿主依赖版本为 `0.2.2-rc.5`。

## R1 基线链路和 S

- 基线 `src/lark-super-agent/managed/ask-guard.ts:132-149` 在 `tools/pre-execute` 为接管放行；`:151-176,199-222` 在 `tools/execute` 跳过工具体，调用行装配提供的拦截回调。
- `src/lark-super-agent/managed/index.ts:86-99` 调用 `sendReport`，将题面和选项拼成 `kind=question`、`origin=ask_intercept` 的报告。投递成功后更新 `waiting_user` 并抑制 `turn_end` 进度上报。
- `ask-guard.ts:178-222` 调用 `exec.concludeTurn()`，由 `tools/post-execute` 给出已上报提示。投递失败时才排队，将 S 在 `agent/pre-step` 送给模型。
- S 是 `managed/task-rules.ts` 中的 `TASK_RULES_TEXT`。命名和一次性提醒的历史见 [053 设计](../053-managed-sessions/data-model.md) 与 [070 计划](../070-ask-question-interrupt/plan.md)。这里沿用 S 这项指令，将它作为新调用的结果正文。

## R2 宿主工具结果契约

- `tools/pre-execute` 的 `deny` 会走错误通道。沿用 `allow` 将合格的调用送给 `tools/execute`，略过宿主审批等待；保留其他钩子的 `deny` 和 `cancel`。
- `tools/execute` 环绕钩子不调用 `next()`，因此工具体不运行。宿主会校验并根据返回值重建成功结果；legacy 与 timed 模式都接受 `{ answers: [] }`。相关宿主代码与依据见 [070 研究 R1–R4](../070-ask-question-interrupt/research.md)。
- `tools/post-execute` 的 `accept` 可以覆盖模型可见内容。使用它返回固定 S，保留合法的空答案值。空数组表示没有实际用户答案；S 是插件指令。
- 此路径没有 `concludesTurn` 标记，当前轮次按常规宿主规则推进。同轮并行调用分别得到结果。
- PTC 的 `run_code` 绑定只返回结构化值。见 `dsh-tool-executor-ptc/src/ptc.ts:611-649`。S 通过直接调用的结果正文交给模型；结构化结果不伪造用户答案。

## R3 上报与停止

- 模型有自己的原始提问上下文，因此无需在 S 重复题面和选项。插件不记录待补投问题；用户停止时也无需额外处理这些内容。
- `send_report(kind=question)` 走现有报告流程。`src/sa-dispatch/prompt.ts` 定义 `question` 进入 `waiting_user` 的规则。历史 `ask_intercept` 类型依然可读。
- 轮次结束自动进度与失败通知继续独立运行。插件加载或会话被纳管时，已在等待的提问仍按既有机制结束；只有这类取消才需要 `agent/pre-step` 的一次性 S 提醒。
