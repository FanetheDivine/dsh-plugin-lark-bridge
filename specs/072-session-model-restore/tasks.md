---

description: "Task list for 072-session-model-restore"

---

# Tasks: 调度会话切换会话模型与恢复已归档会话

**Input**: Design documents from `/specs/072-session-model-restore/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: 包含测试任务。宪章要求代码变更同步新增或更新 `tests/`。

**Organization**: 按用户故事分组；每个阶段对应一个 commit。

## Phase 1: 文档与依赖就绪

- [ ] T001 在 worktree 安装依赖并运行 `pnpm check` 确认基线通过
- [ ] T002 提交本特性文档：`specs/072-session-model-restore/` 下的 spec、plan、research、data-model、contracts、quickstart、tasks 与 checklists

## Phase 2: 切换会话模型（US1）

- [ ] T003 [US1] 新增 `src/sa-dispatch/session-model.ts`：`buildSessionModelTool`，参数 `session_id`（省略时取调用方）、`provider`、`model`、`effort`；先 `llm.resolveCallConfig` 校验，再 `agent.model.select`，结果含 `sessionId`、`provider`、`model`、`effort`、`previous`、`archived`
- [ ] T004 [US1] 在 `src/sa-dispatch/index.ts` 的 `sessionController` 注入作用域注册 `session_model`，依赖 `llm` 与 `workspaceRegistry.archivedSessionIds`
- [ ] T005 [US1] 新增 `tests/session-model.test.ts`：参数校验、省略会话 id、校验失败不调用 `model.select`、归档标记、`previous` 透出
- [ ] T006 [US1] 更新 `tests/sa-dispatch.test.ts` 的工具清单断言，覆盖 `session_model` 注册

## Phase 3: 恢复已归档会话（US2）

- [ ] T007 [US2] 扩展 `src/lark-super-agent/api.ts`：`WorkspaceRegistryLike` 增加 `pinSession`，`LarkSuperAgentService` 增加 `restoreSession`
- [ ] T008 [US2] 在 `src/lark-super-agent/notes.ts` 增加归档任务读取与恢复：`latestArchivedTask(sessionId)` 取 `archivedAt` 最新记录；`restoreTask(task)` 迁回 `reports/<taskId>` 与 `task-logs/<taskId>.jsonl`，写回台账，删除归档目录，限定路径提交
- [ ] T009 [US2] 在 `src/lark-super-agent/service.ts` 实现 `restoreSession`：校验归档集合、`unarchiveSession`、按 `session_archived` 恢复任务、`pinSession`、汇总 `warning`
- [ ] T010 [US2] 在 `src/sa-dispatch/tools.ts` 注册 `session_restore`，参数 `session_id`、`pin`（默认 true）
- [ ] T011 [US2] 扩展 `tests/lark-super-agent-notes.test.ts`：归档任务最新记录、迁回报告与日志、删除归档目录、目标已存在时失败、非 `session_archived` 不恢复
- [ ] T012 [US2] 扩展 `tests/lark-super-agent-service.test.ts`：恢复带任务会话、未归档报错、`pin: false`、置顶失败带 `warning`、无工作区根
- [ ] T013 [US2] 扩展 `tests/sa-dispatch.test.ts` 的 `session_restore` 参数转换与结果

## Phase 4: 提示词与文档

- [ ] T014 更新 `src/sa-dispatch/prompt.ts`：模型切换与恢复的规则、成功后的回复要求
- [ ] T015 更新 `README.md` 的调度会话能力、`docs/how-it-works.md` 的台账与归档任务说明、`CHANGELOG.md` 的 Unreleased
- [ ] T016 运行 `pnpm format && pnpm check`，修复问题

## Phase 5: 真实宿主验证

- [ ] T017 按 `quickstart.md` 搭建 profile，确认工具出现在调度会话工具表
- [ ] T018 实机验证模型切换：任务会话下一次请求使用新路由，新建会话默认模型不变
- [ ] T019 实机验证恢复：归档后调用 `session_restore`，任务回到台账、pin 恢复、`send_report` 再次成功
- [ ] T020 记录验证证据到 `specs/072-session-model-restore/evidence/`，处理发现的问题

## Dependencies

- T001 → T002 → T003 → T004 → T005/T006
- T007 → T008 → T009 → T010 → T011/T012/T013
- T014 → T015 → T016 → T017 → T018 → T019 → T020
- US1 与 US2 共用测试文件 `tests/sa-dispatch.test.ts`，串行执行。

## Parallel Opportunities

- T005 与 T006 可在 T004 后并行。
- T011 与 T012 可在 T009 后并行，两者修改不同测试文件。
- US1 与 US2 的源码文件互不重叠，T003 与 T007 可并行。

## Implementation Strategy

1. 先完成 Phase 2 的 MVP：调度会话能切换任意会话模型。
2. 再完成 Phase 3：恢复归档会话与任务。
3. Phase 4 补齐用户可见说明与提示词。
4. Phase 5 在真实宿主验证后再合并。