# Tasks: 桥接会话的模型与预设

**Input**: Design documents from `specs/031-session-model-preset/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md, contracts/

**Tests**: 宪章 II 要求代码变更同步测试，每个用户故事都包含测试任务。

**Organization**: 任务按用户故事分组，每个故事可独立实现与验证。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且无依赖
- **[Story]**: 用户故事编号（US1、US2、US3）
- 每个任务给出仓库内相对路径

## Path Conventions

单包插件：`src/`、`tests/`、`docs/` 与包根文件。

---

## Phase 1: Setup

**Purpose**: 升级宿主依赖到 `0.2.2-rc.5`，建立官方选择器所需的 CSS 构建链

- [X] T001 修改 `package.json`：17 个 dsh 依赖改为 `0.2.2-rc.5`，新增 `@deepseek-ai/dsh-agent-preset-registry`、`dsh-api-remotes`、`dsh-api-session-controller`、`dsh-client-product-analytics`、`dsh-client-ui-model-selection`、`dsh-typert-protocol` 与 `@tsdown/css@^0.22.14`，`dsh.client.inject` 增加 `@deepseek-ai/dsh-client-ui-model-selection`
- [X] T002 修改 `pnpm-workspace.yaml`：删除 17 条 `@0.2.2-rc.3` 记录，按新依赖集写入 23 条 `@0.2.2-rc.5` 记录
- [X] T003 [P] 修改 `tsdown.config.ts`：client 构建增加 `css: { fileName: 'client.css' }` 与 `onSuccess: inlineClientCss`，新增 `inlineClientCss` 注入 `dsh-plugin-lark-bridge-model-selection` 样式，`PLATFORM_MODULES` 增加 `@deepseek-ai/dsh-client-store`
- [X] T004 [P] 新增 `src/css.d.ts`：声明 `*.module.css`
- [X] T005 运行 `pnpm install` 重新解析锁文件，然后运行 `pnpm check` 确认升级后基线通过

**Checkpoint**: 依赖与构建链就绪，现有测试通过。

---

## Phase 2: Foundational

**Purpose**: 配置字段与配置页草稿模型，两个用户故事都依赖

- [X] T006 修改 `src/config.ts`：`Config` 增加 `sessionProvider`、`sessionModel`、`sessionEffort`、`sessionPreset` 四个 volatile 字符串字段；`CONFIG_KEYS` 收录；`resolveConfig` 校验类型；导出 `modelSelectionOf(config)`：`provider` 与 `model` 同时非空才返回 `{ provider, model, reasoningEffort? }`，空白按未配置
- [X] T007 [P] 修改 `src/client/config-form.ts`：`ConfigFields` 增加四个字段，`FIELD_SPECS` 用文本字段；对应更新 `tests/config-form.test.ts` 的默认值、字段集断言与保存断言
- [X] T008 [P] 修改 `src/client/locales.ts`：新增模型与预设键（按 `contracts/config-page.md`），`LocaleNamespaceMap` 增加 `model` 命名空间，`en` 键集与 `zh` 一致
- [X] T009 修改 `tests/plugin.test.ts`：覆盖四个新键的解析、空白与半组配置、未知键仍报错

**Checkpoint**: 配置读写可用，配置页草稿包含四字段。

---

## Phase 3: User Story 1 - 新建桥接会话使用配置的模型 (Priority: P1) 🎯 MVP

**Goal**: 配置页选择模型与推理等级，新建桥接会话从首轮使用该模型。

**Independent Test**: 保存模型后清空状态文件并发一条飞书消息，断言会话日志出现配置的 `model/selection`。

### Tests for User Story 1

- [X] T010 [P] [US1] 新增 `tests/model-defaults.test.ts`：目录加载、草稿写入三个字段、已存模型不可路由显示未选择、连接重置后重新加载
- [X] T011 [P] [US1] 更新 `tests/client.test.ts` 与 `tests/client-bundle.test.ts`：入口 `inject` 导出、产物种子含 `dsh-client-store`、配置页渲染模型行

### Implementation for User Story 1

- [X] T012 [P] [US1] 新增 `src/client/model-defaults.ts`：复用 `ModelCatalogDirectory`，订阅目录与草稿，`select` 写入 `sessionProvider`/`sessionModel`/`sessionEffort`
- [X] T013 [US1] 修改 `src/client/config-page.tsx`：工作区行下方渲染模型行（官方 `ModelSelect`、provider 前缀槽）
- [X] T014 [US1] 修改 `src/client/index.ts`：导出 `inject = ['slots','locale','configForms','remote','remote.session']`，创建 `ModelDefaults` 并注入到配置页
- [X] T015 [US1] 修改 `src/sessions.ts`：`create` 读取配置选择，`llm.resolveCallConfig` 通过后于会话创建后 `agent.model.select`；缺少 `llm` 或校验失败时跳过
- [X] T016 [US1] 更新 `tests/sessions.test.ts`：断言 `agent.model.select` 收到配置选择、未配置时不调用、半组配置跳过
- [X] T017 [US1] 运行 `pnpm check`，提交本阶段

**Checkpoint**: 模型能力可按 US1 独立验收。

---

## Phase 4: User Story 2 - 新建桥接会话使用配置的预设 (Priority: P2)

**Goal**: 配置页选择预设，新建桥接会话运行该预设。

**Independent Test**: 保存预设后清空状态文件并发一条飞书消息，断言 `sessionController.create` 收到 `agentPreset`。

### Tests for User Story 2

- [X] T018 [P] [US2] 新增 `tests/preset-defaults.test.ts`：名册读取、`broken` 过滤、`noService` 判定、选择写入 `sessionPreset`
- [X] T019 [P] [US2] 更新 `tests/client.test.ts`：预设行渲染、菜单项顺序、不可用标注

### Implementation for User Story 2

- [X] T020 [P] [US2] 新增 `src/client/preset-defaults.ts`：`remote.agentPresets.list()` 状态机与草稿写入
- [X] T021 [P] [US2] 新增 `src/client/preset-select.tsx`：触发器、宿主 `Menu`、portal、键盘与焦点返回
- [X] T022 [US2] 修改 `src/client/config-page.tsx`：模型行下方渲染预设行
- [X] T023 [US2] 修改 `src/client/index.ts`：`ctx.inject(['remote.agentPresets'])` 接入名册并注入配置页
- [X] T024 [US2] 修改 `src/sessions.ts`：`create` 改用 `sessionController.create({ sessionId, workspaceId, cwd, agentPreset? })`，预设先经 `agentPresets.list()` 过滤；缺少服务时回退 `ctx.agents.create` 并记录 warn；创建后向会话追加标题事件
- [X] T025 [US2] 更新 `tests/sessions.test.ts`：断言预设传递、不可用预设省略、无 `sessionController` 时回退
- [X] T026 [US2] 运行 `pnpm check`，提交本阶段

**Checkpoint**: 预设能力可按 US2 独立验收。

---

## Phase 5: User Story 3 - 配置不可用时的降级与状态 (Priority: P3)

**Goal**: 配置失效时界面给出状态，新建会话回退宿主默认，消息不丢。

**Independent Test**: 写入不可用的模型与预设后发消息，断言会话创建成功、日志有 warn、配置页标注状态。

### Tests for User Story 3

- [X] T027 [P] [US3] 更新 `tests/sessions.test.ts`：模型校验失败、`resolveAgent` 失败、名册读取失败三种降级各记录 warn 且消息注入成功
- [X] T028 [P] [US3] 更新 `tests/preset-defaults.test.ts` 与 `tests/client.test.ts`：`noService` 禁用、加载失败重试、已存值不可用仍保留

### Implementation for User Story 3

- [X] T029 [US3] 修改 `src/sessions.ts`：统一 warn 文案，`lastError` 保持现有语义
- [X] T030 [US3] 修改 `src/client/config-page.tsx` 与 `src/client/locales.ts`：不可用标注、无服务说明、失败重试
- [X] T031 [US3] 运行 `pnpm check`，提交本阶段

**Checkpoint**: 降级与状态可按 US3 独立验收。

---

## Phase 6: Polish

**Purpose**: 文档、变更记录与质量门禁

- [X] T032 [P] 更新 `docs/how-it-works.md`：配置小节列出四个字段与解析顺序；会话小节说明新建路径与降级
- [X] T033 [P] 更新 `docs/known-risks.md`：宿主版本升级到 rc.5、官方选择器源码子路径导入、预设名册可选
- [X] T034 更新 `CHANGELOG.md`：新增 `## Unreleased` 条目，记录模型、预设与依赖升级
- [X] T035 运行 `pnpm format && pnpm check && pnpm build`，修复全部问题
- [X] T036 按 `quickstart.md` 核对自动化场景与产物（CSS 内联、种子模块），确认 README 与 `locale/*.json` 无改动
- [X] T037 提交收尾，确认 `git status --porcelain` 干净

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 无依赖
- **Foundational (Phase 2)**: 依赖 Setup
- **US1 (Phase 3)**: 依赖 Foundational
- **US2 (Phase 4)**: 依赖 Foundational；`src/client/index.ts` 与 US1 同文件，按顺序实施
- **US3 (Phase 5)**: 依赖 US1 与 US2
- **Polish (Phase 6)**: 依赖全部用户故事

### User Story Dependencies

- **US1**: 无故事依赖
- **US2**: 与 US1 共用 `config-page.tsx`、`index.ts`、`sessions.ts`，按顺序实施
- **US3**: 依赖 US1 与 US2 的降级分支

### Parallel Opportunities

- T003、T004 可并行
- T007、T008 可并行
- T010、T011 可并行；T012 与 T013 可并行
- T018、T019 与 T020、T021 可并行
- T032、T033 可并行

---

## Parallel Example: Phase 3

```text
Task: "新增 tests/model-defaults.test.ts"
Task: "更新 tests/client.test.ts 与 tests/client-bundle.test.ts"
Task: "新增 src/client/model-defaults.ts"
Task: "修改 src/client/config-page.tsx 的模型行"
```

---

## Implementation Strategy

### MVP First

1. 完成 Phase 1 与 Phase 2
2. 完成 US1（T010-T017）
3. 验证配置的模型在新建会话生效
4. 继续 US2、US3

### Incremental Delivery

1. Setup 交付依赖与构建链
2. Foundational 交付配置字段
3. US1 交付模型
4. US2 交付预设
5. US3 交付降级与状态
6. Polish 交付文档与质量门禁

---

## Notes

- 每个阶段以一个 commit 结束
- 不做实机验证（D-008）；配置页渲染、宿主 Menu 与真实预设挂载保持未验证
- README 与 `locale/*.json` 本次不改（D-007）
- `src/client/index.ts`、`config-page.tsx`、`sessions.ts` 被多个故事修改，按阶段顺序提交
