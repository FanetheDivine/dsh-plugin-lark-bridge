# Implementation Plan: 插件图标铺满与元数据文案

**Branch**: `fix/038-icon-full-bleed` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/038-icon-full-bleed/spec.md`

**Status**: Approved

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Open Decisions

无未决项。

## Clarifications

### Session 2026-11-23

- [D-101] Q: `icon.test.ts` 的几何断言用哪种实现？ -> A: 不测试。不新增几何断言，也不新增 `tests/support/` 辅助。
- [D-102] Q: 实机验证在哪里做？ -> A: real-device-test 隔离 profile，验证后删除。
- [D-103] Q: 标题与描述文案是否加逐字单元测试？ -> A: 不加，由实机与打包核对覆盖。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 图标几何无自动回归保护（用户选择不测试）；上下留白 3.69 单位；图形左右与宿主 0.5px 描边相切

## Summary

把插件图标的图形墨水盒从 18.05×14.35 单位放大到 36×28.61 单位：等比按宽度铺满 36 单位画布，左右相切、上下居中。同时把插件标题与描述改为「用飞书连接DSH」/「配置lark-cli，用在手机上也可以和DSH对话」，英文同步为 `Connect DSH from Lark` / `Configure lark-cli so you can talk to DSH from your phone too.`，`package.json` 的 `description` 同步中文新描述。

技术途径：只改 `icon.svg` 的 `<g transform>`、两份 locale 的 `meta` 与 `package.json` 的 `description`；不新增测试；`CHANGELOG.md` 增加 `## Unreleased`；最后在隔离 profile 中做实机验证。

## Technical Context

**Language/Version**: TypeScript 6.0.3，Node.js ≥24.9.0

**Primary Dependencies**: 无新增；测试用 vitest 4.1.10，静态资产为 `icon.svg` 与 `locale/*.json`

**Storage**: 包内静态文件（SVG、JSON），无运行时存储变更

**Testing**: `pnpm test:code`（vitest，node 环境）；`pnpm check`；`npm pack --dry-run --json`；实机验证用 `.dsh/skills/real-device-test`

**Target Platform**: DSH 宿主（Plugin Manager 与 Settings 前端），Chrome 内核渲染

**Project Type**: 单仓库 DSH 插件包（TypeScript 源 + 静态资产）

**Performance Goals**: 无性能指标；图标解码与文案读取为宿主启动期一次操作

**Constraints**: 图标自包含、透明背景、≤256 KiB、36×36 画布；locale 两份基线语言键集一致；`package.json` 的 `files` 不得遗漏资产

**Scale/Scope**: 4 个资产与清单文件（`icon.svg`、`locale/zh.json`、`locale/en.json`、`package.json`）+ `CHANGELOG.md`；测试文件不变

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 无 `@deepseek-ai/*` 依赖变更，`package.json` 依赖块不动 |
| II. 测试同步 | 偏离（用户要求） | 用户决定不新增几何断言，`tests/icon.test.ts` 与 `tests/metadata.test.ts` 保持不变且继续通过；铺满效果由实机截图测量核对。偏离记录见 Complexity Tracking |
| III. 文档结构 | PASS | 变更记录写入 `CHANGELOG.md`（宪章规定分支在 push 时维护）；README 不含图标几何与元数据文案说明，用户决定只加 CHANGELOG；历史 spec 不改，由 038 记录本次决策 |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check`，合并前再跑 `pnpm check` |
| V. 公开引用 | PASS | 新增文档不写本机绝对路径；实机验证路径以仓库内 `.dsh/skills/real-device-test` 相对路径引用 |

## Project Structure

### Documentation (this feature)

```text
specs/038-icon-full-bleed/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
icon.svg                    # 图形变换改为等比铺满画布宽度
package.json                # description 同步中文新描述
locale/zh.json              # meta.title 与 meta.description
locale/en.json              # meta.title 与 meta.description
CHANGELOG.md                # Unreleased → Changed
```

**Structure Decision**: 单仓库插件包。图标与 locale 是包根静态资产，本次不新增目录，也不改测试。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 宪章 II 要求代码变更同步测试；本次不新增几何断言 | 用户要求（用户要求） | 纯 TS 路径解析辅助会新增测试基础设施，用户选择不测试；铺满效果改由实机截图测量核对 |

图标尺寸偏离宿主 `artwork.md` 的 18–22 单位建议属于用户明确要求，记录在 spec 的 Review Record 风险中。
