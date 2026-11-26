# Implementation Plan: lark_notify 正文卡片与上报卡片正文色

**Branch**: `feat/066-lark-notify-card` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/066-lark-notify-card/spec.md`

**Status**: Draft

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [P-001] Q: 通知卡片如何识别成功结果？ -> A: 前端匹配现有「已发送/已回复给用户（N 条）」结果，仅用于决定何时显示卡片；结果文本不进入卡片。
- [P-002] Q: 卡片展示哪些数据？ -> A: 只展示 `tool/call.arguments.text`。不展示标题、回执、分段数、`reply_to` 或 `messageId`。
- [P-003] Q: 缺少调用参数时怎么办？ -> A: 不产生空卡片，保留宿主默认工具行。
- [P-004] Q: 卡片代码如何组织？ -> A: 新增独立的 `notify-node.ts`、`notify-card.tsx` 与 `notify-card.css`，与上报卡片并行注册。
- [P-005] Q: 是否继续统一渠道与提示词改动？ -> A: 全部取消。本次只改 UI，提示词、桥接提醒与在场机制不变。

## Review Record

- 待审查当前纯 UI 计划。

## Summary

新增 `lark-notify-result` Conversation Definition，把成功的 `lark_notify` 调用与结果投影为轮次层级的 `lark-notify` 卡片。卡片只从 `tool/call.arguments` 读取并展示 `text`，现有结果文本只作为成功门槛。`send_report` 链路只把卡片容器默认前景色改为正文主前景色。后端、提示词、提醒与在场机制不变。

## Technical Context

**Language/Version**: TypeScript 6、React 18、Node.js 24

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-chat`、`dsh-client-ui-conversation`、宿主 `0.2.2-rc.5` 同版本依赖

**Storage**: N/A；卡片只消费会话事件

**Testing**: Vitest、jsdom、`tests/helpers.ts` 的模拟客户端 `ctx`、真实 DSH Web GUI

**Target Platform**: DSH Web GUI

**Project Type**: DSH 插件浏览器前端

**Performance Goals**: 结果或调用未变化时复用已构建卡片节点

**Constraints**: 不改两个工具的后端行为；不改提示词与在场机制；不新增依赖或界面字典；不写死颜色值

**Scale/Scope**: 新增一个 Chat 节点类型、一个单正文卡片组件与样式；修改一处上报容器颜色

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 核对 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级依赖 |
| II. 测试同步 | PASS | 新增通知节点、组件与样式测试，更新客户端注册测试；真实宿主验证卡片 |
| III. 文档结构 | PASS | 更新 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md` 与 Unreleased 变更日志 |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check`，合并前运行 `pnpm full-check` |
| V. 公开引用 | PASS | 只引用仓库内路径 |

**结论**: 全部通过，无 Complexity Tracking 项。

## Phase 0: Research

见 [research.md](./research.md)。结果 render 文本可精确识别成功调用；卡片无需读取回执内容。上报容器改为主前景色即可覆盖 Markdown 正文。

## Phase 1: Design

### 通知正文卡片

- `src/client/notify-node.ts`
  - 导出 `NOTIFY_NODE_KIND = 'lark-notify'` 与 `NOTIFY_DEFINITION_KIND = 'lark-notify-result'`。
  - `parseNotifyText` 只读取 `arguments.text`，非法 JSON 或非字符串返回空字符串。
  - 成功结果只接受 `surfaceOp === 'append'`、非错误、单文本且完全匹配现有两种成功回执的结果。
  - `buildNotifyNode` 在成功结果与 nonempty `text` 同时存在时产出 `target: 'chat'`、`groupTree: 'turn'`、`anchorSeq: resultSeq + 0.5` 的节点；否则返回 null。
- `src/client/notify-card.tsx`
  - 只渲染一个保留换行的正文元素，不使用 `MarkdownText`，不渲染标题或回执。
- `src/client/notify-card.css`
  - 外框与上报卡片一致，容器和正文使用 `--dsw-alias-label-primary`。
- `src/client/index.ts`
  - 注册通知 Definition 与 `lark-notify` Chat 节点组件。
- `src/client/locales.ts`
  - 不变，卡片没有界面文案。

字段与事件契约见 [contracts/notify-card.md](./contracts/notify-card.md)。

### 上报卡片正文色

- `src/client/report-card.css` 的 `.dsh-lark-report` 默认 `color` 改为 `--dsw-alias-label-primary`。
- 正文、任务简介与附件名已使用该令牌；辅助标签、回执与完整路径保持现状。
- 新增样式测试读取两份 CSS，断言卡片容器使用主前景令牌。

### 测试与实机验证

| 文件 | 覆盖 |
| --- | --- |
| `tests/notify-node.test.ts` | 正文解析、成功门槛、失败/替换结果排除、空正文不产卡片、节点复用与注册注销 |
| `tests/notify-card.test.ts` | 只含正文、纯文本换行、无额外字段 |
| `tests/card-styles.test.ts` | 两类卡片容器使用主前景令牌 |
| `tests/client.test.ts` | 两种 Definition 与 Chat 节点注册 |
| 真实宿主 | 成功/失败通知、上报与通知正文色、折叠可见性 |

验证步骤见 [quickstart.md](./quickstart.md)。

## Project Structure

### Documentation (this feature)

```text
specs/066-lark-notify-card/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── notify-card.md
└── tasks.md
```

### Source Code (repository root)

```text
src/client/
├── index.ts
├── notify-node.ts
├── notify-card.tsx
├── notify-card.css
└── report-card.css

tests/
├── notify-node.test.ts
├── notify-card.test.ts
├── card-styles.test.ts
└── client.test.ts
```

**Structure Decision**: 通知卡片与上报卡片并行，复用宿主 Definition 机制而不重构上报业务代码。

## Documentation & Delivery

- `README.md`：补充成功通知只显示完整正文，上报卡片内容使用正文色。
- `docs/how-it-works.md`：通知段补充成功识别与卡片数据来源，前端段补充通知节点。
- `docs/known-risks.md`：通知卡片依赖宿主 Chat 接口与现有成功结果文案。
- `CHANGELOG.md`：Unreleased 记录两项 UI 变化。
- 每个 tasks.md 阶段一个 commit。
