# Implementation Plan: 设置界面 UI 优化

**Branch**: `028-plugin-ui-polish` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/028-plugin-ui-polish/spec.md`

**Status**: Draft

## Open Decisions

- [x] [P-001] 浮层挂到页面根部还是就地渲染？推荐：挂到 `document.body`；理由：设置弹窗的滚动容器会裁剪就地列表；依赖：none；状态：answered（挂到 document.body）
- [x] [P-002] 交互行为（展开、选中、Esc、复制）怎么测？推荐：引入 jsdom 做 DOM 交互测试；依赖：none；状态：answered（不测，交互在实机验证）
- [x] [P-003] 复制成功态时长怎么实现？推荐：自实现 1.5 秒；依赖：none；状态：answered（用宿主 `useClipboardCopy`，约 1 秒，时长不是需求重点）
- [x] [P-004] 工作区选择器的触发区用什么实现？推荐：宿主 `Button`（outline、md）；理由：直接获得宿主尺寸与交互样式；依赖：none；状态：answered

## Clarifications

### Session 2026-11-20

- [P-001] Q: 浮层挂到页面根部还是就地渲染？ -> A: 挂到 `document.body`。
- [P-002] Q: 交互行为怎么测？ -> A: 不新增自动化测试，交互在真实宿主里验证。
- [P-003] Q: 复制成功态时长怎么实现？ -> A: 用宿主 `useClipboardCopy`，约 1 秒；时长为次要需求。
- [P-004] Q: 触发区用什么实现？ -> A: 宿主 `Button`（outline、md）。

## Review Record

- 2026-11-20 | Decision: Waived | Scope: current full document | Open items: none | Risks: 交互不做自动化测试，依赖实机截图；复制时长跟随宿主 1 秒

## Summary

四个界面改动共用一个原则：把自定义控件换成宿主既有组件与设计变量。

1. 工作区字段保留标题，删除「恢复默认」按钮及其字典键。
2. 连接项的状态文字与检测按钮相邻，按钮文案保持全称。
3. 每条终端命令右侧常驻复制按钮，成功态用宿主 `useClipboardCopy`。
4. 工作区选择改用宿主 `Menu` 下拉卡片，portal 到 `document.body`，替代原生 `select` 浮层。

## Technical Context

**Language/Version**: TypeScript 6.0，React 18.3

**Primary Dependencies**: `@deepseek-ai/dsh-client-ui-primitives`（`Menu`、`Button`、`useClipboardCopy`、`IconChevronDownOutlineRegular`）、`@deepseek-ai/dsh-client-ui-slots`；均为平台种子模块，构建时保持 external

**Storage**: 仅插件配置 `workspaceRoot`

**Testing**: vitest，服务端渲染断言与纯函数测试；交互由实机截图核对

**Target Platform**: DSH Web GUI（浏览器），client 产物为单文件 CJS bundle

**Project Type**: DSH 插件（宿主插件 + 浏览器入口）

**Performance Goals**: 界面渲染与现状一致；下拉选项数量级为个位数到数十

**Constraints**: 不新增运行时依赖；client 构建只允许平台种子保持 external；样式用宿主设计变量与 inline style

**Scale/Scope**: 3 个连接项、N 个已注册工作区、2 处界面（配置页、设置弹窗）

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级 `@deepseek-ai/*` 依赖，版本与 `dsh` 0.2.2-rc.3 对齐 |
| II. 测试同步 | PASS | 更新 `tests/client.test.ts` 对选择器与命令区的断言；不新增依赖；`pnpm check` 与 `pnpm build` 必须通过 |
| III. 文档结构 | PASS | 变更类别写入 `CHANGELOG.md`；`docs/development.md` 的文件地图与测试表同步 |
| IV. 质量门禁 | PASS | 提交前 `pnpm format && pnpm check`，实现完成后 `pnpm build` |
| V. 公开引用 | PASS | spec、plan、quickstart 只用仓库内路径、占位符与本地回环地址 |

## Project Structure

### Documentation (this feature)

```text
specs/028-plugin-ui-polish/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
src/client/
├── config-page.tsx        # WorkspaceSelect：标题保留、删除恢复默认、换成 Menu 下拉
├── auth-overlay.tsx       # 传入新的 WorkspaceSelect 属性
├── auth-panel.tsx         # 检测按钮移到状态文字右侧
├── terminal-command.tsx   # 命令容器 + 复制按钮
└── locales.ts             # 删除 config.reset / config.overridden，新增复制相关文案

tests/
└── client.test.ts         # 更新选择器、命令区与按钮位置的断言

docs/
├── development.md         # 文件地图与测试表
CHANGELOG.md               # Unreleased 记录
```

## Phase 0: Outline & Research

已完成，见 [research.md](./research.md)。结论：

- 下拉用宿主 `Menu`（portal、`selectedId`、`minWidthFromAnchor`）。
- 触发区用宿主 `Button`，外层 `display: grid` 撑满整行。
- 复制用宿主 `useClipboardCopy` 与内联复制图标。
- 检测按钮的位置问题来自状态文字的 `flex: 1`。
- 不引入 jsdom；交互靠实机截图验证。

## Phase 1: Design & Contracts

界面模型见 [data-model.md](./data-model.md)，验证步骤见 [quickstart.md](./quickstart.md)。

无对外接口变更，不生成 `contracts/`。

## Phase 2: Task Planning Approach

按阶段拆分，每个阶段对应一个 commit：

1. 删除「恢复默认」入口与相关字典键。
2. 调整检测按钮位置。
3. 命令区增加复制按钮。
4. 工作区选择换成宿主 `Menu` 下拉。
5. 文档与变更记录。

## Complexity Tracking

无违反宪章的设计。
