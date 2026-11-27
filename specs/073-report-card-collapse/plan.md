# Implementation Plan: 上报卡片折叠开关

**Branch**: `feat/073-report-card-collapse` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/073-report-card-collapse/spec.md`

**Status**: Waived

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [D-001] Q: 折叠状态放在 Conversation Node 还是 React 组件本地 state？ -> A: 放在 `ReportCard` 组件本地 `useState(true)`，无需改动 `report-node.ts` 的节点数据结构。
- [D-002] Q: 折叠按钮使用什么图标与样式？ -> A: 使用平台已导出的 `IconChevronDownOutlineRegular`（尺寸 12px）配合文字标签，展开时图标旋转 180 度；按钮使用 `--dsw-alias-*` 颜色与悬浮背景令牌，并配置 `:focus-visible` 焦点环。
- [D-003] Q: 折叠后 `desc` 如何展示？ -> A: 折叠时隐藏独立的 `.dsh-lark-report-desc` 块；若 `desc` 非空，在 `.dsh-lark-report-head` 内标题/标签与回执之间渲染单行省略的 `.dsh-lark-report-head-desc`，保证折叠态仅一行头部摘要栏。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: 卡片卸载重建时本地折叠状态重置为默认展开。 | Reason: 用户授权自由推进，免中途提问确认。

## Summary

在 `ReportCard`（`src/client/report-card.tsx`）头部增加默认展开的折叠/展开开关按钮（`type="button"`、`aria-expanded`），折叠后仅保留头部标题/摘要行与开关，展开后恢复任务简介、Markdown 正文与附件列表；同步补充中英文字典、CSS 令牌样式与单元测试。

## Technical Context

**Language/Version**: TypeScript 6.0, React 18.3, Node.js >= 24.9

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-chat`、`react`（均为现有依赖）

**Storage**: N/A（纯前端视图状态）

**Testing**: `vitest` + `jsdom`（`tests/report-card.test.ts`、`tests/card-styles.test.ts`、`tests/client.test.ts`、`tests/client-bundle.test.ts`）

**Target Platform**: DSH Web GUI (`0.2.2-rc.5`)

**Project Type**: DSH 插件客户端模块

**Performance Goals**: 本地状态切换 O(1)，无额外订阅开销

**Constraints**: 保持 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 使用 `var(--dsw-alias-label-primary)`；`dist/client.js` 仅引用 `PLATFORM_MODULES` 内的模块

**Scale/Scope**: 3 个源码文件（`locales.ts`、`report-card.tsx`、`report-card.css`）、2 个测试文件与文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增或修改任何 `@deepseek-ai/*` 依赖版本 |
| II. 测试同步 | 通过 | 同步更新 `tests/report-card.test.ts` 与 `tests/card-styles.test.ts`，覆盖展开/折叠交互、无障碍属性、文案回退与样式规则 |
| III. 文档结构 | 通过 | 更新 `README.md`、`docs/how-it-works.md` 与 `CHANGELOG.md` 的 Unreleased 条目 |
| IV. 质量门禁 | 通过 | 执行 `pnpm format && pnpm check && pnpm build` |
| V. 公开引用 | 通过 | 全部文件仅引用仓库内路径与公网 URL |

## Project Structure

### Documentation (this feature)

```text
specs/073-report-card-collapse/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/
│   └── requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/client/
├── locales.ts          # 新增 report.collapse 与 report.expand 中英文文案
├── report-card.tsx     # 新增默认展开状态、头部折叠开关与折叠态单行摘要
└── report-card.css     # 新增开关按钮、图标旋转与头部单行摘要样式，保留 compact Markdown 主前景色

tests/
├── report-card.test.ts # 新增默认展开、折叠/展开切换、各 kind 覆盖与文案测试
└── card-styles.test.ts # 校验上报正文颜色规则与折叠按钮样式
```

**Structure Decision**: 保持现有单包结构，在 `src/client/` 的上报卡片组件与样式文件中原位扩展。

## Complexity Tracking

无偏离项。
