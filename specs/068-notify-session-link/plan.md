# Implementation Plan: 飞书通知关联会话与跳转

**Branch**: `feat/068-notify-session-link` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/068-notify-session-link/spec.md`

**Status**: Waived

## Open Decisions

- 无。宿主接口、持久化方式、状态来源与测试路径均可从当前代码库确认。

## Clarifications

### Session 2026-11-26

- [P-001] Q: 会话标识如何随历史通知保存？ -> A: 成功结果携带 `sessionId`，通过 `output.presentationMeta` 持久化到 `tool/result.meta`。
- [P-002] Q: 前端如何恢复关联？ -> A: `notify-node.ts` 从结果元数据读取非空 `sessionId`，写入 `NotifyCardData`。
- [P-003] Q: 如何判定归档和有效会话？ -> A: `useWorkspaces` 读取 `archivedSessionIds`，`useSessions` 读取会话目录。
- [P-004] Q: 如何执行跳转？ -> A: 槽位注入 `openSession`，调用 `ctx.uiWorkspace.openSession(sessionId)`。
- [P-005] Q: 如何保持兼容？ -> A: 缺失或非法元数据时省略会话区域，正文和成功结果文本保持不变。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: none | Reason: 用户要求自动推进，无需中途确认。

## Summary

`lark_notify` 成功结果新增来源 `sessionId`，并由宿主持久化展示元数据。通知节点恢复该标识，卡片订阅会话目录与归档状态。有效且未归档的会话显示链接，点击后通过宿主导航进入来源会话；已归档会话显示标识和“已归档”标签。历史通知保持原有正文卡片。

## Technical Context

**Language/Version**: TypeScript 6、React 18、Node.js 24

**Primary Dependencies**: 宿主 `0.2.2-rc.5` 同版本的 `dsh-tools`、`dsh-api-session-controller`、`dsh-client-ui-workspace`、`dsh-client-ui-chat`

**Storage**: `tool/result.meta` 随会话日志持久化；不新增状态文件

**Testing**: Vitest、jsdom、`tests/helpers.ts` 的模拟 `ctx`

**Target Platform**: DSH 宿主与 Web GUI

**Project Type**: DSH 插件后端工具与浏览器前端

**Performance Goals**: 结果或调用未变化时复用卡片节点；组件只订阅归档状态和目标会话存在性

**Constraints**: 不新增工具参数；不改变发送、回复、分段与成功回执文案；不新增依赖；界面文案提供中英文

**Scale/Scope**: 修改通知工具、通知节点、通知卡片、客户端注册及相关测试与文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 核对 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 复用已锁定的同版本依赖，不修改包版本 |
| II. 测试同步 | PASS | 更新工具、通知节点、卡片和客户端注册测试，使用模拟 `ctx` 验证真实行为 |
| III. 文档结构 | PASS | 用户行为写入 `README.md`，机制与风险写入对应开发文档，交付前更新 `CHANGELOG.md` |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check`，交付前运行 `pnpm full-check` |
| V. 公开引用 | PASS | 规格与代码只引用仓库内路径和现有公网地址 |

**结论**: 设计前后均通过，无 Complexity Tracking 项。

## Phase 0: Research

见 [research.md](./research.md)。宿主提供持久化展示元数据、会话目录快照、归档快照和统一导航，满足全部需求。

## Phase 1: Design

### 后端结果与持久化

- `src/tools.ts`
  - `NotifyResult` 与输出 schema 增加可选 `sessionId`。
  - `sendNotification` 接收可选来源会话标识，成功结果保留该标识。
  - 工具执行时传入 `exec.agent.session.id`。
  - `output.presentationMeta` 从成功结果投影 `{ sessionId }`，其余情况返回空对象。
  - `output.render` 保持现有单条成功或失败文本。

### 通知节点

- `src/client/notify-node.ts`
  - `NotifyCardData` 增加可选 `sessionId`。
  - 从 `tool/result.meta` 解析非空字符串，忽略缺失、空值和其他类型。
  - 卡片缓存继续以结果事件和调用事件为键，元数据随结果事件版本更新。
  - 历史事件没有元数据时仍按原逻辑产出正文卡片。

### 卡片与导航

- `src/client/notify-card.tsx`
  - 正文区域保持不变。
  - 有 `sessionId` 时显示“会话”标签和完整标识。
  - 目标在会话目录中且未归档时显示按钮；点击调用注入的 `openSession`。
  - 已归档时显示只读标识与“已归档”标签。
  - 目录未就绪或目标缺失时显示只读标识。
- `src/client/index.ts`
  - 通知卡片依赖组加入 `uiWorkspace`。
  - 槽位注册注入 `openSession`。
- `src/client/locales.ts`
  - 新增 `notify.session`、`notify.archived`、`notify.openSession` 中英文文案。
- `src/client/notify-card.css`
  - 增加会话 footer、长标识换行、链接与归档标签样式。

字段和状态规则见 [data-model.md](./data-model.md) 与 [contracts/notify-session.md](./contracts/notify-session.md)。

### 测试

| 文件 | 覆盖 |
| --- | --- |
| `tests/tools.test.ts` | 当前 agent 的标识进入成功结果与展示元数据，回执文本不变 |
| `tests/notify-node.test.ts` | 合法元数据进入节点，非法与缺失元数据兼容，缓存行为不变 |
| `tests/notify-card.test.ts` | 有效会话链接与点击、归档标签、未知会话只读、历史正文与长标识 |
| `tests/client.test.ts` | `uiWorkspace` 依赖与 `openSession` 注入、双语字典键集 |
| `tests/card-styles.test.ts` | 会话区域使用宿主令牌与长标识换行 |

验证步骤见 [quickstart.md](./quickstart.md)。

## Project Structure

### Documentation (this feature)

```text
specs/068-notify-session-link/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── notify-session.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── tools.ts
└── client/
    ├── index.ts
    ├── locales.ts
    ├── notify-node.ts
    ├── notify-card.tsx
    └── notify-card.css

tests/
├── tools.test.ts
├── notify-node.test.ts
├── notify-card.test.ts
├── client.test.ts
├── card-styles.test.ts
└── helpers.ts
```

**Structure Decision**: 沿用现有通知工具与卡片模块，不新增平行实现。

## Documentation & Delivery

- `README.md`：说明通知卡片显示来源会话，未归档时可跳转，已归档时有标记。
- `docs/how-it-works.md`：记录 `sessionId`、展示元数据、状态来源与导航机制。
- `docs/known-risks.md`：记录历史通知无关联和宿主接口依赖。
- `CHANGELOG.md`：在 Unreleased 记录本功能。
- 每个 `tasks.md` 阶段一个 commit。
