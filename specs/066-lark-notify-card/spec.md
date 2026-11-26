# Feature Specification: lark_notify 通知卡片与调度会话始终经 lark_notify 通信

**Feature Branch**: `feat/066-lark-notify-card`

**Created**: 2026-11-26

**Status**: Draft

**Change Category**: 插件变更

**Input**: User description: "为lark_notify增加与send_report类似的特殊ui 且在调度会话的系统提示词中说明 始终通过lark_notify与用户通信 text一句话概述即可。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
-->

- [ ] [D-001] Q: 通知卡片展示哪些字段、正文按什么形态呈现（保留换行的纯文本、Markdown 渲染或两者之一）？ | Depends on: none | Status: not asked
- [ ] [D-002] Q: 调度提示词的「Track where the user is」渠道选择段落如何处置；在场提醒是否停止注入调度会话？ | Depends on: none | Status: not asked
- [ ] [D-003] Q: 桥接提醒「其他来源的用户消息按普通方式回复，不调用 lark_notify」与「始终经 lark_notify 通信」矛盾，桥接提醒是否同步修改？ | Depends on: D-002 | Status: not asked
- [ ] [D-004] Q: 「text 一句话概述」约束的是 lark_notify 送达后的正文收尾，还是该会话全部正文输出；正文允许为空吗？ | Depends on: none | Status: not asked

## Clarifications

### Session 2026-11-26

（待 clarify 阶段填写）

## Review Record

- 待审查。

## 现状基线

探索结论，均有代码或文档佐证：

1. `lark_notify` 没有专用展示：成功时宿主默认工具行只显示一行「已发送给用户（N 条）」或「已回复给用户（N 条）」，发给用户的正文内容不在对话里直接呈现。
2. `send_report` 的特殊 UI 形态：成功的调用在轮次层级产出专用卡片，展示类型、任务简介、正文与附件；进行中、失败与中断沿用宿主默认工具行。
3. `lark_notify` 的参数为必填 `text` 与可选 `reply_to`；结果含 `ok`、分段数、首条 `messageId` 与 `replyTo`。
4. `SA-调度会话` 提示词按在场状态选择渠道：在电脑旁时在正文回复与转达且不调用 `lark_notify`，离开时经 `lark_notify`。
5. 桥接提醒规定：飞书消息经 `lark_notify` 回复、会话正文用户看不到；「其他来源的用户消息按普通方式回复，不调用 lark_notify」。调度会话同时受提示词与桥接提醒约束。
6. 在场提醒只注入调度会话；被管理会话的提问拦截由服务按在场状态执行，与调度会话提示词无关。
7. 调度会话转述上报的规则是「按当前在场渠道送达用户」。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 通知全文以卡片呈现 (Priority: P1)

用户在 GUI 里查看调度会话。调度会话调用 `lark_notify` 成功后，对话中出现一张通知卡片，用户不展开工具行就能读到这次发给用户的完整内容与投递回执。

**Why this priority**: 当前对话里只能看到「已发送给用户（N 条）」一行，发给用户的内容在会话内不可见，复盘与核对都要去飞书翻消息。这是需求的核心缺口。

**Independent Test**: 在桥接会话里调用一次 `lark_notify` 发送带换行的较长文本，在 GUI 中查看该轮的展示形态。

**Acceptance Scenarios**:

1. **Given** 一次成功的 `lark_notify` 调用，**When** 用户查看该轮，**Then** 出现通知卡片，内容为这次发给用户的完整正文（形态见 D-001）。
2. **Given** 一次成功的 `lark_notify` 调用，**When** 用户查看卡片，**Then** 卡片显示投递回执：发送或回复、分段数，`messageId` 存在时一并显示（字段取舍见 D-001）。
3. **Given** 该轮过程分组已折叠，**When** 用户查看，**Then** 通知卡片默认可见，不被折叠收起。
4. **Given** 一次带 `reply_to` 的成功调用，**When** 用户查看，**Then** 卡片表明这是一次回复。
5. **Given** 历史轮次加载出 `lark_notify` 的成功结果，**When** 用户查看，**Then** 同样显示通知卡片。

---

### User Story 2 - 调度会话始终经 lark_notify 与用户通信 (Priority: P1)

调度会话面向用户的全部回复与转达都通过 `lark_notify` 送达飞书，不随在场状态切换渠道；飞书送达后，会话正文只留一句话概述。用户在飞书和 GUI 两处看到的分工固定：完整内容在通知里，正文只有一行。

**Why this priority**: 需求明确要求调度提示词规定「始终通过 lark_notify 与用户通信，text 一句话概述即可」。渠道随在场切换时，本机在场场景下完整内容留在正文，飞书端用户收不到；卡片 UI 也依赖内容都走 `lark_notify`。

**Independent Test**: 阅读调度提示词全文，确认渠道规则与正文规则；在真实宿主让调度会话在「在电脑旁」状态下回复一条消息，观察是否仍经 `lark_notify` 送达、正文是否只剩一句概述。

**Acceptance Scenarios**:

1. **Given** `SA-调度会话` 提示词，**When** 审查全文，**Then** 规定面向用户的回复与转达一律经 `lark_notify`，不区分在场状态。
2. **Given** `SA-调度会话` 提示词，**When** 审查全文，**Then** 规定 `lark_notify` 送达后正文最多一句话概述（含义见 D-004），完整内容只写在通知里。
3. **Given** 提示词改后全文，**When** 逐段检查，**Then** 不存在与 FR-007 冲突的渠道选择表述；原「按在场状态选择渠道」的处置见 D-002。
4. **Given** 用户在场状态为「在电脑旁」，**When** 调度会话回复用户，**Then** 完整内容经 `lark_notify` 送达，正文只有一句话概述。
5. **Given** 一条任务上报需要转达，**When** 调度会话转达，**Then** 转达内容经 `lark_notify` 原文送达，正文不复述。

---

### User Story 3 - 未送达的调用保持默认展示 (Priority: P2)

进行中的 `lark_notify` 显示宿主默认工具行；失败与中断同样沿用默认行并显示错误，不出现通知卡片。用户能区分「内容已送达」与「没有送达」。

**Why this priority**: 卡片是送达的凭证，失败与进行中必须沿用现状，避免误认为内容已发给用户。

**Independent Test**: 分别触发一次失败（未绑定用户时调用）与一次成功的 `lark_notify`，对比展示形态。

**Acceptance Scenarios**:

1. **Given** `lark_notify` 正在执行，**When** 用户查看，**Then** 显示宿主默认工具行，无卡片。
2. **Given** `lark_notify` 返回失败结果，**When** 用户查看，**Then** 显示宿主默认工具行与错误信息，无卡片。
3. **Given** `lark_notify` 被中断，**When** 用户查看，**Then** 显示宿主默认的中断样式，无卡片。

---

### Edge Cases

- 正文为空不可能是成功结果：参数校验会先拒绝，卡片只面对非空正文。
- 长文本被拆成多段发送：卡片仍对应一次调用，显示全文与分段数。
- 同一轮多次调用 `lark_notify`：每次成功都出一张卡片。
- 调用事件不在已加载的历史窗口内：成功结果独立产出卡片（沿用 `send_report` 卡片的既有策略）。
- 调度会话停用（`lark-super-agent` 行停用）时，普通桥接会话的 `lark_notify` 调用同样显示卡片；提示词规则只影响 `SA-调度会话`。
- 未被管理的普通会话看不到 `lark_notify`，不受本次改动影响。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 一次成功的 `lark_notify` 调用 MUST 在对话中显示专用通知卡片，卡片包含发给用户的完整正文；正文呈现形态见 D-001。
- **FR-002**: 通知卡片 MUST 显示投递回执：发送或回复、分段数；`messageId` 可用时的取舍见 D-001。
- **FR-003**: 通知卡片 MUST 与 `send_report` 卡片同级：位于轮次层级，不进入过程分组，轮次折叠后默认可见。
- **FR-004**: 进行中、失败与中断的 `lark_notify` MUST 沿用宿主默认工具行，不显示卡片。
- **FR-005**: 历史消息加载出成功的 `lark_notify` 结果时 MUST 显示通知卡片。
- **FR-006**: 通知卡片的界面文案 MUST 提供中英词典条目并按现有回退规则工作。
- **FR-007**: `SA-调度会话` 提示词 MUST 规定：面向用户的全部回复与转达一律经 `lark_notify` 送达，不随在场状态选择渠道。
- **FR-008**: `SA-调度会话` 提示词 MUST 规定：`lark_notify` 送达后，会话正文最多一句话概述，完整内容只写在通知里；边界含义见 D-004。
- **FR-009**: 提示词中与 FR-007、FR-008 冲突的既有表述 MUST 一并修正，处理见 D-002 与 D-003。
- **FR-010**: `lark_notify` 的参数、校验、分段、发送行为与返回结构 MUST 保持现状；卡片只消费已有的调用与结果数据。
- **FR-011**: `send_report` 的卡片与上报行为 MUST 保持现状。
- **FR-012**: 用户可见行为变化 MUST 同步 `README.md`、`docs/how-it-works.md` 与变更日志。

### Key Entities

- **通知卡片**: 一次成功 `lark_notify` 的对话内展示，承载发给用户的正文与投递回执。
- **投递回执**: 通知的送达事实：发送或回复、分段数、可选消息 id。
- **调度正文**: 调度会话在同一轮内除 `lark_notify` 之外输出的文本，规则上限为一句话概述。
- **转达**: 调度会话把任务上报或失败通知送达用户的动作，改后一律经 `lark_notify`。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 实机触发一次成功的 `lark_notify`，截图显示卡片内容完整，轮次结束后无需点击即可见；失败与进行中沿用默认工具行。
- **SC-002**: 调度提示词全文审查通过：含「一律经 `lark_notify`」与「正文最多一句概述」两条规则，且无相互矛盾的渠道表述。
- **SC-003**: 真实宿主机「在电脑旁」状态下发一条消息给调度会话，用户经飞书收到完整回复，会话正文不超过一句话概述。
- **SC-004**: 既有测试套件与 `pnpm full-check` 全部通过，`send_report` 相关用例零修改通过。

## Assumptions

- 卡片的注册与展示形态参照 `send_report` 卡片的既有模式（成功产出轮次层级卡片，其余状态走默认工具行），本规格只定义内容字段与可见性。
- `lark_notify` 仍只在桥接会话可用，卡片因此只出现在桥接会话（含使用 `SA-调度会话` 预设的会话）。
- 「text 一句话概述即可」按「正文是送达通知之外的补充说明，上限一句」理解，最终以 D-004 的答复为准。
- 在场提醒是否停止注入调度会话属 D-002；被管理会话的提问拦截等服务行为不因本改动调整。
- 验证沿用 `real-device-test` 技能的实机流程，覆盖卡片渲染与渠道规则两处（宪章 II）。
