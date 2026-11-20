---
description: "Task list for 独立鉴权与工作区选择流程"
---

# Tasks: 独立鉴权与工作区选择流程

**Input**: Design documents from `/specs/026-auth-workspace-flow/`

**Prerequisites**: plan.md、spec.md、research.md、data-model.md、contracts/routes.md、quickstart.md

**Tests**: 规格与宪章要求同步测试。每个故事先写行为测试，再实现。

**Organization**: 按 P1、P2、P3 用户故事组织；每个阶段完成后运行相关检查并提交一个 commit。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 对齐新增宿主依赖，保持现有构建结构。

- [X] T001 在 `package.json` 添加 `dsh-client-ui-workspace` 与 `dsh-storage-domain` 的 0.2.2-rc.3 纯类型依赖和 Client inject，在 `pnpm-workspace.yaml` 添加对应排除项并刷新 `pnpm-lock.yaml`

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 提供 Host 与 Client 共用的状态类型和宿主标准 props 测试设施。

- [X] T002 [P] 在 `tests/helpers.ts` 添加 `useWorkspaces` selector-hook 假实现与可控异步表单设施，保持 Cordis Client 服务集合不变
- [X] T003 [P] 在 `src/types.ts` 定义共享 `ConnectionState = checking | connected | disconnected` 纯类型，在 `src/workspace-path.ts` 与 `tests/workspace-path.test.ts` 实现 `/c/work/demo` 归一化、平台路径比较和 Host 原生路径转换

**Checkpoint**: 依赖和测试基础就绪，现有代码仍通过类型检查。

---

## Phase 3: User Story 1 - 按连接状态自行完成环境准备 (Priority: P1) 🎯 MVP

**Goal**: 独立展示 CLI、bot、user 状态和三条终端命令，所有检测执行带 `--verify` 的完整检查。

**Independent Test**: 构造 CLI 缺失、命令失败和 bot/user 四种组合；检查状态、命令、检测并发与安全路由响应。

### Tests for User Story 1

- [X] T004 [P] [US1] 在 `tests/auth.test.ts` 覆盖初始 checking、CLI 不可用、命令失败、bot/user 独立组合、固定 `--verify` 和并发复用
- [X] T005 [P] [US1] 在 `tests/routes.test.ts` 覆盖 `GET /status` 与 `POST /check` 的安全投影、敏感字段零出现和已删除路由
- [X] T006 [P] [US1] 在 `tests/client.test.ts` 覆盖三个连接区域、三条命令、检测按钮、无 URL/原始错误/身份元数据与状态控制器清理

### Implementation for User Story 1

- [X] T007 [US1] 在 `src/auth.ts` 实现三个独立状态、整体 ready、owner open_id 与并发完整检测，删除 LoginFlow、启动/取消授权和后台轮询
- [X] T008 [US1] 在 `src/routes.ts` 只注册 status/check 并投影安全状态，在 `src/client/api.ts` 删除授权与重置 API 并使用共享连接状态类型
- [X] T009 [US1] 在 `src/client/terminal-command.tsx`、`src/client/auth-panel.tsx` 和 `src/client/locales.ts` 实现三个状态区、只读命令与统一检测动作
- [X] T010 [US1] 在 `src/client/status-controller.ts` 实现加载时完整检测、共享订阅、手动检测、只读轮询与卸载清理
- [X] T011 [US1] 在 `src/index.ts` 接入新 AuthManager 与安全路由，启动和 volatile 更新必检测并移除授权清理
- [X] T012 [US1] 在 `src/client/index.ts`、`src/client/auth-overlay.tsx` 和 `src/client/config-page.tsx` 接入共享状态控制器与连接面板

**Checkpoint**: US1 可独立验证；状态轮询不执行 CLI，浏览器响应不含敏感诊断。

---

## Phase 4: User Story 2 - 从已注册工作区选择消息目标 (Priority: P2)

**Goal**: 配置页和共用弹窗只选择当前注册工作区，注册删除立即停用监听。

**Independent Test**: 覆盖空选择、有效保存、重复标题、注册删除但目录保留、异步乱序、暂时关闭与空注册列表。

### Tests for User Story 2

- [X] T013 [P] [US2] 在 `tests/workspace.test.ts` 和 `tests/bridge.test.ts` 覆盖 reconcile 条件、目标删除同步停止、无关删除、volatile 立即同步和 generation 乱序
- [X] T014 [P] [US2] 在 `tests/sessions.test.ts` 覆盖未注册目录拒绝、注入前再次校验、`registry.create` 与 `agents.create` 零调用
- [X] T015 [P] [US2] 在 `tests/config-form.test.ts` 和 `tests/client.test.ts` 覆盖单字段保存、归一化注册选项、同名路径标签、空列表、共用弹窗与失效签名重开

### Implementation for User Story 2

- [X] T016 [US2] 在 `src/workspace.ts` 实现 Host 原生路径转换后的注册解析、归一化当前 workspace id 缓存、`domain/changed` 删除识别和 generation 防护
- [X] T017 [US2] 在 `src/index.ts` 与 `src/bridge.ts` 用鉴权和有效工作区共同控制监听，配置变化与目标删除先同步停止
- [X] T018 [US2] 在 `src/sessions.ts` 于目录和会话边界转换 Host 原生路径，只使用 `resolveByPath` 返回的注册工作区，删除自动创建注册项并在 followup 前复核
- [X] T019 [US2] 在 `src/client/config-form.ts` 将表单收敛为 `workspaceRoot` 单字段，读写均归一化为 `/c/work/demo` 形式并保留宿主只读与 override 语义
- [X] T020 [US2] 在 `src/client/config-page.tsx`、`src/client/auth-overlay.tsx`、`src/client/index.ts` 和 `src/client/locales.ts` 实现共享表单、归一化原生 select 值与标签、显式保存、空状态与可关闭共用弹窗

**Checkpoint**: US2 可独立验证；无效选择不消费事件、不投递消息、不创建工作区注册。

---

## Phase 5: User Story 3 - 使用精简且固定的会话规则 (Priority: P3)

**Goal**: 固定标题，删除启动检测与重置配置，归档后自然创建新会话。

**Independent Test**: 检查旧配置兼容、配置页控件为零、固定标题的新建/复用和归档后的下一条消息。

### Tests for User Story 3

- [X] T021 [P] [US3] 在 `tests/plugin.test.ts` 覆盖仅 `workspaceRoot` 的配置 schema、旧 `sessionTitle`/`authCheckOnStartup` 接受并忽略、未知键拒绝与必检测
- [X] T022 [P] [US3] 在 `tests/sessions.test.ts` 和 `tests/state.test.ts` 覆盖新建/复用固定标题、归档恢复新建和公开重置方法移除

### Implementation for User Story 3

- [X] T023 [US3] 在 `src/config.ts` 与 `cordis.patch.yml` 删除标题和启动检测字段、把两者加入旧键集合并将工作区配置归一化为 `/c/work/demo` 形式
- [X] T024 [US3] 在 `src/constants.ts`、`src/sessions.ts`、`src/state.ts` 和 `src/client/locales.ts` 固定「来自用户的飞书消息」，状态路径保存 `/c/work/demo` 形式并删除重置能力与废弃文案

**Checkpoint**: 三个故事均通过独立测试，现有私聊、去重、置顶和通知回归保持通过。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 文档、完整质量门禁、真实宿主和 UI/UX 验收。

- [X] T025 [P] 更新 `README.md`、`docs/how-it-works.md`、`docs/known-risks.md` 和 `docs/development.md` 的终端鉴权、工作区注册校验、固定标题、路由与文件地图
- [X] T026 运行 `pnpm format && pnpm check` 和 `pnpm build`，修复全部问题并核对 `package.json` 与 `pnpm-lock.yaml`
- [X] T027 按 `specs/026-auth-workspace-flow/quickstart.md` 在真实隔离 profile 验证连接状态、工作区删除、固定标题、私聊注入、通知与中英文界面
- [X] T028 完成真实运行界面的 UI/UX 子代理审查，修复本次范围内问题并在 `specs/026-auth-workspace-flow/quickstart.md` 记录验证证据

---

## Dependencies & Execution Order

### Phase Dependencies

- Phase 1 → Phase 2 → US1。
- US2 依赖 US1 的整体 ready 与共享状态控制器。
- US3 可在 Phase 2 后独立实现，交付时按 US1 → US2 → US3 顺序集成。
- Phase 6 依赖三个故事全部完成。
- 每个阶段对应一个 commit。

### User Story Dependencies

- **US1**: 无其他故事依赖，提供连接状态 MVP。
- **US2**: 使用 US1 的 ready 和状态控制器；Host 注册校验与 UI select 可分别验证。
- **US3**: 固定标题与旧键兼容不依赖 US2，可独立测试。

### Parallel Opportunities

- T002 与 T003 使用不同文件，可并行。
- T004、T005、T006 使用不同测试文件，可并行。
- T013、T014、T015 使用不同测试文件，可并行。
- T021 与 T022 使用不同测试文件，可并行。

## Parallel Examples

### User Story 1

```text
并行编写 tests/auth.test.ts、tests/routes.test.ts、tests/client.test.ts。
汇合后依次实现 AuthManager → 路由/API → 连接面板 → 状态控制器 → 两端装配。
```

### User Story 2

```text
并行编写工作区/桥接、会话和客户端测试。
汇合后依次实现 Host reconcile、注入校验和共享表单 UI。
```

### User Story 3

```text
并行编写配置兼容测试与会话/状态测试。
汇合后实现配置清理和固定标题。
```

## Implementation Strategy

1. 先交付 US1，独立验证三种状态和终端命令。
2. 加入 US2，验证注册删除和共用弹窗。
3. 加入 US3，验证固定标题与归档恢复。
4. 最后运行完整质量门禁、真实宿主和 UI/UX 审查。

## Notes

- [P] 只标记文件不重叠且前置已完成的任务。
- 每个阶段完成后运行相关测试并提交一个 commit。
- 实现出现新未决项时暂停受影响工作，返回对应探索与审查。
- CHANGELOG 在 push 或 merge 时按宪章维护。
