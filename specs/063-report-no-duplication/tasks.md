# Tasks: 上报之后正文只作简短收尾

**Input**: Design documents from `/specs/063-report-no-duplication/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, quickstart.md

**Tests**: 宪法原则 II 要求变更同步测试。三处文案是交付物本身，测试为形式断言；`turn_end` 与投递链路靠既有用例证明零行为变更。

**Organization**: 三个用户故事分别对应三处文本常量，合并为一个实现阶段；阶段对应 commit。

## Phase 1: 规格与计划产物

**Goal**: Spec Kit 产物随分支落盘。

**Independent Test**: `specs/063-report-no-duplication/` 含 spec、plan、research、quickstart、tasks 与需求清单。

- [x] T001 [P] 写入 `specs/063-report-no-duplication/spec.md`、`plan.md`、`research.md`、`quickstart.md` 与 `tasks.md`
- [x] T002 写入 `specs/063-report-no-duplication/checklists/requirements.md` 并核对全部条目

**Checkpoint**: commit `docs(063): 起草上报后正文收尾规格与需求清单` 与 `docs(063): 完成文案改动实现计划与调研`

## Phase 2: US1、US2、US3 — 三处文案规定上报后正文只作简短收尾

**Goal**: 上报送达后正文只写一句收尾或留空；上报内容在正文中重复出现的形态被文案明确禁止。措辞只描述送达事实。

**Independent Test**: `pnpm test:code` 通过；`SEND_REPORT_DESCRIPTION`、`TASK_RULES_TEXT` 与 `SA_DISPATCH_PROMPT` 的 Handle reports 段含收尾与送达表述，含糊旧句消失。

- [x] T003 [US1] 改写 `src/lark-super-agent/managed/report-tool.ts` 中 `SEND_REPORT_DESCRIPTION` 的第三段：面向用户的内容写进上报的 `text` 或 `files`；已送达的上报会经调度会话转给用户，正文属额外一份；上报后正文最多一句简短收尾，说明下一步或在等什么，留空同样可以；结论、清单、提交与 PR 信息、问题只写在上报里；上报未送达时内容继续写在正文。删除 `never in both` 含糊句，保留「只在被要求时调用」等其余段落
- [x] T004 [US1] 在 `src/lark-super-agent/managed/report-tool.ts` 的 `text` 参数描述补一句：该文本即送达给用户的内容
- [x] T005 [US2] 改写 `src/lark-super-agent/managed/task-rules.ts` 中 `TASK_RULES_TEXT` 的第一条，与 T003 同口径：面向用户的内容全部写进上报，上报后正文最多一句收尾或留空，重复内容不写
- [x] T006 [US3] 在 `src/sa-dispatch/prompt.ts` 的 `## Handle reports` 增加一条：上报已含任务会话要给用户的全部内容，转述即上报内容，只补充调度会话负责的信息
- [x] T007 [P] [US1] [US2] 更新 `tests/lark-super-agent-index.test.ts`：新增对 `SEND_REPORT_DESCRIPTION` 与 `TASK_RULES_TEXT` 的形式断言，覆盖一句收尾上限、送达事实、内容归属，并断言 `never in both` 已消失
- [x] T008 [P] [US3] 更新 `tests/sa-dispatch.test.ts`：`Handle reports` 段增加新条目断言；小节标题顺序断言保持不变
- [x] T009 [US1] [US2] [US3] 运行 `pnpm test:code`，确认 `tests/managed-turn-report.test.ts`、`tests/lark-super-agent-reports.test.ts`、`tests/lark-super-agent-service.test.ts` 无需修改即通过

**Checkpoint**: commit `fix(063): 上报文案要求正文只作简短收尾`

## Phase 3: 文档与质量门禁

**Goal**: 机制文档与变更加入 CHANGELOG，本地门禁通过。

**Independent Test**: `pnpm run full-check` 通过；`docs/how-it-works.md` 的被管理会话能力表写明收尾规则。

- [ ] T010 [P] 在 `docs/how-it-works.md` 的被管理会话能力表 `send_report` 行补充「上报送达后正文最多一句收尾」，并在 S 说明一句指向同口径
- [ ] T011 [P] 在 `CHANGELOG.md` 的 Unreleased 增加一条：`send_report` 描述、临时指令与调度提示词规定上报后正文只作简短收尾，不再复述上报内容
- [ ] T012 运行 `pnpm format && pnpm check`，再运行 `pnpm run build` 完成产物测试

**Checkpoint**: commit `docs(063): 同步上报正文收尾说明`

## Dependencies

- Phase 2 依赖 Phase 1 的规格产物。
- T003 与 T004 改同一文件，按顺序执行；T005 与 T006 各自独立文件，可与 T003、T004 并行。
- T007 与 T008 依赖 T003 至 T006 的最终措辞。
- Phase 3 依赖 Phase 2；T010 与 T011 可并行。

## Parallel Execution Example

- T005、T006 与 T003/T004 可同时进行；T007 与 T008 可同时进行；T010 与 T011 可同时进行。

## Implementation Strategy

- 单次实现交付全部三个故事：三处文案一次改齐，口径一致。
- Phase 3 只收尾文档与门禁。效果以合并后新增会话日志复核（R-07），实机验证可选。
