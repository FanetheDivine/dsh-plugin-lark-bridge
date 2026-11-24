---
description: "Tasks for 044-worker-session-model"
---

# Tasks: 工作会话模型配置

**Commit**: 每个阶段一个 commit。阶段结束前运行 `pnpm format && pnpm check`。

## Phase 1: 宿主侧

- [X] T001 `src/lark-super-agent/config.ts` 增三个字段与 `readWorkerModel`
- [X] T002 新增 `src/lark-super-agent/worker-model.ts` 并接入 service、api、index
- [X] T003 `src/sa-dispatch/index.ts` 与 `src/sa-worker/index.ts` 接入
- [X] T004 不改 `cordis.patch.yml`：schema 默认值为空，减少与同页其他变更的冲突
- [X] T005 测试：`tests/worker-model.test.ts`、更新 sa-dispatch、sa-worker、lark-super-agent-index、presets-patch 测试

**Checkpoint**: commit `feat(044): 调度创建的工作会话使用配置的模型`

## Phase 2: 配置页

- [X] T006 `ModelDefaults` 字段名参数化并更新测试
- [X] T007 配置页增加「工作会话模型」、文案与注入
- [X] T008 测试：配置页字段与草稿写入

**Checkpoint**: commit `feat(044): 配置页增加工作会话模型`

## Phase 3: 文档与验证

- [X] T009 `README.md`、`docs/how-it-works.md`、`CHANGELOG.md`
- [X] T010 `pnpm full-check`
