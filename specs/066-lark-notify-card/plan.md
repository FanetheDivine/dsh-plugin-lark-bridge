# Implementation Plan: lark_notify 通知卡片、上报卡片正文色与统一通知渠道

**Branch**: `feat/066-lark-notify-card` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/066-lark-notify-card/spec.md`

**Status**: Draft

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [P-001] Q: 通知卡片如何读取 `lark_notify` 成功回执，是否为了 `messageId` 改工具结果？ -> A: 忽略 `messageId` 展示需求。解析现有「已发送/已回复给用户（N 条）」结果，正文从调用参数读取；后端与模型可见结果不变。
- [P-002] Q: 卡片节点与组件如何组织？ -> A: 新增独立的 `notify-node.ts`、`notify-card.tsx` 与 `notify-card.css`，与上报卡片并行注册。避免重构既有上报链路。
- [P-003] Q: 上报卡片颜色改哪些样式？ -> A: 卡片容器默认色改为 `--dsw-alias-label-primary`，正文、任务简介与附件名继续使用该令牌；回执、标签与完整路径等辅助色保留。
- [P-004] Q: 如何验证真实展示？ -> A: 按 `real-device-test` 技能在真实 DSH Web GUI 触发成功与失败的 `lark_notify`、成功 `send_report`，截图核对卡片、颜色与折叠可见性；另在「在电脑旁」状态检查统一渠道提示词实际请求。

## Review Record

- 待审查。

## Summary

新增 `lark-notify-result` Conversation Definition，把成功的 `lark_notify` 调用与结果投影为轮次层级的 `lark-notify` 卡片。卡片从 `tool/call.arguments` 读取完整正文与 `reply_to`，从现有结果文本识别发送/回复与分段数。`send_report` 链路只改容器前景色。调度提示词与桥接提醒统一为始终经 `lark_notify` 通信，成功送达后正文最多一句概述；调度会话停止注入在场提醒，其余在场机制不变。

## Technical Context

**Language/Version**: TypeScript 6、React 18、Node.js 24

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-chat`、`dsh-client-ui-conversation`、`dsh-client-ui-primitives`、宿主 `0.2.2-rc.5` 同版本依赖

**Storage**: N/A；卡片只消费会话事件，不持久化新数据

**Testing**: Vitest、jsdom、`tests/helpers.ts` 的模拟客户端 `ctx`、真实 DSH Web GUI

**Target Platform**: DSH Web GUI 与 Node.js 插件宿主

**Project Type**: DSH 插件，Node.js 后端与浏览器前端

**Performance Goals**: 结果或调用未变化时复用已构建卡片节点，与上报卡片一致

**Constraints**: 不修改 `lark_notify` 参数、发送行为、结果 render 与返回结构；不修改 `send_report` 行为；不新增依赖；不在跟踪文件中写本机绝对路径

**Scale/Scope**: 新增一个 Chat 节点类型、一个卡片组件与样式；修改上报容器颜色、两处提示文案及相关文档测试

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 核对 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级依赖，`package.json` 与 `pnpm-workspace.yaml` 不变 |
| II. 测试同步 | PASS | 新增通知节点、组件与样式测试，更新提醒、提示词、客户端注册测试；真实宿主验证卡片与渠道 |
| III. 文档结构 | PASS | 更新 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md` 对应归属段落与 Unreleased 变更日志 |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check`，合并前运行 `pnpm full-check` |
| V. 公开引用 | PASS | 代码与规格只引用仓库内路径；实机材料存放于本规格目录 |

**结论**: 全部通过，无 Complexity Tracking 项。

## Phase 0: Research

见 [research.md](./research.md)。关键结论：

1. `tool/result` 中只有 render 后的文本；成功结果可精确匹配现有两种中文回执，失败结果不匹配，因此不会产生卡片。
2. 调用与结果可共用同一 `callId` 开启 Context；只有成功结果产出节点，调用后补载时重新解析参数。
3. 上报正文颜色由容器继承；将容器从次要前景色改为主前景色即可覆盖 Markdown 正文，辅助样式无需改动。
4. 在场提醒注入只位于 `sa-dispatch/index.ts`；全局状态观察位于 `lark-super-agent/index.ts`，删除前者不影响提问拦截。

## Phase 1: Design

### 通知卡片

- `src/client/notify-node.ts`
  - 导出 `NOTIFY_NODE_KIND = 'lark-notify'`、`NOTIFY_DEFINITION_KIND = 'lark-notify-result'`。
  - `parseNotifyArgs` 读取 `text` 与 `reply_to`，非法 JSON 或字段类型退为空值。
  - `deliveryOf` 只接受 `surfaceOp === 'append'`、非错误、单文本且完全匹配现有成功回执的结果，返回 `action` 与 `parts`。
  - `buildNotifyNode` 产出 `target: 'chat'`、`groupTree: 'turn'`、`anchorSeq: resultSeq + 0.5` 的节点。
- `src/client/notify-card.tsx`
  - 标题为「飞书通知」，回执为「已发送 · N 条」或「已回复 · N 条」。
  - 正文用保留换行的纯文本元素展示，不调用 `MarkdownText`。
  - 正文与容器使用 `--dsw-alias-label-primary`。
- `src/client/index.ts`
  - 在同一 `uiConversation` 作用域注册通知 Definition，并在 `conversation.chat.node` 注册 `lark-notify` 组件。
- `src/client/locales.ts`
  - 新增 `notify.title`、`notify.sent`、`notify.replied`、`notify.parts`，中英键集一致。

详细事件与字段契约见 [contracts/notify-card.md](./contracts/notify-card.md)。

### 上报卡片正文色

- `src/client/report-card.css` 的 `.dsh-lark-report` 默认 `color` 改为 `--dsw-alias-label-primary`。
- `.dsh-lark-report-body`、`.dsh-lark-report-desc-text`、`.dsh-lark-report-file-name` 已使用主前景色，保持不变。
- 回执、标签、附件完整路径等辅助层级保持不变。
- 新增样式测试读取两份 CSS，断言卡片容器与内容正文使用主前景令牌。

### 提示词与提醒

完整草稿见 [contracts/prompts.md](./contracts/prompts.md)。

- `src/sa-dispatch/prompt.ts`
  - 在 Reply style 增加统一渠道与一句概述规则。
  - 删除 Track where the user is 段。
  - Handle reports 的转达渠道固定为 `lark_notify`。
- `src/sa-dispatch/index.ts`
  - 删除调度会话的 `agent/pre-step` 在场提醒注入。
  - 全局行 `presence.observe` 与 `PresenceStore` 保留。
- `src/reminder.ts`
  - 所有来源的用户消息都经 `lark_notify` 回复。
  - 成功送达后正文最多一句概述，允许为空，不复述通知内容。
  - 连续飞书消息合并、精确回复与任务提及规则保留。

### 测试与实机验证

| 文件 | 覆盖 |
| --- | --- |
| `tests/notify-node.test.ts` | 参数解析、成功回执、失败/替换结果排除、历史窗口缺调用、节点复用与注册注销 |
| `tests/notify-card.test.ts` | 纯文本换行、发送/回执、分段数、中英文案与回退 |
| `tests/card-styles.test.ts` | 上报与通知卡片容器、正文使用主前景令牌 |
| `tests/client.test.ts` | 两种 Definition 与 Chat 节点注册 |
| `tests/sa-dispatch.test.ts` | 统一渠道、一句概述、无在场渠道段 |
| `tests/reminder.test.ts` | 所有消息经 `lark_notify`、一句概述、连续消息规则保留 |
| 真实宿主 | 成功/失败通知卡片、上报卡片颜色、折叠可见性与统一渠道 |

验证步骤与预期见 [quickstart.md](./quickstart.md)。

## Project Structure

### Documentation (this feature)

```text
specs/066-lark-notify-card/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── notify-card.md
│   └── prompts.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── client/
│   ├── index.ts
│   ├── locales.ts
│   ├── notify-node.ts
│   ├── notify-card.tsx
│   ├── notify-card.css
│   ├── report-node.ts
│   ├── report-card.tsx
│   └── report-card.css
├── sa-dispatch/
│   ├── index.ts
│   └── prompt.ts
└── reminder.ts

tests/
├── notify-node.test.ts
├── notify-card.test.ts
├── card-styles.test.ts
├── client.test.ts
├── sa-dispatch.test.ts
└── reminder.test.ts
```

**Structure Decision**: 通知卡片与上报卡片并行，共享宿主 Definition 机制而不共享业务组件；上报链路只改样式，避免影响既有成功判定与 Markdown 展示。

## Documentation & Delivery

- `README.md`：增加通知卡片与统一回复方式，保留在场功能说明并修正桥接回复描述。
- `docs/how-it-works.md`：通知段补充成功结果文本与卡片数据来源；前端段补充通知节点；调度段删除在场渠道规则；上报卡片颜色归入展示说明。
- `docs/known-risks.md`：通知卡片同样依赖宿主 Chat 接口；结果 render 文案变化时卡片回退为默认工具行。
- `CHANGELOG.md`：Unreleased 记录通知卡片、上报正文色与统一渠道。
- 每个 tasks.md 阶段一个 commit；推送与合并走 `speckit-worktree-finish`。
