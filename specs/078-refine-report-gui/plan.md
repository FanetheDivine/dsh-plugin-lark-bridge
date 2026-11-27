# Implementation Plan: 优化上报与通知卡片 GUI 悬停与点击热区

**Branch**: `feat/078-refine-report-gui` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/078-refine-report-gui/spec.md`

**Status**: Waived

## Open Decisions

None. 用户授权自行推进，实现细节由 Agent 依据代码库事实自决，逐条记录在 Clarifications。

## Clarifications

### Session 2026-11-27

以下决策由 Agent 自决，依据用户授权「后续自行推进+合并pr」。

- [P-001] Q: 内边距如何分区？ -> A: 容器去掉 padding/gap；两卡片热区 `padding: 10px 14px`；body/files/meta `padding: 8px 14px 12px` 并保留 border-top。沿用插件既有间距尺度，热区铺满分隔线上方。
- [P-002] Q: 悬停令牌、过渡与圆角取值？ -> A: 悬停背景 `var(--dsw-alias-turn-trigger-bg-hover, var(--dsw-alias-interactive-bg-hover))`，`transition: background-color 0.1s`，reduced-motion 关闭过渡；圆角保留 `--dsw-radius-lg`。与宿主参考一致，回退令牌保证旧宿主可用；两卡片圆角保持插件现状一致。
- [P-003] Q: 热区自身 hover 底色与焦点环如何处理？ -> A: 删除 `.dsh-lark-report-head:hover` 底色，整卡变色承担反馈；`:focus-visible` 保留宿主焦点环令牌，`outline-offset: -2px` 收入卡片内。避免双重底色；热区贴边后外扩焦点环会画出卡片。
- [P-004] Q: 上报卡片展开态 desc 如何进入按钮？ -> A: 按钮改纵向 flex，标题行包进 `span.dsh-lark-report-head-row`，desc 由 `div` 改 `span`（类名与 grid 布局不变）作为第二行。按钮内容模型要求 phrasing content。
- [P-005] Q: 通知卡片热区构成与默认状态？ -> A: 图标（`IconPaperPlaneOutlineRegular`，business-primary 色）+ 总结或 `notify.title` 标题 + 箭头；`expanded` 初值 `summary === undefined`。与上报卡片头部同构，保留两种模式现有信息密度。
- [P-006] Q: 任务与会话行如何常显？ -> A: 包进 `footer.dsh-lark-notify-meta`（border-top + 分区内边距，行距 6px），仅 taskId 或 sessionId 存在时渲染；行内结构与 data 属性不变。折叠态仍可见会话入口。
- [P-007] Q: 字典键如何调整？ -> A: 新增 `notify.title`、`notify.collapse`；`notify.expand` 改值为 展开/Expand。原「完整内容」随 `<details>` 移除，不留死键。
- [P-008] Q: 测试策略？ -> A: 更新 `tests/report-card.test.ts`、`tests/notify-card.test.ts`、`tests/card-styles.test.ts`；不新建测试文件；产物测试不变（组件桩已含所需图标）。会话链接用例改按 `data-dsh-lark-notify-session-link` 定位，热区成为首个按钮。
- [P-009] Q: 文档与 CHANGELOG 如何同步？ -> A: 更新 `docs/how-it-works.md` 的 `lark_notify` 与上报卡片段落；README 不描述卡片 UI，不改；push 前在 CHANGELOG 写 `## Unreleased` 条目。
- [P-010] Q: 是否实机端到端验证？ -> A: 本轮不做。卡片只在真实飞书投递成功后产出，隔离 mock profile 无凭据无法触发；改动限于客户端 DOM/CSS，由 jsdom 交互、CSS 规则与产物契约测试覆盖。理由记录于 research.md R7。

## Review Record

- 2026-11-27 | Decision: Waived | Scope: current full document | Open items: none | Risks: none | Reason: 用户授权「后续自行推进+合并pr」，P-001~P-010 由 Agent 自决并留痕。

## Summary

两张卡片迁移到宿主 `TurnTriggerNodeView` 的分区结构：容器无内边距、悬停整卡变色；分隔线上方整块是折叠热区按钮。上报卡片把展开态任务简介并入热区；通知卡片改为热区折叠正文（卡片模式默认折叠显示总结，文本模式默认展开显示「通知」标题），任务与会话行常显。数据字段、节点解析与会话判定不变。

## Technical Context

**Language/Version**: TypeScript 5，React 19，CSS

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-primitives`（`IconChevronDownOutlineRegular`、`IconPaperPlaneOutlineRegular`、`Tag`、`MarkdownText`、`FileTypeIcon`），不新增依赖

**Storage**: N/A（折叠状态为组件本地 state）

**Testing**: vitest + jsdom；`tests/report-card.test.ts`、`tests/notify-card.test.ts`、`tests/card-styles.test.ts`；产物 `tests/client-bundle.test.ts`

**Target Platform**: DSH Web GUI 中的 Chat 节点

**Project Type**: DSH 插件（前端卡片 + 客户端样式）

**Performance Goals**: 交互仅切换一个布尔值，无额外渲染开销

**Constraints**: 只用宿主 `--dsw-*` 设计令牌；CSS 经 tsdown 内联进 `dist/client.js`

**Scale/Scope**: 两个组件、两个样式文件、一个字典文件、三个测试文件、一处机制文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. 宿主依赖版本：不新增或升级 `@deepseek-ai/*` 依赖。通过。
- II. 测试同步：三个测试文件随代码更新，覆盖热区归属、折叠切换、文件/会话回调、悬停与分区样式、字典键集。实机 SHOULD 项不适用：改动不涉及宿主装载与真实对话链路，卡片产出依赖真实飞书凭据，隔离环境无法触发（research.md R7）。通过。
- III. 文档结构：机制描述更新 `docs/how-it-works.md`；README 未描述卡片 UI，无需改动；CHANGELOG 在 push 前补条目。通过。
- IV. 质量门禁：每阶段实现后运行 `pnpm format && pnpm check`，收口前 `pnpm build` 回归产物测试。通过。
- V. 公开引用：spec 与代码只引用仓库内路径与宿主模块名，无本机绝对路径。通过。

设计后复查：DOM 契约与样式契约未引入新依赖、新存储或新接口，各 gate 维持通过。

## Project Structure

### Documentation (this feature)

```text
specs/078-refine-report-gui/
├── spec.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/client/
├── report-card.tsx     # 热区并入展开态 desc，标题行包 span
├── report-card.css     # 容器无 padding、整卡 hover、热区铺满、分区块内边距
├── notify-card.tsx     # 热区折叠正文，meta 常显，移除 details
├── notify-card.css     # 同构容器与热区样式
└── locales.ts          # notify.title / notify.collapse 新增，notify.expand 改值

tests/
├── report-card.test.ts # desc 在热区内、点击 desc 切换折叠
├── notify-card.test.ts # 两种模式默认状态、热区折叠、会话链接定位更新
└── card-styles.test.ts # 两卡片悬停、分区、焦点环与箭头规则

docs/
└── how-it-works.md     # 两处卡片机制段落
```

**Structure Decision**: 沿用现有单项目结构，改动集中在 `src/client`、`tests` 与 `docs`；DOM 与样式契约见 [data-model.md](./data-model.md)。

## Complexity Tracking

无偏离宪章的复杂度。
