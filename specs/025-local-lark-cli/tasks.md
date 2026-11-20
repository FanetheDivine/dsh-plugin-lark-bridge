---
description: "完全使用本机 lark-cli 的实施任务"
---

# Tasks: 完全使用本机 lark-cli

**Input**: Design documents from `/specs/025-local-lark-cli/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)

**Tests**: 宪章要求代码变更同步更新真实行为测试。各故事先写失败测试，再实现。

**Organization**: 按用户故事组织。每个阶段完成后提交一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 不同文件且无未完成依赖，可并行。
- **[Story]**: `US1`、`US2`、`US3` 对应规格中的用户故事。
- 所有路径均相对于仓库根目录。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: 移除插件管理的 CLI 程序来源。

- [x] T001 从 `package.json`、`pnpm-workspace.yaml` 删除 `@larksuite/cli` 依赖与构建许可，刷新 `pnpm-lock.yaml`，运行 `pnpm check` 验证基线。

**Commit**: 完成 Phase 1 后提交依赖移除。

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: 建立所有 CLI 调用共用的安全命令构造与启动错误语义。

**⚠️ CRITICAL**: 后续故事不得绕过该命令构造层。

- [x] T002 在 `tests/cli-process.test.ts` 新增失败测试，覆盖 Unix 参数数组、Windows 单一命令字符串、`^[A-Za-z0-9._:+-]+$` 白名单、危险参数拒绝与同步 `spawn` 异常映射。
- [x] T003 在 `src/cli.ts` 实现纯命令构造与启动错误归一化逻辑，满足 `tests/cli-process.test.ts`，保留现有公开调用形状供下一阶段迁移。

**Checkpoint**: 安全命令构造测试通过；完成 Phase 2 后提交。

---

## Phase 3: User Story 1 - 使用本机安装运行消息链路 (Priority: P1) 🎯 MVP

**Goal**: 插件只使用用户终端可见的 `lark-cli`，不读取专用路径或环境覆盖。

**Independent Test**: 在插件依赖和目录均无 CLI 副本时，以本机命令完成鉴权、事件消费和通知；配置中的旧 `larkCli` 被忽略。

### Tests for User Story 1

- [ ] T004 [P] [US1] 更新 `tests/cli.test.ts` 与 `tests/auth.test.ts`，新增直接命令调用、无路径/环境覆盖和启动失败为 `cli-missing` 的失败测试，并调整 `LarkCli` 构造预期。
- [ ] T005 [P] [US1] 更新 `tests/tools.test.ts`，新增 `--text -` 与 stdin 正文测试，覆盖 Unicode、换行和 shell 元字符不进入参数列表。
- [ ] T006 [P] [US1] 更新 `tests/plugin.test.ts`，新增运行时配置无 `larkCli`、旧 `larkCli` 接受并忽略、其他未知键仍报错的失败测试。

### Implementation for User Story 1

- [ ] T007 [US1] 重构 `src/cli.ts`：删除包解析、`LARK_CLI`、自定义 `PATH`、脚本入口与 Node 路径参数；一次性调用和 `spawn` 统一使用本机命令及 Phase 2 安全构造层。
- [ ] T008 [P] [US1] 更新 `src/tools.ts`，通知改用 `--text -` 并通过 `options.input` 写入正文，保持分段和错误返回行为。
- [ ] T009 [P] [US1] 更新 `src/config.ts`、`src/index.ts`、`cordis.patch.yml`：移除 `larkCli` 运行时字段，加入旧键忽略集合，插件只创建一个 `LarkCli`。
- [ ] T010 [US1] 运行 `tests/cli-process.test.ts`、`tests/cli.test.ts`、`tests/auth.test.ts`、`tests/tools.test.ts`、`tests/plugin.test.ts`，再运行 `pnpm format && pnpm check` 验证 US1。

**Checkpoint**: 本机命令链路可独立交付；完成 Phase 3 后提交。

---

## Phase 4: User Story 2 - 识别并修复本机程序问题 (Priority: P2)

**Goal**: `cli-missing` 弹窗和配置页鉴权面板显示同一条安装并初始化命令，配置页不再提供路径输入。

**Independent Test**: 以 `cli-missing` 状态分别渲染两个入口，均显示指定命令；其他阶段不显示，旧配置不出现在表单中。

### Tests for User Story 2

- [ ] T011 [P] [US2] 更新 `tests/client.test.ts`，新增弹窗与配置页鉴权面板在 `cli-missing` 显示相同命令、其他阶段不显示、配置页无路径输入的失败测试。
- [ ] T012 [P] [US2] 更新 `tests/config-form.test.ts`，移除 `larkCli` 草稿和保存用例，新增表单状态不包含该字段的断言。

### Implementation for User Story 2

- [ ] T013 [US2] 更新 `src/client/locales.ts`，为中英文加入 `auth.installCommand` 和本机安装提示，命令固定为 `npm install -g @larksuite/cli@latest && lark-cli config init`。
- [ ] T014 [P] [US2] 新建 `src/client/cli-install-command.tsx` 并更新 `src/client/auth-overlay.tsx`、`src/client/auth-panel.tsx`，仅在 `cli-missing` 渲染共享只读命令组件。
- [ ] T015 [P] [US2] 更新 `src/client/config-form.ts`、`src/client/config-page.tsx`、`tests/helpers.ts`，删除 `larkCli` 表单字段、控件与测试夹具。
- [ ] T016 [US2] 运行 `tests/client.test.ts`、`tests/config-form.test.ts`，再运行 `pnpm format && pnpm check` 验证 US2 与既有故事。

**Checkpoint**: 两个界面提示可独立验收；完成 Phase 4 后提交。

---

## Phase 5: User Story 3 - 获取精简的插件发布包 (Priority: P2)

**Goal**: 依赖清单和实际发布产物均不包含 `lark-cli` 程序或后备副本。

**Independent Test**: 构建后执行 `npm pack --dry-run --json`，依赖声明无 `@larksuite/cli`，tarball 无 CLI 文件且插件必需文件完整。

### Tests for User Story 3

- [ ] T017 [US3] 更新 `tests/package-pack.test.ts`，新增 `package.json` 不声明 `@larksuite/cli`、tarball 不含 CLI 程序包/二进制/缓存且保留 `dist`、`cordis.patch.yml`、`README.md` 的断言。
- [ ] T018 [US3] 按 `specs/025-local-lark-cli/quickstart.md` 运行 `pnpm build` 与产物打包测试，检查 `package.json` 和实际 tarball 内容。

**Checkpoint**: 发布内容可独立验收；完成 Phase 5 后提交。

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: 同步文档，完成真实宿主与界面审查。

- [ ] T019 [P] 更新 `README.md`：说明本机安装与升级、终端一致调用、无专用路径配置、无最低版本检查和 `cli-missing` 命令。
- [ ] T020 [P] 更新 `docs/how-it-works.md` 与 `docs/known-risks.md`：记录直接命令、Windows 受约束 shell、stdin 正文、旧键兼容和环境刷新风险。
- [ ] T021 [P] 更新 `docs/development.md`：同步 `src/client/cli-install-command.tsx`、CLI 机制和测试文件地图。
- [ ] T022 按 `specs/025-local-lark-cli/quickstart.md` 在真实 DSH 宿主验证中英文弹窗与配置页、私聊注入和通知；执行一次 UI/UX 子代理审查，修复已证实的问题并记录结果。
- [ ] T023 按 `specs/025-local-lark-cli/quickstart.md` 运行 `pnpm format && pnpm check && pnpm build`，复核 `git diff` 与全部验收条件。

**Commit**: 完成 Phase 6 后提交文档、验证修正与结果。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup**: 无依赖。
- **Foundational**: 依赖 Setup，阻塞所有故事。
- **US1**: 依赖 Foundational，无其他故事依赖。
- **US2**: 依赖 Foundational；界面可独立开发，最终与 US1 的配置移除集成。
- **US3**: 依赖 Setup 与 Foundational，可独立检查发布产物。
- **Polish**: 依赖三个故事完成。

### Recommended Order

`Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5 → Phase 6`

US2 与 US3 可在 US1 完成后并行；共享 `tests/helpers.ts` 的修改由 US2 独占。

### Within Each Story

- 测试任务先于实现任务并确认失败。
- US1 的 T007 是 T008、T009 的集成前置。
- US2 的 T013 是 T014 的前置。
- 每个故事末尾运行独立测试与质量门禁。

### Parallel Opportunities

- US1：T004、T005、T006 可并行；T008、T009 可在 T007 后并行。
- US2：T011、T012 可并行；T014、T015 可在 T013 后并行。
- Polish：T019、T020、T021 可并行。

---

## Parallel Example: User Story 1

```text
Task T004: 更新 tests/cli.test.ts 与 tests/auth.test.ts 的直接命令与错误测试。
Task T005: 更新 tests/tools.test.ts 的 stdin 正文测试。
Task T006: 更新 tests/plugin.test.ts 的配置移除与旧键兼容测试。
```

## Parallel Example: User Story 2

```text
Task T014: 实现共享命令组件并接入弹窗和鉴权面板。
Task T015: 移除配置表单字段、控件与测试夹具。
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. 完成依赖移除与安全命令基础。
2. 完成 US1，验证本机命令、鉴权、事件与通知。
3. 在没有界面包和安装命令提示的情况下，核心消息链路已可作为 MVP 工作。

### Incremental Delivery

1. US1 交付本机命令链路。
2. US2 增加可操作的缺失提示并清理界面配置。
3. US3 用实际发布产物证明无 CLI 副本。
4. Polish 完成文档、真实宿主与 UI/UX 验证。

---

## Notes

- 每个阶段对应一个 commit。
- [P] 任务可交给子代理并行，集成者必须复核最终 diff 并运行相关测试。
- 不新增最低版本检查、自动安装、复制按钮或连通性测试。
- Windows 通知正文只走 stdin，动态参数不满足白名单时在启动前拒绝。
