# Implementation Plan: 上报卡片头部折叠热区

**Branch**: `feat/077-report-header-toggle` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/077-report-header-toggle/spec.md`

**Status**: Approved

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [P-001] Q: 头部悬停反馈与热区高度如何确定？ -> A: 按代码库既有约定：整行热区铺满卡片宽度与头部上下内边距，悬停使用 `--dsw-alias-interactive-bg-hover`，与附件按钮一致。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: 悬停底色坐标随头部行盒，不覆盖卡片内边距。 | Reason: 用户要求简单实现，只保留悬停样式与点击事件。

## Summary

上报卡片头部改为一个原生 `<button>`，覆盖标题、类型标签、折叠态任务摘要、送达回执与报告编号，去掉可见的「收起」「展开」文字，只保留随状态翻转的箭头。折叠内容显隐规则、设计令牌、无障碍名称与 `data-dsh-lark-report-toggle` 钩子保持现有约定。

## Technical Context

**Language/Version**: TypeScript 5，React 19，CSS

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-primitives`（`IconChevronDownOutlineRegular`、`Tag`、`MarkdownText`）

**Storage**: N/A（折叠状态为组件本地 state）

**Testing**: vitest + jsdom，`tests/report-card.test.ts`、`tests/card-styles.test.ts`

**Target Platform**: DSH Web GUI 中的 Chat 节点

**Project Type**: DSH 插件（前端卡片 + 客户端样式）

**Performance Goals**: 无额外渲染或状态，交互仅切换一个布尔值

**Constraints**: 只用宿主 `--dsw-*` 设计令牌；不引入新依赖

**Scale/Scope**: 单个组件 `ReportCard` 与一个样式文件

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. 宿主依赖版本：不新增或升级 `@deepseek-ai/*` 依赖。通过。
- II. 测试同步：更新 `tests/report-card.test.ts` 与 `tests/card-styles.test.ts`，覆盖整行热区、无可见文字、箭头翻转与无障碍名称。通过。
- III. 文档结构：机制描述归属 `docs/how-it-works.md`，更新上报卡片段落；README 未描述卡片头部，无需改动。通过。
- IV. 质量门禁：实现后运行 `pnpm format && pnpm check`，并回归 `pnpm test:code`。通过。
- V. 公开引用：变更只涉及仓库内路径，无本机绝对路径。通过。

## Project Structure

### Documentation (this feature)

```text
specs/077-report-header-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md            # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/client/
├── report-card.tsx     # 头部改为整行按钮，移除文字标签
├── report-card.css     # 头部按钮样式、热区铺满、箭头翻转
└── locales.ts          # 保留 report.collapse / report.expand 作为无障碍名称

tests/
├── report-card.test.ts # 头部按钮语义、整行点击、无可见文字
└── card-styles.test.ts # 头部按钮与箭头样式断言

docs/
└── how-it-works.md     # 上报卡片机制描述
```

**Structure Decision**: 沿用现有单项目结构，改动集中在 `src/client`、`tests` 与 `docs`。

## Design Notes

- 头部元素：`<button type="button" className="dsh-lark-report-head" data-dsh-lark-report-toggle="" aria-expanded={expanded} aria-label={toggleLabel}>`，内部保留图标、标题、类型标签、折叠态摘要、回执与箭头。
- 卡片 `padding: 10px 14px 12px` 与 `gap: 8px` 保持不变。头部 `padding: 2px 0`，与旧按钮撑起的高度一致，实测内容坐标与改前相同。
- 按钮复位：`border: none; background: none; font: inherit; color: inherit; text-align: start; width: 100%; cursor: pointer;`，保留现有 `display: flex` 与 `gap: 8px`。
- 悬停：`@media (hover: hover)` 下头部整行背景 `--dsw-alias-interactive-bg-hover`，`border-radius: var(--dsw-radius-sm)`。
- 箭头：`.dsh-lark-report-toggle-icon` 保留，选中器改为 `.dsh-lark-report-head[aria-expanded="true"] .dsh-lark-report-toggle-icon`，展开时旋转 180deg；尺寸与当前一致（12px）。
- 焦点环：整行 `:focus-visible`，`outline-offset: 1px`，与附件按钮一致。
- 移除 `.dsh-lark-report-toggle` 相关样式与文字节点；其余区块的 DOM、文案、颜色、间距不变。
- 视觉回归：`tests/card-styles.test.ts` 断言卡片内边距仍为 `10px 14px 12px`、头部 `padding: 2px 0`、正文主前景色规则保留。

## Complexity Tracking

无偏离宪章的复杂度。
