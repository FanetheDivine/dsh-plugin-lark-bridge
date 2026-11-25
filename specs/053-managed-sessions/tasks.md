# Tasks: 调度会话统一管理任务会话

**Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

每个阶段对应一个 commit。阶段内标 `[P]` 的任务可并行。

## Phase 1 数据模型与管理判定

- [x] T001 `src/lark-super-agent/api.ts`：`Task` 改为单 `sessionId`、`workspaceId: string | null`、`cwd`；`REPORT_KINDS` 改为 `progress`、`question`；`SendReportInput` 增加 `desc`；`CreateTaskInput`、`UpdateTaskInput` 调整；删除 `SessionCandidate` 与 `listCandidates`
- [x] T002 `src/lark-super-agent/notes.ts`：zod schema 替换手写校验，校验失败按空台账；写 `version: 2`；`createTask` 接收 `sessionId` 并拒绝重复；`updateTask` 只改状态、标题与追加消息；`endTask(taskId, endReason)` 归档并写 `endReason`；`dropMissingSessions(existing)` 以 `session_missing` 归档
- [x] T003 [P] `src/lark-super-agent/reports.ts`：front matter 增加 `origin` 与 `desc`；`kind` 只接受两个取值
- [x] T004 [P] `src/lark-super-agent/blocks.ts`：`taskSessionMessage`（含 `origin`、`<desc>`）、`taskSessionFailure`、`taskSessionArchived`
- [x] T005 [P] `src/lark-super-agent/worker-model.ts` → `task-model.ts`：读 `taskProvider`、`taskModel`、`taskEffort`、`taskPreset`
- [x] T006 `src/lark-super-agent/service.ts`：`managedTask(sessionId)`、`sendReport` 校验管理状态、`endTask`、`archiveSessionIfMissing`；删除 `listCandidates` 与候选排序
- [x] T007 `tests/lark-super-agent-notes.test.ts`、`tests/lark-super-agent-reports.test.ts`、`tests/lark-super-agent-service.test.ts`、`tests/worker-model.test.ts` → `tests/task-model.test.ts` 同步

## Phase 2 被管理会话能力

- [x] T008 `src/lark-super-agent/managed/report-tool.ts`：`send_report` 定义、`when` 排除调度会话、参数 `desc`
- [x] T009 `src/lark-super-agent/managed/dispatch-message.ts`：由 `src/sa-worker/` 移入并保留帧剥离逻辑
- [x] T010 `src/lark-super-agent/managed/ask-guard.ts`：`tools/pre-execute` 拒绝、`tools/execute` 替换信号、`tools/post-execute` 改写错误、网关取消、离开订阅
- [x] T011 [P] `src/lark-super-agent/managed/task-rules.ts`：S 文本、`source.kind` 为 `lark-task-rules`、按失败次数注入一次
- [x] T012 [P] `src/lark-super-agent/managed/turn-report.ts`：轮次累计、子代理判定、自动上报
- [x] T013 `src/lark-super-agent/managed/index.ts`：接线、失败通知、`workspace/session-archived` 监听、`agent/pre-step` 包装与 S 注入
- [x] T014 删除 `src/sa-worker/`、`rows/sa-worker/`、`tests/sa-worker.test.ts`；新增 `tests/managed-*.test.ts`

## Phase 3 调度会话

- [x] T015 `src/sa-dispatch/tools.ts`：删除 `task_create`、`task_candidates`；`task_update` 精简；新增 `session_manage`、`session_unmanage`、`task_end`
- [x] T016 `src/sa-dispatch/session-create.ts`：去掉 `agent_preset`，必填 `title` 与 `prompt`，创建后建任务并返回 `taskId`
- [x] T017 [P] `src/sa-dispatch/prompt.ts`：按计划「提示词草稿」重写
- [x] T018 [P] `src/sa-dispatch/index.ts`：注入 `taskPreset`，删除在场提醒以外的旧接线
- [x] T019 `tests/sa-dispatch.test.ts`、`tests/session-create.test.ts`、`tests/presets-patch.test.ts`、`tests/pack-report.test.mjs` 同步
- [x] T020 `cordis.patch.yml`、`tsdown.config.ts`、`package.json` 删除 `sa-worker` 入口与导出；`preset-sa-worker` 删除
- [x] T021 `rows/sa-dispatch/locale/*.json` 文案改为「任务会话」

## Phase 4 客户端

- [x] T022 `package.json` 增加 `@deepseek-ai/dsh-client-ui-tool` 开发依赖、`dsh.client.inject` 与 `minimumReleaseAgeExclude`
- [x] T023 `src/client/report-card.tsx`：`tool.call.toolview` 注册 `send_report` 卡片
- [x] T024 [P] `src/client/worker-model-field.tsx` → `task-model-field.tsx`；`src/client/preset-defaults.ts` 参数化
- [x] T025 [P] `src/client/presence-config.tsx` 增加 `taskPreset` 选择器；`src/client/locales.ts` 文案
- [x] T026 `tests/client.test.ts`、`tests/presence-client.test.ts`、`tests/client-bundle.test.ts` 同步

## Phase 5 文档

- [x] T027 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md`、`docs/development.md`、`AGENTS.md` 更新
- [x] T028 `CHANGELOG.md` 条目

## Phase 6 真机验证

- [x] T029 `real-device-test` 跑 [quickstart](./quickstart.md) 全部场景并记录结果
