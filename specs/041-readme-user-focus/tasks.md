---

description: "Task list for README 面向使用者"
---

# Tasks: README 面向使用者

**Input**: Design documents from `specs/041-readme-user-focus/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/readme.md](./contracts/readme.md)

**Tests**: 规格未要求测试。本次只改文档，验证见 [quickstart.md](./quickstart.md)。

**Organization**: 每个阶段对应一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且无未完成依赖
- **[Story]**: 所属用户故事

## Phase 1: Setup

**Purpose**: 提交规格产物。

- [X] T001 提交 `specs/041-readme-user-focus/` 下的 spec、plan、research、data-model、quickstart、contracts 与 checklists

---

## Phase 2: Foundational

**Purpose**: 先把 README 将删除且 `docs/` 未覆盖的信息迁入 `docs/how-it-works.md`，保证改写 README 时信息不丢失。

**⚠️ CRITICAL**: 完成后才能改写 README。

- [X] T002 在 `docs/how-it-works.md`「鉴权」追加飞书开放平台配置：启用机器人能力；订阅 `im.message.receive_v1` 并选择接收单聊消息；授予 `im:message.p2p_msg:readonly` 与 `im:message:send_as_bot`
- [X] T003 在 `docs/how-it-works.md`「调度服务与预设叠加」的全局行停用一句补充「飞书对话与 `lark_notify` 照常工作」
- [X] T004 在 `docs/how-it-works.md`「调度服务与预设叠加」追加：只有 `workspaces.json` 已登记的工作区可接收任务；无匹配时先请用户新增或补充工作区，多个匹配时先问清目标；派发后回执目标工作区与执行会话
- [X] T005 在 `docs/how-it-works.md`「调度工作区存储」追加：本机需安装 git，并配置 `user.name` 与 `user.email`
- [X] T006 在 `docs/how-it-works.md`「上报投递与失败监听」的 `send_report` 一句补充：`text` 与 `files` 至少提供一项，`files` 为 Markdown 文件路径
- [X] T007 按 `specs/041-readme-user-focus/data-model.md` 逐行核对，每条当前 README 信息在 `docs/` 或目标 README 中都有归属

**Checkpoint**: 迁移完成，提交一次。

---

## Phase 3: User Story 1 - 新用户按 README 开始在飞书对话 (Priority: P1) 🎯 MVP

**Goal**: README 只含简介与使用两节，读者执行三条命令、选择工作区后即可在飞书对话。

**Independent Test**: 只看 README 的简介与使用两节完成配置，无需查阅 `docs/`。

- [ ] T008 [US1] 把 `README.md` 替换为 `specs/041-readme-user-focus/contracts/readme.md` 中标题、徽章、简介与「使用」一节的全文
- [ ] T009 [P] [US1] 把 `docs/how-it-works.md`「鉴权」中的 `README.md#前置` 改为 `README.md#使用`
- [ ] T010 [P] [US1] 把 `AGENTS.md` 文档索引中 README 的描述改为「插件简介、使用与预设」

**Checkpoint**: 简介与使用可独立验收，提交一次。

---

## Phase 4: User Story 2 - 用户保持预设可用 (Priority: P2)

**Goal**: README 说明保持两个预设行启用，并把主行配置的「预设」设为 `SA-调度会话`。

**Independent Test**: 只看「关于两个预设」一节，能在「插件」页找到两行并核对主行预设。

- [ ] T011 [US2] 在 `README.md` 末尾追加 `specs/041-readme-user-focus/contracts/readme.md` 中「关于两个预设」一节的全文，使 `README.md` 与目标全文逐字一致

**Checkpoint**: README 完整，提交一次。

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] T012 在 `CHANGELOG.md` 的 `[Unreleased]` 下增加 `### Changed` 条目：README 改为面向使用者的精简版本
- [ ] T013 运行 `pnpm format && pnpm check`
- [ ] T014 按 `specs/041-readme-user-focus/quickstart.md` 执行全部检查：全文一致、不超过 40 行、3 个二级标题、无相对链接、锚点只剩 `README.md#使用`

**Checkpoint**: 门禁通过，提交一次。

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5。
- Phase 2 阻塞 README 改写，避免信息丢失。
- US2 追加在 US1 的 README 之后，依赖 Phase 3。
- T009 与 T010 改不同文件，可与 T008 并行。

## Parallel Example: User Story 1

```text
T009 docs/how-it-works.md 锚点
T010 AGENTS.md 索引
```

## Implementation Strategy

- MVP 为 Phase 1 到 Phase 3：README 已精简，读者可完成上手。
- Phase 4 补全预设说明，Phase 5 补 CHANGELOG 并跑门禁。
