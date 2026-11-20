---
description: "迁移模板热更新与前端链接规则的实施任务"
---

# Tasks: 迁移模板热更新与前端链接规则

**Input**: Design documents from `/specs/027-template-sync/`

**Prerequisites**: [plan.md](./plan.md)、[spec.md](./spec.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[quickstart.md](./quickstart.md)

**Tests**: 本次不改插件运行代码，不新增测试。验证使用 `pnpm format && pnpm check`、脚本语法检查与模板 diff 核对。

**Organization**: 按用户故事组织。每个阶段完成后提交一个 commit。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 不同文件且无未完成依赖，可并行。
- **[Story]**: `US1`、`US2`、`US3` 对应规格中的用户故事。
- 所有路径均相对于仓库根目录。

## Phase 1: Setup - 规格归档

**Purpose**: 固定迁移范围、决策与验证方式。

- [ ] T001 归档 `specs/027-template-sync/` 的规格、计划、研究、数据模型、快速验证与需求检查清单。

**Commit**: 完成 Phase 1 后提交 `docs(027): 迁移模板变更规格`。

---

## Phase 2: User Story 1 - 实机环境构建后热更新 (Priority: P1) 🎯 MVP

**Goal**: 搭建脚本以链接方式安装插件并启用 HMR，装载用例校验加载产物。

**Independent Test**: 运行 `setup-env.sh` 后，profile 的 `package.json` 记录 `link:` 依赖，`cordis.patch.yml` 含 `hmr` 监听；A1 文案指向加载产物。

### Implementation for User Story 1

- [ ] T002 [US1] 改写 `.dsh/skills/real-device-test/scripts/setup-env.sh`：第 4 步用 `dsh plugin --profile "$PROFILE" add "$REPO"` 链接安装；第 5 步写入 `- id: hmr` 与 `config.root: ["$REPO/dist"]`；复用补丁缺该条目时先移除 `[]` 占位行再追加；结尾提示构建后生效与结束删除 profile；保留插件配置 `prefix: rdt`。
- [ ] T003 [P] [US1] 更新 `.dsh/skills/real-device-test/scripts/run-test.mjs` 的 A1 两条断言文案为「加载的版本」「加载产物」。
- [ ] T004 [P] [US1] 在 `CHANGELOG.md` 的 `Unreleased` → `Changed` 增加实机链接安装与热更新条目。
- [ ] T005 [US1] 运行 `bash -n .dsh/skills/real-device-test/scripts/setup-env.sh` 与 `node --check .dsh/skills/real-device-test/scripts/run-test.mjs`，按 [quickstart.md](./quickstart.md) 核对 diff，勾选本阶段任务。

**Checkpoint**: 搭建脚本与装载文案完成；完成 Phase 2 后提交 `feat(027): 实机链接安装与 HMR`。

---

## Phase 3: User Story 2 - 按 skill 在同一实例中迭代 (Priority: P2)

**Goal**: skill 说明迭代、清理与排错；验证段绑定本插件的 `lark_notify`。

**Independent Test**: 阅读 `SKILL.md` 的迭代小节，步骤中无重装与重启；排错表覆盖安装方式、HMR 配置、构建产物与前端延迟；报告结构含热更新验证。

### Implementation for User Story 2

- [ ] T006 [US2] 更新 `.dsh/skills/real-device-test/SKILL.md`：阶段 0 说明构建是迭代动作；阶段 1 说明链接安装与 HMR 补丁；A1 文案与 T003 一致；新增「迭代：重建后在运行实例中查看效果」小节，验证步骤使用 `src/tools.ts` 的 `lark_notify` 与 `requests.jsonl`；阶段 5 改为先写报告再删除 profile。
- [ ] T007 [P] [US2] 在 `.dsh/skills/real-device-test/references/pitfalls.md` 新增「热更新」表，覆盖安装方式、HMR 配置、构建产物、前端延迟、点目录与补丁改动。
- [ ] T008 [P] [US2] 在 `.dsh/skills/real-device-test/references/cases.md` 新增热更新验证步骤与报告结构；步骤绑定 `lark_notify` 与 `requests.jsonl`。
- [ ] T009 [US2] 与模板 `fe93cd0` 做 diff 核对，确认未适配项只有约定的验证段；运行 `pnpm check`，勾选本阶段任务。

**Checkpoint**: skill 文档可独立指导迭代；完成 Phase 3 后提交 `docs(027): skill 迭代说明与热更新排错`。

---

## Phase 4: User Story 3 - 开发文档约束前端链接 (Priority: P2)

**Goal**: `docs/development.md` 增加前端 `a` 标签完整 URL 规则。

**Independent Test**: 打开文档前端章节，读到 MUST 要求、Desktop 链接行为的原因与本仓库 URL 示例。

### Implementation for User Story 3

- [ ] T010 [US3] 在 `docs/development.md` 的「前端构建」之后新增「前端 UI 链接」小节，写明 `href` MUST 使用含协议与主机的完整 URL、原因与本仓库示例 `https://github.com/FanetheDivine/dsh-plugin-lark-bridge`。
- [ ] T011 [P] [US3] 在 `CHANGELOG.md` 的 `Unreleased` → `Changed` 增加前端 UI 链接条目。
- [ ] T012 [US3] 运行 `pnpm format && pnpm check`、`bash -n`、`node --check`，按 [quickstart.md](./quickstart.md) 核对文档与改动范围，勾选本阶段任务。

**Checkpoint**: 文档规则可独立阅读；完成 Phase 4 后提交 `docs(027): 前端链接使用完整 URL`。

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1**: 无依赖。
- **Phase 2 (US1)**: 依赖 Phase 1 的提交顺序。
- **Phase 3 (US2)**: 依赖 Phase 2，验证段引用链接安装与 HMR。
- **Phase 4 (US3)**: 依赖 Phase 1；与 US1、US2 无文件冲突。

### Recommended Order

`Phase 1 → Phase 2 → Phase 3 → Phase 4`

### Within Each Phase

- T003、T004 与 T002 改不同文件，可并行。
- T007、T008 与 T006 改不同文件，可并行。
- T011 与 T010 改不同文件，可并行。
- 每阶段末尾运行检查并勾选任务。

### Parallel Opportunities

- Phase 2：T003 与 T004 并行。
- Phase 3：T007 与 T008 并行。
- Phase 4：T010 与 T011 并行。

## Implementation Strategy

### MVP First

完成 Phase 2 即得到链接安装与 HMR 配置，以及指向加载产物的 A1 文案。

### Incremental Delivery

1. Phase 1 固定规格与计划。
2. Phase 2 交付搭建脚本与装载文案。
3. Phase 3 交付 skill 迭代、排错与报告说明。
4. Phase 4 交付前端链接规则并完成总验证。

## Notes

- 本插件没有 demo 工具；`setup-env.sh` 的 `prefix: rdt` 会让插件加载失败。该适配与完整实机回归不在本次范围，验证以质量门禁与 diff 核对为准。
- 不复制模板的 `specs/020-*` 与 `specs/021-*`。
- 不修改插件运行代码与现有前端 `href`。
