---
description: "Tasks for 046-session-create-override"
---

# Tasks: 覆写 session_create 套用工作会话模型

**Commit**: 每个阶段一个 commit。阶段结束前运行 `pnpm format && pnpm check`。

## Phase 1: 覆写与清理

- [X] T001 新增 `src/sa-dispatch/session-create.ts`
- [X] T002 `src/sa-dispatch/index.ts` 注册工具并删除 `tools/execute` 包装
- [X] T003 删除 `src/sa-worker/index.ts` 的 `agent/created` 监听与 `WorkerModelStore`
- [X] T004 `workerModel` 改为读取函数
- [X] T005 `cordis.patch.yml` 关闭 meta-tools 的 `session_create`
- [X] T006 测试：`tests/session-create.test.ts`，更新 worker-model、sa-dispatch、sa-worker、presets-patch 测试

**Checkpoint**: commit `feat(046): 覆写 session_create 套用工作会话模型`

## Phase 2: 文档

- [X] T007 `README.md`、`docs/`、`CHANGELOG.md`

**Checkpoint**: commit `docs(046): 说明 session_create 覆写`

## Phase 3: 验证

- [X] T008 `pnpm full-check`
- [X] T009 实机测试并写 `real-device-report.md`
