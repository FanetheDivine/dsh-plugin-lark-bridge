---
description: "Task list for 038-icon-full-bleed"
---

# Tasks: 插件图标铺满与元数据文案

**Input**: Design documents from `/specs/038-icon-full-bleed/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 用户决定不新增测试（见 plan 的 D-101 与 Complexity Tracking），因此没有测试任务；只保留既有测试回归。

**Organization**: 每个阶段对应一个 commit（AGENTS.md 要求）。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件，无未完成依赖）
- **[Story]**: 所属用户故事
- 描述包含确切文件路径

## Phase 1: Setup

**目的**: 清理临时文件，把规格、计划与任务落成第一个 commit。

- [X] T001 删除 worktree 根目录的临时文件 `.tmp-spec-template.json`、`.tmp-tasks.json`、`.tmp-preview.mjs`、`.tmp-preview.png`、`.tmp-bbox.mjs`
- [X] T002 确认 `git status --porcelain` 只包含 `specs/038-icon-full-bleed/`、`.specify/feature.json`；提交规格、计划与任务，commit 说明 `docs(038): 规格、计划与任务`

## Phase 2: Foundational

无阻塞任务。图标与元数据各自独立，直接进入用户故事。

## Phase 3: User Story 1 - 插件图标满幅显示 (P1)

**目标**: 图形墨水盒由 18.05×14.35 变为 36×28.61，左右相切、上下居中。

**独立验证**: 一次性脚本计算变换后墨水盒；既有 `tests/icon.test.ts` 通过。

- [X] T003 [US1] 修改 `icon.svg`：`<g>` 变换改为 `translate(-4.77117 -3.94208) scale(2.7426524)`，保留 `viewBox="0 0 36 36"`、`<title>`、三条路径与品牌色
- [X] T004 [US1] 用一次性 Node 脚本解析 `icon.svg` 的路径与变换，输出变换后墨水盒；断言宽度 36（±0.1）、高度 28.61（±0.2）、左右间距 0、上下留白各 3.693（±0.1），脚本不写入仓库
- [X] T005 [US1] 运行 `pnpm test:code -- tests/icon.test.ts`，确认画布、背景、颜色、禁用元素、体积与清单断言仍然通过
- [X] T006 [US1] 提交图标改动，commit 说明 `fix(038): 图标图形等比铺满画布宽度`

## Phase 4: User Story 2 - 标题与描述说明用途与手机使用 (P2)

**目标**: 中英文标题与描述替换，`package.json` 的 `description` 同步。

**独立验证**: `pnpm test:code -- tests/metadata.test.ts` 通过；`npm pack --dry-run --json` 的包描述为新文案。

- [X] T007 [P] [US2] 修改 `locale/zh.json`：`meta.title` 为「用飞书连接DSH」，`meta.description` 为「配置lark-cli，用在手机上也可以和DSH对话」
- [X] T008 [P] [US2] 修改 `locale/en.json`：`meta.title` 为 `Connect DSH from Lark`，`meta.description` 为 `Configure lark-cli so you can talk to DSH from your phone too.`
- [X] T009 [P] [US2] 修改 `package.json` 的 `description` 为「配置lark-cli，用在手机上也可以和DSH对话」
- [X] T010 [US2] 运行 `pnpm test:code -- tests/metadata.test.ts` 与 `npm pack --dry-run --json`，确认键集、非空、单行断言通过，包内仍含 `icon.svg` 与 `locale/*.json`，`package.json` 的 `description` 为新文案
- [X] T011 [US2] 提交元数据改动，commit 说明 `feat(038): 插件标题与描述改为飞书连接 DSH`

## Phase 5: User Story 3 - 小尺寸与宿主约束下仍正常 (P3)

**目标**: 30px 行尺寸可辨识，宿主解码不回退默认图，停用状态下文案可读。

**独立验证**: 实机截图与文案核对。

- [X] T012 [US3] 按 `.dsh/skills/real-device-test` 的 setup-env.sh 搭建隔离 profile，构建后用 gui-up.sh 启动 GUI
- [X] T013 [US3] 在浏览器驱动中核对：卡片图标图形宽度与宿主内框差 ≤1px；行图标 30px 下三段色块可辨；中英文标题描述逐字匹配；停用插件后行标题与描述不变；截图存入 profile 的 `shots/`
- [X] T014 [US3] 结束 GUI 进程并删除隔离 profile；把验证结果写入本文件的「实机验证记录」

## Phase 6: Polish & Cross-Cutting Concerns

**目的**: 变更记录与质量门禁。

- [X] T015 [P] 在 `CHANGELOG.md` 新增 `## Unreleased` 与 `### Changed`，记录图标铺满与标题描述变更
- [X] T016 运行 `pnpm format && pnpm check`，确认类型检查、lint 与全部源码测试通过
- [X] T017 提交收尾改动，commit 说明 `chore(038): 图标与文案变更记录`

## 依赖关系

- Phase 3 与 Phase 4 互不依赖，可并行；Phase 3 的 T003 与 Phase 4 的 T007–T009 改不同文件。
- Phase 5 依赖 Phase 3 与 Phase 4 的全部改动。
- Phase 6 的 T015 依赖 Phase 3 与 Phase 4 完成；T016依赖全部改动。

## 并行示例

- Phase 4：T007、T008、T009 三个文件互不依赖，可同时进行。

## 实施顺序

按阶段顺序提交：先 P1 图标（用户报告的问题），再 P2 元数据，再 P3 实机验证，最后收尾。

## 实机验证记录

**环境**：全局 `dsh` 0.2.2-rc.5，隔离 profile `rdt-038`，插件以 link 方式装入当前检出；验证后已删除 profile。搭建时把 setup-env.sh 写入的 `prefix: rdt` 改为本插件的 `workspaceRoot: ""`，否则配置校验失败。

**卡片图标**（48px 底板，图片 36×36，naturalWidth 36，4 倍截图）：

- 墨水盒 144×116 设备像素，即 36×29 CSS 像素；左右间距 0，上下各 14 设备像素，即 3.5 CSS 像素。
- 与目标 36×28.61、上下各 3.693 一致；差值来自抗锯齿，误差 1 设备像素。

**行图标**（40px 底板，图片 30×30，4 倍截图）：

- 墨水盒 120×96 设备像素，即 30×24 CSS 像素；左右间距 0，上下各 3 CSS 像素。

**文案**：

- 中文：用飞书连接DSH / 配置lark-cli，用在手机上也可以和DSH对话。
- 英文：Connect DSH from Lark / Configure lark-cli so you can talk to DSH from your phone too.
- 停用态：在 profile 的 `cordis.patch.yml` 给插件行加 `disabled: true` 并重启 GUI 后，卡片开关为 `aria-checked="false"`，标题与描述不变。

**结论**：图标铺满、两种语言文案与停用态均符合 spec。
