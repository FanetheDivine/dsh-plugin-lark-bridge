# Tasks: 桥接会话呈现

**Input**: Design documents from `/specs/030-bridge-presentation/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

**Tests**: 宪章 II 要求代码变更同步测试，因此每个用户故事都包含测试任务。

**Organization**: 任务按用户故事分组，每个故事可独立实现与验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且无依赖
- **[Story]**: 用户故事编号（US1、US2、US3）
- 每个任务给出仓库内相对路径

## Path Conventions

单包插件：`src/`、`tests/`、`docs/` 与包根文件。

---

## Phase 1: Setup

**Purpose**: 准备 worktree 的依赖与基线

- [X] T001 在 worktree 根目录运行 `pnpm install --frozen-lockfile` 与 `pnpm check`，确认 `pnpm-lock.yaml` 未变更、基线通过

---

## Phase 2: Foundational

无新增基础设施。Phase 1 完成后三个用户故事可独立开始。

---

## Phase 3: User Story 1 - 桥接会话使用新标题 (Priority: P1) 🎯 MVP

**Goal**: 新建桥接会话标题为「飞书桥接会话」，复用会话保留原标题。

**Independent Test**: 新建会话后查看侧边栏标题；对已有旧标题会话再注入一条消息，确认标题未变。

### Tests for User Story 1

- [X] T002 [US1] 更新 `tests/sessions.test.ts`：首次注入断言 `SESSION_TITLE`；把「复用并同步固定标题」改为「复用保留已有标题」，断言不追加第二个 `session/title` 事件且 `state.title` 保持「历史标题」；归档后新建仍断言新标题

### Implementation for User Story 1

- [X] T003 [P] [US1] 修改 `src/constants.ts`：`SESSION_TITLE` 改为「飞书桥接会话」
- [X] T004 [US1] 修改 `src/sessions.ts`：复用路径移除标题比较与 `store.patch({ title })`，只保留置顶；删除 `syncMeta` 中不再使用的 `title` 与 `createdTitle` 参数
- [X] T005 [US1] 运行 `pnpm typecheck` 与 `pnpm test:code -- tests/sessions.test.ts tests/state.test.ts`，提交本阶段

**Checkpoint**: 标题行为可按 US1 独立验收。

---

## Phase 4: User Story 2 - 插件显示飞书图标 (Priority: P2)

**Goal**: 插件包提供飞书图标并在插件管理器显示。

**Independent Test**: `npm pack --dry-run` 含 `icon.svg`；插件管理器显示飞书标志。

### Tests for User Story 2

- [X] T006 [P] [US2] 新增 `tests/icon.test.ts`：断言 `icon.svg` 存在、以 `<svg` 开头、`viewBox="0 0 36 36"`、含 `<path`、不含 `<script`、`<image>`、`<foreignObject`、`<style`、`on<name>=`；文件 ≤ 262144 字节；`package.json` 的顶层 `icon`、`exports["./icon"]`、`files` 三处声明
- [X] T007 [P] [US2] 扩展 `tests/package-pack.test.ts`：更新文件头注释，断言 tarball 含 `icon.svg`

### Implementation for User Story 2

- [X] T008 [P] [US2] 新增 `icon.svg`：飞书官方三段路径（`#00D6B9`、`#3370FF`、`#133C9A`），去掉白色圆角底板，`width="36" height="36" viewBox="0 0 36 36"`，用 `translate(7 7) scale(1.375)` 居中，加 `<title>` 与来源注释，文件 ≤ 256 KiB
- [X] T009 [P] [US2] 修改 `package.json`：顶层 `icon` 为 `./icon.svg`，`exports` 增加 `"./icon": "./icon.svg"`，`files` 增加 `icon.svg`
- [X] T010 [US2] 运行 `pnpm test:code -- tests/icon.test.ts tests/package-pack.test.ts`，确认 `npm pack --dry-run` 含图标后提交本阶段

**Checkpoint**: 图标可按 US2 独立验收。

---

## Phase 5: User Story 3 - README 只保留简介与前置 (Priority: P3)

**Goal**: README 收敛为标题、npm 徽章、一句简介与「前置」，并同步相关文档与元数据。

**Independent Test**: 阅读 README 只有四个部分；`git diff` 显示「前置」章节无改动。

### Implementation for User Story 3

- [X] T011 [US3] 重写 `README.md`：保留第 1 行标题、第 3 行 npm 徽章、第 5 行「借助lark-cli，让DSH以bot身份和你交互」、`## 前置` 及其正文、命令、列表与结尾说明逐字不变；删除功能、安装、配置、工具、数据、限制、开发章节
- [X] T012 [P] [US3] 更新 `docs/how-it-works.md` 会话小节：新建会话使用「飞书桥接会话」，复用会话保留已有标题
- [X] T013 [P] [US3] 更新 `AGENTS.md` 文档索引：README 条目改为「插件简介与前置」
- [X] T014 [P] [US3] 更新 `locale/zh.json` 与 `locale/en.json` 的 `meta.description`：去掉「以 system-reminder 注入」的旧描述，写当前注入方式
- [X] T015 [P] [US3] 更新 `docs/i18n.md` 包清单示例：加入 `"./icon": "./icon.svg"` 与 `icon.svg`
- [X] T016 [US3] 用 `git diff README.md` 核对「前置」章节逐字未变；运行 `pnpm test:code -- tests/metadata.test.ts` 后提交本阶段

**Checkpoint**: README 与文档可按 US3 独立验收。

---

## Phase 6: Polish

**Purpose**: 变更记录与质量门禁

- [X] T017 更新 `CHANGELOG.md`：新增 `## Unreleased`，记录标题、图标与 README 变化
- [X] T018 运行 `pnpm format && pnpm check && pnpm build`，修复全部问题
- [X] T019 按 `quickstart.md` 的自动化场景复核；确认无实机验证项
- [X] T020 提交收尾，确认 `git status --porcelain` 干净

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 无任务
- **User Stories (Phase 3-5)**: 依赖 Setup；三个故事互不依赖，可按 P1 → P2 → P3 顺序或并行
- **Polish (Phase 6)**: 依赖三个故事完成

### User Story Dependencies

- **US1**: 无依赖
- **US2**: 无依赖
- **US3**: 无依赖

### Within Each User Story

- 测试先写，确认失败后再改实现
- 标题常量与复用逻辑一起改
- 图标文件、清单与测试一起提交

### Parallel Opportunities

- T003 与 T004 可并行编辑不同文件
- T006、T007、T008、T009 可并行
- T012、T013、T014、T015 可并行

---

## Parallel Example: User Story 2

```text
Task: "新增 icon.svg"
Task: "修改 package.json 的 icon 导出与 files"
Task: "新增 tests/icon.test.ts"
Task: "扩展 tests/package-pack.test.ts"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1
2. 完成 US1（T002-T005）
3. 验证新标题与旧会话保留标题
4. 继续 US2、US3

### Incremental Delivery

1. US1 交付标题行为
2. US2 交付图标
3. US3 交付 README 与文档同步
4. Polish 交付 CHANGELOG 与质量门禁

---

## Notes

- 每个阶段以一个 commit 结束
- 不做实机验证（P-002）；图标渲染与 GUI 标题展示保持未验证
- README 「前置」章节以 `git diff` 为准，任何改动都视为失败