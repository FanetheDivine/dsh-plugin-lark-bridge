# Implementation Plan: 在场状态按钮即时 tooltip

**Branch**: `feat/051-presence-tooltip` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/051-presence-tooltip/spec.md`

**Status**: Waived

## Open Decisions

无。

## Clarifications

### Session 2026-11-25

- [D-001] Q: 提示气泡优先显示在按钮的哪一侧？ -> A: 上方优先，空间不足时自动换到可完整显示的一侧。
- [D-002] Q: 用 Tab 键把焦点移到按钮时，是否同样立即展示提示？ -> A: 是，聚焦即显示，失焦即收起。
- [D-003] Q: 提示使用哪套组件？ -> A: shadcn/ui 的 Tooltip，底层为 Radix UI；沿用项目已有 shadcn 组件体系。

## Review Record

- 2026-11-25 | Decision: Waived | Scope: current full document | Open items: none | Risks: 用户要求自行实现并合并，跳过计划逐项审查；新增 Radix Tooltip 依赖带来前端包体增量

## Summary

把侧栏页脚在场状态按钮的浏览器原生 `title` 换成页面内 tooltip。按钮悬停或键盘聚焦时立即显示当前状态与点击效果，鼠标离开或失焦立即收起。气泡优先在按钮上方，空间不足时由 Radix 自动翻转。实现采用项目 shadcn/ui 组件体系新增 `Tooltip`，底层使用 Radix UI。

## Technical Context

**Language/Version**: TypeScript 6、React 18

**Primary Dependencies**: `@radix-ui/react-tooltip` 1.4.1；现有 `clsx`、`tailwind-merge`、Tailwind CSS 4

**Storage**: N/A，仅组件内部展开状态

**Testing**: Vitest 4、jsdom、`react-dom/client`、`react-dom/server`

**Target Platform**: DSH Web GUI 浏览器产物

**Project Type**: DSH 插件，单仓库

**Performance Goals**: 悬停或聚焦到提示可见不超过 100 ms

**Constraints**: 客户端产物不内联平台种子模块；不引入 Tailwind preflight；颜色映射宿主 `--dsw-*` 令牌

**Scale/Scope**: 一个在场状态按钮、一个 tooltip 封装与相关测试

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不修改任何 `@deepseek-ai/*` 版本；新增 Radix Tooltip 使用精确版本 1.4.1 |
| II. 测试同步 | PASS | 更新在场按钮测试，新增 tooltip 交互测试，运行 `pnpm check` 与产物测试 |
| III. 文档结构 | PASS | README 的在场状态一节补充悬停提示；合并前新增 changelog |
| IV. 质量门禁 | PASS | 变更后运行 `pnpm format && pnpm check` |
| V. 公开引用 | PASS | 文档只引用公网 URL 与仓库内路径 |

## Project Structure

### Documentation (this feature)

```text
specs/051-presence-tooltip/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
src/client/
├── ui/
│   ├── tooltip.tsx          # 新增 shadcn Tooltip 封装
│   └── cn.ts
├── presence-button.tsx      # 按钮接入 tooltip
└── locales.ts               # 现有中英文案

tests/
├── presence-client.test.ts  # 按钮与 tooltip 交互回归
└── client-bundle.test.ts    # 产物包含 Tooltip 样式与依赖
```

**Structure Decision**: 沿用 `src/client/ui` 的 shadcn 组件目录；在场按钮保持现有注册方式，只在按钮外层增加 tooltip。

## Complexity Tracking

无。
