---
description: "Tasks for 039-dispatch-session-migration"
---

# Tasks: 迁入飞书任务与调度会话

**Input**: `specs/039-dispatch-session-migration/` 下的 plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Source**: 组合包 `dsh-plugin-practical-tool-bundle` 的 `main`（`cc3c25d`）。下文「逐字复制」指用 `git -C <组合包> show main:<路径>` 取出内容写入本仓同名路径。

**Tests**: 规格 FR-015 要求迁入组合包测试并回归打包内容。

**Commit**: 每个阶段一个 commit。阶段结束前运行 `pnpm format && pnpm check`。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且不依赖未完成任务
- **[Story]**: 对应 spec.md 的用户故事

---

## Phase 1: Setup（包结构与依赖）

**Purpose**: 新入口、行目录与依赖就位，`pnpm check` 通过

- [X] T001 在 `package.json` 增加 `dependencies: { "dsh-plugin-meta-tools": "0.1.7" }`、`devDependencies.yaml: ^2.9.1`、`keywords` 中的 `lark-super-agent` 与 `dispatch`；`files` 增加 `rows`；`exports` 增加 `./lark-super-agent`、`./sa-dispatch`、`./sa-worker` 三个模块（`types` 为 `./dist/<row>/index.d.ts`，`import` 为 `./dist/<row>.mjs`），以及各自的 `./<row>/locale/*.json` 与 `./<row>/icon`
- [X] T002 在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 增加 `dsh-plugin-meta-tools@0.1.7`，运行 `pnpm install` 更新 `pnpm-lock.yaml`
- [X] T003 [P] 在 `tsdown.config.ts` 宿主构建把 `entry` 改为对象：`index`、`lark-super-agent`、`sa-dispatch`、`sa-worker` 分别指向 `src/index.ts` 与 `src/<row>/index.ts`；更新文件顶部注释
- [X] T004 [P] 逐字复制 `rows/lark-super-agent/`、`rows/sa-dispatch/`、`rows/sa-worker/` 的 `icon.svg` 与 `locale/{zh,en}.json`；按 plan A-05 把 `rows/sa-worker/locale/zh.json` 标题改为 `SA-工作会话`；按 plan A-06 改写 `rows/lark-super-agent/locale/{zh,en}.json` 描述
- [X] T005 [P] 更新 `tests/package-pack.test.ts`：包内含 `dist/lark-super-agent.mjs`、`dist/sa-dispatch.mjs`、`dist/sa-worker.mjs` 与三行的 `rows/*/locale/*.json`、`rows/*/icon.svg`；`dependencies` 含 `dsh-plugin-meta-tools`
- [X] T006 [P] 更新 `tests/metadata.test.ts`：三行元数据通过与根行相同的结构、键集与禁用字符校验，`exports` 声明三行的 locale 与 icon；更新 `tests/package-metadata.test.ts` 中受新字段影响的断言

**Checkpoint**: commit `feat(039): 增加调度行的包结构与依赖`

---

## Phase 2: Foundational（调度服务）

**Purpose**: `lark-super-agent` 全局行提供 `larkSuperAgent` 服务，所有用户故事都依赖它

- [X] T007 逐字复制 `src/lark-super-agent/{api,blocks,bridge,git,ids,notes,reports,service,index}.ts`，不复制 `status.ts`
- [X] T008 按 plan A-01、A-02 修改：删除 `service.ts` 的 `status()` 与对 `status.ts` 的引用、`api.ts` 的 `status` 成员；`index.ts` 只保留 `ctx.effect(() => ctx.provide('larkSuperAgent', service))`，删除 `connection` 注入、路由与 `../rows.ts`、`../utils.ts` 引用；更新文件顶部注释
- [X] T009 按 plan A-04 把 `../types.ts` 引用对齐本仓 `src/types.ts` 的 `Context`；补齐类型检查需要的最小改动
- [X] T010 按 plan A-03 在 `src/lark-super-agent/service.ts` 读取 `workspaceRoot` 后经 `src/workspace-path.ts` 的 `toHostWorkspacePath` 转换，再用于 `NotesStore`、`ReportStore`；`sendReport` 与 `notifyFailure` 同样处理
- [X] T011 [P] 逐字复制 `tests/lark-super-agent-{blocks,git,notes,reports,service,index}.test.ts`；`index` 测试删除路由断言，只断言 `provide('larkSuperAgent')`
- [X] T012 在 `tests/lark-super-agent-service.test.ts` 增加用例：`state.json` 的 `workspaceRoot` 为 Linux 风格路径时，服务在 `win32` 平台写入转换后的原生目录；POSIX 路径保持原样

**Checkpoint**: commit `feat(039): 迁入 lark-super-agent 调度服务`

---

## Phase 3: User Story 1 - 只装本插件即可远程派发任务 (Priority: P1) 🎯 MVP

**Goal**: `SA-调度会话` 预设与五个调度工具可用，在场提醒随行（同时交付 US4 的调度会话部分）

**Independent Test**: `pnpm check` 中 `sa-dispatch` 与预设补丁测试通过；实机 RD-2、RD-3

- [X] T013 [US1] 逐字复制 `src/sa-dispatch/{index,presence,prompt,tools}.ts`；`presence.ts` 中桥接来源 `'lark-bridge'` 保持与 `src/message.ts` 的 `LARK_SOURCE.kind` 一致
- [X] T014 [US1] 在 `cordis.patch.yml` 主行之后插入 `lark-super-agent`（`name: dsh-plugin-lark-bridge/lark-super-agent`）与 `preset-sa-dispatch`，内容按 `contracts/presets.md`，子行 `sa-dispatch.name` 为 `dsh-plugin-lark-bridge/sa-dispatch`；更新文件顶部注释
- [X] T015 [P] [US1] 逐字复制 `tests/sa-dispatch.test.ts`，改用本仓 `tests/helpers.ts` 的 `makeCtx`
- [X] T016 [P] [US1] 逐字复制 `tests/support/standard-preset.yml`；新建 `tests/presets-patch.test.ts`，取组合包同名测试中 `lark-super-agent` 行与 `preset-sa-dispatch` 的断言，删去组合包其他行的断言

**Checkpoint**: commit `feat(039): 迁入 SA-调度会话预设`

---

## Phase 4: User Story 2 - 任务上报与完成归档 (Priority: P1)

**Goal**: `SA-工作会话` 预设提供 `send_report`、调度消息标记与失败通知（同时交付 US4 的工作会话部分）

**Independent Test**: `pnpm check` 中 `sa-worker` 与预设补丁测试通过；实机 RD-4

- [X] T017 [US2] 逐字复制 `src/sa-worker/{dispatch-message,host,index,prompt,tools}.ts`；文件顶部注释中的预设名改为 `SA-工作会话`
- [X] T018 [US2] 在 `cordis.patch.yml` 增加 `preset-sa-worker`，`config.name` 为 `SA-工作会话`，子行 `sa-worker.name` 为 `dsh-plugin-lark-bridge/sa-worker`，其余按 `contracts/presets.md`
- [X] T019 [P] [US2] 逐字复制 `tests/sa-worker.test.ts`，改用本仓 `tests/helpers.ts` 的 `makeCtx`
- [X] T020 [US2] 在 `tests/presets-patch.test.ts` 补入组合包对 `preset-sa-worker` 的断言，预设名断言为 `SA-工作会话`

**Checkpoint**: commit `feat(039): 迁入 SA-工作会话预设`

---

## Phase 5: User Story 3、5 - 升级衔接与现有功能回归 (Priority: P2、P3)

**Goal**: 组合包写入的数据可直接读写；停用调度行不影响桥接

**Independent Test**: 新增测试通过，现有 `tests/plugin.test.ts` 等不改动且通过

- [X] T021 [P] [US3] 在 `tests/lark-super-agent-service.test.ts` 增加用例：预置一份组合包格式的 `message-task-status.json` 与 `workspaces.json`，服务 `updateTask` 与 `listCandidates` 读写成功且格式不变
- [X] T022 [P] [US5] 在 `tests/presets-patch.test.ts` 增加断言：主行 `dsh-plugin-lark-bridge` 的配置仍只有 `workspaceRoot: ''`，补丁不改动主行与 `agent-preset-registry`
- [X] T023 [US5] 运行 `pnpm full-check`，确认 `dist` 只新增三个宿主入口，现有测试零改动通过

**Checkpoint**: commit `test(039): 覆盖升级数据与现有功能回归`

---

## Phase 6: Polish（文档、元数据与 CHANGELOG）

- [ ] T024 [P] 按 plan A-07 更新 `locale/zh.json`、`locale/en.json` 与 `package.json` 的 `description`
- [ ] T025 [P] `README.md` 增加「飞书任务与调度会话」章节：从组合包 README 的「飞书任务与调度会话」「远程调度用法」「两个预设」「上报与注入」「笔记、git 与归档」搬入，删去组合包安装与其他行的内容，预设名用 `SA-工作会话`
- [ ] T026 [P] `docs/how-it-works.md` 组成表增加三行与 `rows/`，并从组合包同名文档搬入「调度服务与预设叠加」「调度工作区存储」「上报投递与失败监听」，删去状态路由句子，补一句 `workspaceRoot` 经 `toHostWorkspacePath` 转换
- [ ] T027 [P] `docs/known-risks.md` 从组合包搬入 `lark-super-agent` 各小节，删去状态路由相关句；增加与旧版组合包并存时重复注册一条
- [ ] T028 [P] `docs/development.md` 测试表与文件地图增加新源码、`rows/` 与测试文件；`docs/i18n.md` 元数据资源增加 `rows/<row>/locale/*.json` 与对应 `exports`
- [ ] T029 [P] `AGENTS.md` 项目说明补充调度会话与两个预设
- [ ] T030 `CHANGELOG.md` 的 `Unreleased` 增加 `Added` 条目：迁入调度服务、`SA-调度会话`、`SA-工作会话` 与 `dsh-plugin-meta-tools` 依赖；`Changed` 条目：插件标题与描述
- [ ] T031 运行 `pnpm format && pnpm full-check`

**Checkpoint**: commit `docs(039): 同步调度功能文档与元数据`

---

## Phase 7: 实机验证

- [ ] T032 按 `quickstart.md` 执行 RD-1 至 RD-5，结果写入 `specs/039-dispatch-session-migration/real-device-report.md`

**Checkpoint**: commit `test(039): 实机验证报告`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6 → Phase 7。
- Phase 3 与 Phase 4 都写 `cordis.patch.yml` 与 `tests/presets-patch.test.ts`，必须串行。
- Phase 6 的 [P] 任务文件互不相同，可交给子代理并行。

## Parallel Example

```text
Phase 1: T003、T004、T005、T006 并行
Phase 2: T011 与 T008–T010 并行
Phase 6: T024–T029 并行
```

## Implementation Strategy

- MVP：Phase 1–3 完成后，`SA-调度会话` 可派发任务。
- Phase 4 补齐上报闭环，Phase 5–7 完成回归、文档与实机验证。
