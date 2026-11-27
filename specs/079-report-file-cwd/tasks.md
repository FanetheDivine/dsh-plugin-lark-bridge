# Tasks: send_report 相对附件路径解析

**Input**: Design documents from `/specs/079-report-file-cwd/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/send-report-files.md

**Tests**: 规格要求（SC-001 至 SC-003）覆盖投影、回退与错误文本，按测试先行补齐。

**Organization**: 按用户故事分阶段，阶段与 commit 一一对应。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行（不同文件、无未完成依赖）
- **[Story]**: 所属用户故事（US1、US2、US3）

## Phase 1: Foundational（阻塞全部用户故事）

- [X] T001 [P] 在 `src/lark-super-agent/api.ts` 增加 `CallerSessionLike`（`header?: { cwd?: string }`），并给 `LarkSuperAgentService.sendReport` 增加可选第 4 参数 `callerSession?: CallerSessionLike`
- [X] T002 [P] 在 `src/lark-super-agent/service.ts` 把 `SessionLike` 的 `cwd` 换成 `header?: { cwd?: string }`，新增 `WorkingDirectoryLike`（`get(session): string`）与一次显式断言的读取入口
- [X] T003 在 `src/lark-super-agent/service.ts` 实现解析链 `sessionDirectory` 与 `callerDirectory`：投影 → `header.cwd` → 任务 cwd → `process.cwd()`（最后一级记 `logger.warn`），并让 `sendReport` 与 `manageSession` 使用它
- [X] T004 [P] 在 `src/lark-super-agent/managed/report-tool.ts` 把 `exec.agent?.session` 作为第 4 参数传给 `service.sendReport`
- [X] T005 更新 `tests/lark-super-agent-service.test.ts` 的会话夹具为 `{ session: { id, header: { cwd } } }`，既有上调用例保持通过

## Phase 2: US1 - 相对路径附件可用 (P1)

**Goal**: `files` 相对路径按调用会话当前工作目录解析。

**Independent Test**: 投影返回 B、`header.cwd` 为 A，B 下的 Markdown 通过校验并复制进存档目录。

- [X] T006 [US1] 在 `tests/lark-super-agent-service.test.ts` 新增用例：注入 `workingDirectory.get` 返回 B，B 下 `specs/demo/spec.md`，相对路径上报成功且存档目录存在副本
- [X] T007 [US1] 在同一测试文件新增用例：未注入 `workingDirectory` 时按 `header.cwd` 解析
- [X] T008 [US1] 在同一测试文件新增用例：会话句柄缺失时按任务记录的 cwd 解析
- [X] T009 [US1] 在同一测试文件新增用例：三级都不可用时使用 `process.cwd()`，且 `logger.warn` 被调用一次

## Phase 3: US2 - 切换工作目录后仍能上报附件 (P2)

**Goal**: 会话切换目录后，相对路径按切换后的目录解析。

**Independent Test**: 投影先返回 B 再返回 A，两次上报分别解析到 B 与 A 下的同名文件。

- [X] T010 [US2] 在 `tests/lark-super-agent-service.test.ts` 新增用例：`workingDirectory.get` 依次返回 B、A，两次相对路径上报分别命中两处的文件

## Phase 4: US3 - 失败原因可定位 (P3)

**Goal**: 校验失败的错误给出原始值、绝对路径与基准目录。

**Independent Test**: 上报不存在的相对路径，错误文本包含 `原始值 -> 绝对路径` 与 `(base <基准目录>)`。

- [X] T011 [US3] 在 `src/lark-super-agent/reports.ts` 把无效项改为 `<原始值> -> <绝对路径>`，多无效项用 `;` 拼接，消息末尾附 `(base <cwd>)`
- [X] T012 [US3] 在 `tests/lark-super-agent-reports.test.ts` 新增用例：断言错误文本含原始值、绝对路径与基准目录，并覆盖两个无效项的拼接

## Phase 5: Polish & 交付

- [X] T013 [P] 更新 `docs/how-it-works.md` 的上报段落：`files` 相对路径基准、回退链与错误文本
- [X] T014 [P] 在 `CHANGELOG.md` 增加本分支条目
- [X] T015 运行 `pnpm format && pnpm check && pnpm test:code`，全部通过
- [ ] T016 用 `real-device-test` 在真实宿主验证：被管理会话在 worktree 中用相对路径附件上报成功，错误场景文本含绝对路径与基准目录（待执行；模板用例基于示例插件，需为本插件新增用例）

## Dependencies

```text
T001 ─┬─ T003 ─┬─ T005 ─┬─ T006 ─ T010
T002 ─┘        │        ├─ T007
T004 ──────────┘        ├─ T008
                        └─ T009
T003 ─ T011 ─ T012
T005 ─ T013 ─ T014 ─ T015 ─ T016
```

- 全部用户故事依赖 Phase 1。
- US2、US3 与 US1 相互独立，可在 Phase 1 之后并行。

## Parallel Execution

- Phase 1：T001、T002、T004 分属不同文件，可同时进行。
- Phase 2：T006 至 T009 同文件追加用例，串行执行。
- Phase 5：T013 与 T014 不同文件，可并行。

## Implementation Strategy

1. 先完成 Phase 1，让既有测试在真实会话结构下通过。
2. 依次交付 US1、US2、US3，每个阶段一个 commit。
3. 最后补文档、跑质量门禁并做实机验证。
4. MVP 为 US1：相对路径附件可用。
