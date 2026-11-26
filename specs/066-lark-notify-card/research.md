# Research: 通知卡片与统一渠道

## R-01 `lark_notify` 结果能否提供卡片数据

**Decision**: 使用 `tool/call.arguments` 的 `text`、`reply_to` 与 `tool/result` 的现有成功文本。成功文本精确匹配 `已发送给用户（N 条）` 或 `已回复给用户（N 条）`，得到动作与分段数。`messageId` 不展示。

**Rationale**: `src/tools.ts` 的 `output.render` 把 `NotifyResult` 投影成单条文本，会话事件不含原始结果对象。用户决定忽略 `messageId`，因此无需改变模型可见结果。失败结果不匹配成功文本，天然排除卡片。

**Alternatives considered**: 成功 render 改为 JSON。它能提供 `messageId`，但改变模型可见结果与既有测试，用户已否决。

## R-02 通知节点生命周期

**Decision**: 新增独立 `lark-notify-result` Definition，匹配 `lark_notify` 的 `tool/call` 与成功 `tool/result`；节点放在 `turn`，锚点为结果序号加 `0.5`。

**Rationale**: 与上报卡片相同，调用事件保证后续补载参数时能重建内容，结果事件保证历史窗口缺调用时仍出卡片。进行中与失败没有成功结果，宿主默认工具行继续展示。

**Alternatives considered**: 重构上报节点为通用工厂。可减少少量重复，但会扩大对既有上报链路的改动，本期保留两条独立业务链路。

## R-03 上报正文为何呈次要色

**Decision**: 把 `.dsh-lark-report` 的 `color` 改为 `--dsw-alias-label-primary`。

**Rationale**: 容器当前是 `--dsw-alias-label-secondary`。正文、任务简介与附件名已显式使用主前景色，容器改色保证 Markdown 内部未单独指定颜色的节点也继承正文色。辅助标签与路径保持现有层级。

**Alternatives considered**: 全部文字统一主前景色。会消除回执与辅助路径的视觉层级，超出规格范围。

## R-04 统一渠道需要删除哪些注入

**Decision**: 删除 `src/sa-dispatch/index.ts` 中调度预设的 `agent/pre-step` 在场提醒注册，保留 `src/lark-super-agent/index.ts` 的全局 `presence.observe`。

**Rationale**: 前者只向调度会话插入位置描述，统一渠道后没有消费者；后者维护全局状态，被管理会话的 `AskGuard` 仍依赖它。其余按钮、路由、闹钟与节假日逻辑不变。

**Alternatives considered**: 保留提醒但删除提示词段落。提醒会继续陈述「用户在 GUI 读本会话」，与始终经飞书通信的规则冲突。

## R-05 验证方式

**Decision**: 单元测试覆盖事件与渲染，真实宿主覆盖两类卡片、颜色、折叠可见性与统一渠道。

**Rationale**: 宪章 II 要求涉及真实对话链路的变更做端到端验证。卡片是否位于轮次层级、正文实际颜色与模型是否遵守提示词无法由单元测试证明。

**Alternatives considered**: 只跑 `pnpm full-check`。它不能证明宿主实际渲染与模型行为。
