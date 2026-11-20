---
description: "Task list for 飞书消息队列与批量注入"
---

# Tasks: 飞书消息队列与批量注入

**Input**: Design documents from `specs/032-drop-stale-messages/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、quickstart.md

**Tests**: 包含测试任务。宪章要求代码变更同步更新 `tests/`。

**Organization**: 按用户故事分组；每个阶段对应一个 commit。

## Phase 1: Setup

- [x] T001 在 `src/constants.ts` 增加 `INJECT_SILENCE_MS = 15_000`，附一句用途注释

## Phase 2: Foundational

- [x] T002 在 `src/bridge.ts` 增加队列条目类型与 `queue`、`timer`、`draining` 字段，初始化与清理逻辑
- [x] T003 在 `src/bridge.ts` 实现 `schedule()`：清空旧计时器、`setTimeout(drain, INJECT_SILENCE_MS)`、`unref`
- [x] T004 在 `src/bridge.ts` 实现 `drain()`：`draining` 串行化、取空队列、调用 `sessions.inject`、结束后在队列非空且无计时器时重新排期
- [x] T005 在 `EventBridge.stop()` 清空计时器与队列，并记录丢弃条数

## Phase 3: User Story 1 - 多条消息合并为一次注入 (P1)

**Goal**: 15 秒内到达的多条消息合成一个用户消息，块按时间升序，只开一轮。

**Independent Test**: 三条消息在 15 秒内到达，推进假计时器 15 秒，断言 `inject` 只调用一次且文本含三个块。

- [x] T006 [US1] 在 `src/bridge.ts` 组装批次文本：按 `createdAt` 升序，`block` 以空行连接
- [x] T007 [US1] 在 `tests/bridge.test.ts` 新增静默窗口用例：三条消息合并、只注入一次
- [x] T008 [US1] 在 `tests/bridge.test.ts` 新增计时重置用例：第二条在窗口内到达，注入发生在最后一条之后 15 秒
- [x] T009 [US1] 在 `tests/bridge.test.ts` 新增顺序用例：乱序到达的块按 `create_time` 升序
- [x] T010 [US1] 在 `tests/bridge.test.ts` 新增注入期间到达用例：新消息留在队列，结束后再等 15 秒

## Phase 4: User Story 2 - 配置完成前的消息不进入会话 (P1)

**Goal**: `create_time` 早于监听启动时刻的事件被过滤，不入队。

**Independent Test**: 启动监听后提交一条旧消息，断言 `inject` 未调用且日志含 `message_id`。

- [x] T011 [US2] 在 `src/bridge.ts` 的 `handleEvent` 比较 `create_time` 与 `startedAt`，早于时记日志并返回 false
- [x] T012 [US2] 在 `tests/bridge.test.ts` 新增过滤用例与边界用例（等于启动时刻按新消息处理）

## Phase 5: User Story 3 - 事件确认与重推 (P1)

**Goal**: 去重先于入队；工作区失效不停止监听；配置保存与工作区变化不重启消费者。

**Independent Test**: 工作区变为无效后 `sync` 不停止；重复 `message_id` 只入队一次；配置热重载不停止消费者。

- [x] T013 [US3] 在 `src/bridge.ts` 保证 `markSeen` 在入队前执行，重复消息直接返回
- [x] T014 [US3] 在 `src/bridge.ts` 调整 `sync`：只在鉴权未就绪时停止；工作区失效保持运行
- [x] T015 [US3] 在 `src/index.ts` 移除 `loader/volatile-update` 与 `domain/changed` 中的 `bridge.stop()`
- [x] T016 [US3] 更新 `tests/bridge.test.ts` 的工作区用例：`sync` 保持运行；`handleEvent` 交由注入失败处理
- [x] T017 [US3] 在 `tests/bridge.test.ts` 新增重复消息与注入失败用例：失败整批丢弃，下一次事件正常注入

## Phase 6: User Story 4 - 过滤与失败可诊断 (P2)

**Goal**: 过滤、注入与失败日志包含 `message_id`、时间与原因。

**Independent Test**: 制造过滤与失败，断言日志字段。

- [x] T018 [US4] 在 `src/bridge.ts` 统一日志：过滤、已注入批次、失败批次都带 `message_id` 与时间
- [x] T019 [US4] 在 `tests/bridge.test.ts` 断言过滤与失败日志的字段

## Phase 7: Polish

- [x] T020 [P] 更新 `docs/how-it-works.md` 的消息与生命周期章节
- [x] T021 [P] 更新 `docs/known-risks.md` 的事件流章节
- [x] T022 [P] 更新 `README.md` 的功能说明
- [x] T023 运行 `pnpm format && pnpm check`，修复全部问题
- [x] T024 按阶段提交 commit：Setup+Foundational、US1、US2、US3、US4、Polish

## Dependencies

- T001 → T002 → T003 → T004 → T005
- T006 依赖 T004；T007 到 T010 依赖 T006
- T011 依赖 T002；T012 依赖 T011
- T013 依赖 T002；T014、T015 依赖 T002；T016、T017 依赖 T014、T015
- T018 依赖 T004；T019 依赖 T018
- T020 到 T022 可与代码并行；T023 依赖全部代码与文档

## Parallel Execution

- T020、T021、T022 可并行。
- 同一文件 `src/bridge.ts` 的任务不可并行。
- 同一文件 `tests/bridge.test.ts` 的任务不可并行。

## Implementation Strategy

先完成 Setup 与 Foundational，让队列骨架可编译；再按 US1 到 US4 的顺序补齐行为与测试；最后更新文档并跑质量门禁。MVP 是 US1：只要队列与静默窗口可用，就能消除多轮注入。
