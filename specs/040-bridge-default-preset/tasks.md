# Implementation Tasks: 桥接会话默认预设

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-23

**输入**: 设计文档来自 `specs/040-bridge-default-preset/`

## Phase 1: Setup

- [x] T001 在 worktree 根目录运行 `pnpm install`，确认依赖可用；本阶段不产生提交

## Phase 2: Foundational

无。默认值与菜单改动互不依赖。

## Phase 3: User Story 1 - 新装后直接使用调度预设 (P1)

**目标**: 未保存过预设的配置使用 `sa-dispatch`，配置页与新建会话都按该预设运行。

**独立验证**: `Config({})` 与 `DEFAULT_CONFIG` 的 `sessionPreset` 为 `sa-dispatch`，`presetOf(resolveConfig({}))` 返回 `sa-dispatch`。

- [x] T002 [US1] 把 `src/config.ts` 中 `Config` schema 与 `DEFAULT_CONFIG` 的 `sessionPreset` 缺省值改为 `sa-dispatch`，并更新字段注释说明默认值与空值含义
- [x] T003 [US1] 把 `tests/plugin.test.ts` 的 `sessionPreset` 断言与 `DEFAULT_CONFIG` 期望改为 `sa-dispatch`
- [x] T004 [US1] 运行 `pnpm test:code -- tests/plugin.test.ts` 通过后提交本阶段 commit

## Phase 4: User Story 2 - 用户仍可改用其他预设 (P2)

**目标**: 预设菜单只列可用预设，旧配置的空值继续显示「跟随宿主默认」。

**独立验证**: `menuItems` 不包含 id 为空的条目；`currentText` 对空值返回「跟随宿主默认」。

- [x] T005 [US2] 从 `src/client/preset-select.tsx` 的 `menuItems` 移除「跟随宿主默认」项，保留 `currentText` 的空值文案并更新注释
- [x] T006 [US2] 更新 `tests/client.test.ts` 的菜单用例为「首项为预设、不可用的已存值以禁用项补足」，并把空值文案用例改名为旧配置场景
- [x] T007 [US2] 运行 `pnpm test:code -- tests/client.test.ts` 通过后提交本阶段 commit

## Phase 5: Polish & Cross-Cutting Concerns

- [x] T008 更新 `README.md` 的「飞书任务与调度会话」启用步骤：去掉手动选预设，写明默认预设与改选方式
- [x] T009 更新 `docs/known-risks.md` 的预设小节为「预设默认与改选」，写明默认值与改选后的能力缺失
- [x] T010 更新 `docs/how-it-works.md` 的配置小节，写明 `sessionPreset` 缺省 `sa-dispatch`、空值跟随宿主默认
- [x] T011 在 `CHANGELOG.md` 的 Unreleased 下新增 Changed 条目，版本号保持 `0.3.0`
- [x] T012 运行 `pnpm format && pnpm check` 通过后提交本阶段 commit

## Dependencies & Execution Order

- T001 阻塞全部实现与验证。
- T002 阻塞 T003、T004。
- T005 阻塞 T006、T007。
- T004、T007 阻塞 T008–T012。
- 文档阶段在代码阶段之后，主题一致便于审查。

## Parallel Execution Examples

- T002 与 T005 修改不同文件，可并行。
- T008、T009、T010、T011 修改不同文件，可并行。

## Implementation Strategy

MVP 是 Phase 3：只改缺省值即可让新装用户使用 `SA-调度会话`。Phase 4 修正菜单语义，Phase 5 同步文档与 CHANGELOG。

## Notes

- 每个阶段对应一个 commit。
- 测试范围按 D-004 只更新现有断言，不新增用例。
- 实际跑测试前先完成 T001。
