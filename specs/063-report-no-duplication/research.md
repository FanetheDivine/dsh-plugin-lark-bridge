# Research: 上报之后正文只作简短收尾

**Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

## R-01 文案落点

**Decision**: 只改三处文本常量，代码行为零变更。

**Rationale**: 任务会话没有插件常驻提示词。`session_create` 的预设取配置的「任务会话预设」，由宿主提供；插件向被管理会话稳定暴露的约束只有 `send_report` 的工具描述。提问被拦后注入的临时指令 S 是第二处，调度会话提示词的 `## Handle reports` 段是第三处，负责转述侧。

**Alternatives considered**:

- 新增向被管理会话每轮注入的常驻规则消息。落选原因：为一句写作要求长期占用上下文，且与 `agent/pre-step` 既有职责重叠。
- 在调度会话写出的任务首条提示里嵌入要求。落选原因：由模型自由生成，覆盖不稳定，且与 062 正在改的 `## Start a task` 段落冲突。

## R-02 工具描述的送达表述

**Decision**: 说明上报已送达调度会话并转给用户，正文属额外一份。措辞限于送达事实。

**Rationale**: 用户要求措辞不提「专用卡片」等展示形态。上报展示由 061 单独修复，本处措辞对展示形式中立，两个 PR 互不依赖。

## R-03 收尾要求的上限

**Decision**: 「at most one short closing line」，正文留空同样符合；上报已包含的结论、清单、提交与 PR 信息、问题只写在上报里。

**Rationale**: 用户要求一句收尾即可，正文留空作为可选项保留。实测 28 次调用中 13 次的收尾句相似度低于 0.3、长度 41 至 182 字，属该规则允许的范围；7 次 900 字级复述属要消除的形态。

## R-04 测试方式

**Decision**: 在 `tests/lark-super-agent-index.test.ts` 增加一条对 `SEND_REPORT_DESCRIPTION` 与 `TASK_RULES_TEXT` 的形式断言，在 `tests/sa-dispatch.test.ts` 的 `Handle reports` 用例增加断言与旧措辞消失断言。

**Rationale**: 宪章 II 要求测试验证真实行为、不复述文案。本改动的交付物本身就是文本策略，可验证的是形式：收尾上限、送达事实、内容归属三类短语是否出现，以及含糊旧句是否消失。`tests/sa-dispatch.test.ts` 对各提示词段落已有同型的形式断言，060 与 062 沿用该方式。`turn_end` 与投递链路的行为零变更由既有用例保证，无需新增。

**Alternatives considered**: 只做实机观测、不加断言。落选原因：措辞会被后续改动无声删除，缺少回归保护。

## R-05 上报失败时的例外

**Decision**: 工具描述增加一句：上报未送达时内容继续写在正文。

**Rationale**: 未被管理与参数校验失败的调用不投递，此时正文是用户可见的唯一渠道。规格 FR-010 已把它写成需求，边界来自实测一例：调用因 `files` 含非 `.md` 路径失败后重试成功。

## R-06 文档归属

**Decision**: 更新 `docs/how-it-works.md` 被管理会话能力表的 `send_report` 行与 S 说明一句，`CHANGELOG.md` 增加 Unreleased 条目。`README.md` 与 `docs/known-risks.md` 不改。

**Rationale**: 宪章 III 规定每条信息只有一个归属文档。上报机制归 `docs/how-it-works.md`；`README.md` 当前不含上报与 `send_report` 的任何描述，为一句写作规则引入新章节属扩大范围。`docs/known-risks.md` 已有「自动上报取该轮最后一条助手文本」的风险条目，本次行为不变，风险表述照旧成立。

## R-07 效果度量

**Decision**: 合并后沿用调查脚本口径复核：遍历会话日志，取 `send_report` 调用，比较同轮后续正文与上报文本的相似度；基线为 28 次调用中 7 次 ≥ 0.5。

**Rationale**: 规格 SC-001 与 SC-002 需要与基线同口径才可比较。度量属事后复核，不进仓。
