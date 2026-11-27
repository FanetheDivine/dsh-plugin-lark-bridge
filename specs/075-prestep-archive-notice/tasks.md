# Tasks: 归档通知改为 pre-step 注入并补充调度信号分层文档

**Input**: Design documents from `/specs/075-prestep-archive-notice/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: 每个阶段对应一个 commit。

## Phase 1: 待注入记录与归档接线 (US1)

**Goal**: 归档时结束任务并持久化待注入记录，不再即时 `steer`；恢复会话时删除记录。

**Independent Test**: 归档被管理会话后调度 agent 未被调用，`archive-notices.json` 出现记录；`session_restore` 后记录消失。

- [x] T001 [P] [US1] 新增 `src/lark-super-agent/archive-notices.ts`：`ArchiveNotice`（`id`、`taskId`、`sessionId`、`time`）、`ARCHIVE_NOTICES_FILE`、`readArchiveNotices`、`appendArchiveNotice`、`removeArchiveNotices`；全部在 `runSerial(root)` 内读写，文件缺失或损坏按空列表
- [x] T002 [P] [US1] 修改 `src/lark-super-agent/blocks.ts` 的 `taskSessionArchived`：增加 `id` 属性，输出 `<task_session_archived id="…" sessionid="…" taskid="…"/>`
- [x] T003 [US1] 修改 `src/lark-super-agent/service.ts`：`notifyArchived` 结束任务后追加记录，去掉 `deliver`；无工作区或写记录失败只记日志；`restoreSession` 恢复任务成功后删除该任务的记录，失败写 warning
- [x] T004 [P] [US1] 更新 `tests/lark-super-agent-blocks.test.ts`：归档块带 `id` 属性并转义
- [x] T005 [P] [US1] 更新 `tests/lark-super-agent-service.test.ts`：归档用例断言无 `steer`、记录已写入、任务已归档；无任务不写记录；`session_restore` 删除记录
- [x] T006 [US1] 新增 `tests/archive-notices.test.ts`：追加、读取、删除、重复追加、损坏文件按空

## Phase 2: pre-step 注入与去重 (US2、US3)

**Goal**: 调度会话下一次 pre-step 把待注入记录并入任务日志注入消息，事件日志出现标记后删除记录。

**Independent Test**: 归档后触发两次 pre-step，第一次消息末尾出现归档块，第二次不出现；压缩与插件重启后不重复。

- [x] T007 [US2] 修改 `src/lark-super-agent/managed/task-log-injector.ts`：`ScanState` 记住已出现的 `<task_session_archived id="…"`；`build` 追加未注入的通知块（无日志也有通知时仍返回消息）；扫描后删除已出现的记录；新增可选 `logger` 记录删除失败
- [x] T008 [US2] 修改 `src/lark-super-agent/managed/index.ts`：构造 `TaskLogInjector` 时传 `logger`
- [x] T009 [US2] 在 `tests/managed-task-log.test.ts` 增加注入用例：归档后注入在日志条目之后、第二次不重复、未写入事件日志时下次重注、重启后不重复
- [x] T010 [P] [US3] 在 `tests/managed-task-log.test.ts` 增加恢复用例：归档后恢复不注入；无工作区、无任务不写记录

## Phase 3: 提示词与文档 (US4)

**Goal**: 语义改为「重要消息，随注入到达，不因此通知用户」，并新增三类信号文档。

**Independent Test**: 提示词不含「告知用户」的归档要求；`docs/dispatch-signals.md` 的成员表与代码一致。

- [x] T011 [US4] 修改 `src/sa-dispatch/prompt.ts`：归档段改为随下一次注入到达、不要因它通知用户
- [x] T012 [P] [US4] 更新 `tests/sa-dispatch.test.ts`：提示词断言同步
- [x] T013 [P] [US4] 新增 `docs/dispatch-signals.md`：紧急、重要、日志三类的定义、成员与投递方式
- [x] T014 [P] [US4] 更新 `docs/how-it-works.md`：归档通知行、任务日志注入段、调度工作区存储段，并链接新文档
- [x] T015 [P] [US4] 更新 `docs/known-risks.md`：归档通知延迟可见与工作区切换丢失的取舍
- [x] T016 [P] [US4] 更新 `README.md`：用户可见的归档通知时机
- [x] T017 [US4] 更新 `AGENTS.md` 文档索引：加入 `docs/dispatch-signals.md`

## Phase 4: 质量门禁

- [x] T018 运行 `pnpm format && pnpm check`，修复告警
- [x] T019 运行 `pnpm test:code`，全量通过
- [x] T020 运行 `pnpm build`，`test:dist` 通过

## Dependencies

- Phase 1 先于 Phase 2；Phase 3 依赖 Phase 1 的行为（提示词与文档描述新链路）。
- T001、T002 可并行；T004、T005 依赖 T002/T003；T006 依赖 T001。
- T009、T010 依赖 T007、T008。

## Parallel Example

```text
T001 存储模块 ─┐
T002 块形态   ─┼─> T003 服务接线 ─> T004/T005 测试
T006 存储测试 ┘
T007 注入器 ─> T008 接线 ─> T009/T010 测试
T011 提示词 ─> T012 测试；T013～T017 文档可并行
```