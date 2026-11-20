# 实现计划：迁移模板热更新与前端链接规则

**分支**：`027-template-sync` | **日期**：2026-11-20 | **规格**：[spec.md](./spec.md)

**输入**：`specs/027-template-sync/spec.md`

**状态**：Approved

## Open Decisions

无。

## Clarifications

### 2026-11-20 会话

- [P-D-001] Q: 迁移哪些文件？ -> A: 实机 skill 的 `SKILL.md`、`cases.md`、`pitfalls.md`、`setup-env.sh`、`run-test.mjs`；`docs/development.md`；`CHANGELOG.md`。依据规格 D-005。
- [P-D-002] Q: 新增的热更新验证段怎么写？ -> A: 改动对象改为 `src/tools.ts` 中 `lark_notify` 的 `description`；观察改为 profile 的 `requests.jsonl` 中 `tools` 字段。依据规格 D-002。
- [P-D-003] Q: 是否调整 `setup-env.sh` 写入的插件配置？ -> A: 保持模板的 `prefix: rdt`。该键对本插件无效，demo 用例与 profile 配置的适配另立变更。依据规格 D-002、D-003。
- [P-D-004] Q: 本次验证到什么程度？ -> A: 运行 `pnpm format && pnpm check`、脚本语法检查与模板 diff 核对；不启动宿主。依据规格 D-003。
- [P-D-005] Q: 模板的规格目录是否迁移？ -> A: 不迁移，用本规格记录。依据规格 D-001。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: `prefix: rdt` 使本插件无法加载，实机热更新验证在适配前不可执行；本次不做实机回归。

## 摘要

把模板最近两个 commit 的可移植内容迁入本项目。实机 skill 改为「链接安装 + HMR」：profile 以 `link:` 依赖指向当前检出，补丁把 `hmr` 的监听根设为 `<repo>/dist`；之后构建一次就让运行中的实例替换插件。新增的迭代说明、清理、排错与报告结构按模板迁移；验证段改为 `lark_notify` 与 `requests.jsonl`。开发文档增加前端 `a` 标签完整 URL 规则。插件源码、现有前端链接与模板规格目录不动。

## 技术背景

**语言与版本**：skill 文档为 Markdown；脚本为 Bash 与 Node ESM；插件为 TypeScript，本次不改。

**主要依赖**：宿主 `@deepseek-ai/dsh@0.2.2-rc.3`，`dsh-hmr` 提供模块替换，`dsh-client-hmr` 提供前端更新；仓库已有 `pnpm` 与 `playwright`。

**存储**：实机 profile 的 `package.json`、`cordis.patch.yml`、`node_modules` 链接、`requests.jsonl`、会话与截图目录。

**测试**：`pnpm format && pnpm check`；`bash -n` 与 `node --check` 校验脚本语法；与模板两个 commit 做 diff 核对。本次不做实机回归。

**目标平台**：Windows + Git Bash；DSH web profile。

**项目类型**：DSH 插件，附实机测试 skill。

**性能目标**：不适用。文档说明构建后替换在数秒内完成。

**约束**：不改插件运行代码与现有前端 `href`；demo 用例保持原样；不复制模板规格目录；每轮结束删除 profile。

**规模**：5 个 skill 文件、1 个开发文档、1 个变更记录，共 7 个文件。

## 宪法检查

*门禁：研究前通过；设计完成后再次核对。*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I 宿主依赖版本 | 通过 | 不新增或升级 `@deepseek-ai/*` 依赖 |
| II 测试同步 | 通过 | 不改插件运行代码；实机脚本只改提示文案与搭建配置；按用户决定不做实机回归，记为风险 |
| III 文档结构 | 通过 | 实机流程归属 skill；开发规则归属 `docs/development.md`；变更记录归属 CHANGELOG |
| IV 质量门禁 | 通过 | 提交前运行 `pnpm format && pnpm check` |
| V 公开引用 | 通过 | 文档示例用仓库公网 URL；skill 路径用 `<repo>` 占位符；不写入本机路径 |

设计后复核：结论相同。

## 项目结构

### 文档（本功能）

```text
specs/027-template-sync/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── checklists/requirements.md
├── spec.md
└── tasks.md          # /speckit-tasks 生成
```

### 仓库文件

```text
.dsh/skills/real-device-test/
├── SKILL.md
├── references/
│   ├── cases.md
│   └── pitfalls.md
└── scripts/
    ├── setup-env.sh
    └── run-test.mjs
docs/development.md
CHANGELOG.md
```

**结构决策**：沿用现有 skill 目录与文档结构，不新增仓库文件。`gui-up.sh`、`browser-test.mjs`、`mock-provider.mjs`、`register-workspace.mjs` 不改。

## 实现方案

### 1. 搭建脚本

`.dsh/skills/real-device-test/scripts/setup-env.sh`：

1. 第 4 步改为 `dsh plugin --profile "$PROFILE" add "$REPO"`，删除 `pnpm pack` 与 tgz 处理。
2. 第 5 步新建补丁时加入 `- id: hmr` 与 `config.root: ["$REPO/dist"]`。
3. 复用已有补丁时，缺 `id: hmr` 则先移除孤立的 `[]` 占位行，再追加 HMR 条目。
4. 结尾提示补上「构建后同一实例生效」与「结束删除 profile」。
5. 插件配置块保持 `prefix: rdt`。

### 2. 驱动脚本

`.dsh/skills/real-device-test/scripts/run-test.mjs`：A1 的两条断言文案改为「加载的版本」「加载产物」，断言逻辑不变。

### 3. skill 文档

1. `SKILL.md`：
   - 阶段 0 说明构建是迭代动作。
   - 阶段 1 说明链接安装与 HMR 补丁。
   - A1 断言文案与 `run-test.mjs` 一致。
   - 新增「迭代：重建后在运行实例中查看效果（A、B）」：验证步骤绑定 `src/tools.ts` 的 `lark_notify` 与 `requests.jsonl`。
   - 阶段 5 改为先写报告，再删除 profile。
2. `references/pitfalls.md`：新增「热更新」表，覆盖安装方式、HMR 配置、构建产物、前端延迟与点目录。
3. `references/cases.md`：新增热更新验证步骤与报告结构；步骤绑定 `lark_notify` 与 `requests.jsonl`。

### 4. 开发文档

`docs/development.md`：在「前端构建」之后新增「前端 UI 链接」小节，写明 `a` 标签的 `href` MUST 使用完整 URL、原因与本仓库示例。

### 5. 变更记录

`CHANGELOG.md` 在 `Unreleased` 的 `Changed` 下补两条：实机链接安装与热更新；前端 UI 链接规则。

## 验证

1. `pnpm format && pnpm check`。
2. `bash -n .dsh/skills/real-device-test/scripts/setup-env.sh`。
3. `node --check .dsh/skills/real-device-test/scripts/run-test.mjs`。
4. 与模板 `fe93cd0`、`197480e` 逐文件 diff 核对，确认未适配项只有约定的两处验证段。
5. 核对文档：小节位置、示例 URL、无占位符残留。
6. 不执行实机回归；该限制与风险已记录在规格审查记录。

## 复杂度追踪

无宪法偏离。
