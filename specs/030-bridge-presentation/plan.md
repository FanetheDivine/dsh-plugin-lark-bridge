# Implementation Plan: 桥接会话呈现

**Branch**: `feat/030-bridge-presentation` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/030-bridge-presentation/spec.md`

**Status**: Approved

## Open Decisions

待确认决策：无，实现决策见 `## Clarifications`。

## Clarifications

### Session 2026-11-21

- [P-001] Q: 图标 SVG 是否保留官方白色圆角底板？ -> A: 去掉底板，透明背景。
- [P-002] Q: 验证是否包含一次性 profile 的实机测试？ -> A: 不做实机验证。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 未做一次性 profile 实机验证，图标渲染与 GUI 标题展示未验证

## Summary

把新建桥接会话的标题改为「飞书桥接会话」，复用会话保持原标题。为插件增加飞书官方标志 SVG，声明为包级图标并随包发布。README 收敛为标题、npm 徽章、一句简介与「前置」章节，并同步文档、元数据与 CHANGELOG。飞书消息呈现与提醒保持现状。

## Technical Context

**Language/Version**: TypeScript 6.0，Node.js ≥ 24.9，target es2024

**Primary Dependencies**: 现有 `@deepseek-ai/*@0.2.2-rc.3`；不新增依赖

**Storage**: `$DSH_HOME/lark-bridge/state.json` 结构不变；`title` 字段在复用路径不再改写

**Testing**: vitest `code` 与 `dist` project，`npm pack --dry-run` 回归打包内容；不做实机验证

**Target Platform**: DSH 插件（Node 宿主 + Web Client）

**Project Type**: 单包插件

**Performance Goals**: 复用路径少一次标题比较与状态写入；图标为静态文件，无运行时开销

**Constraints**: 只影响新建会话标题；README 的「前置」章节逐字保留；图标 ≤ 256 KiB 且为宿主可解码的 SVG

**Scale/Scope**: 单用户、单工作区、单桥接会话

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级 `@deepseek-ai/*` 依赖 |
| II. 测试同步 | PASS | 更新 `tests/sessions.test.ts`，新增 `tests/icon.test.ts`，扩展 `tests/package-pack.test.ts`；实机验证按用户决定跳过（宪章列为 SHOULD） |
| III. 文档结构 | PASS（偏离已批准） | README 按用户要求删除安装、配置、工具章节；D-005 同步机制文档、元数据与 CHANGELOG；偏离记入 Complexity Tracking |
| IV. 质量门禁 | PASS | 提交前运行 `pnpm format && pnpm check` |
| V. 公开引用 | PASS | 新增引用只有仓库内路径与飞书官方站点的公网 URL |

Phase 1 复核：设计产物与上表结论一致，无新增违规。

## Project Structure

### Documentation (this feature)

```text
specs/030-bridge-presentation/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md          # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── constants.ts      # 修改：SESSION_TITLE
└── sessions.ts       # 修改：复用路径不再改写标题

icon.svg              # 新增：飞书标志图标
package.json          # 修改：icon 导出与 files
README.md             # 修改：收敛为简介与前置
AGENTS.md             # 修改：文档索引中的 README 描述
CHANGELOG.md          # 修改：Unreleased 条目
locale/
├── zh.json           # 修改：meta.description
└── en.json           # 修改：meta.description
docs/
├── how-it-works.md   # 修改：会话标题规则
└── i18n.md           # 修改：清单示例加入图标导出
tests/
├── sessions.test.ts  # 修改：新标题与复用不改标题
├── icon.test.ts      # 新增：图标文件与清单声明
└── package-pack.test.ts # 修改：tarball 含 icon.svg
```

**Structure Decision**: 单包插件沿用现有 `src/`、`tests/`、`docs/` 布局；图标放在包根，与 `package.json` 的 `files`、`exports` 同级。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| README 删除安装、配置、工具章节，违反宪章 III 对 README 的内容归属 | 用户明确要求 README 只保留简介与前置（D-003、D-006） | 保留安装、配置、工具会违背用户要求；详情页仍使用 README（D-007） |