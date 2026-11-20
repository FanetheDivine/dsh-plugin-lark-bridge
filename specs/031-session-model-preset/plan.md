# Implementation Plan: 桥接会话的模型与预设

**Branch**: `feat/031-session-model-preset` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/031-session-model-preset/spec.md`

**Status**: Approved

## Open Decisions

待确认决策：无，实现决策见 `## Clarifications`。

探索结论（来自宿主 rc.5 包与参考插件）：

- 预设只能经 `sessionController.create({ agentPreset })` 组合；`ctx.agents.create` 的 `meta.agentPreset` 只写入会话头，不会挂载预设。
- 模型经 `agent.model.select(selection)` 写入新会话；宿主文档说明调用方自行校验可用性。
- `llm.resolveCallConfig(selection)` 可用于创建前校验完整 provider/model/effort。
- 配置页复用官方 `ModelSelect`（`dsh-client-ui-model-selection/src/client/ModelSelect.tsx`）需要 `@tsdown/css` 编译其 CSS module，并将 `dist/client.css` 注入 `dist/client.js`。
- 官方 `ModelSelect` 与目录代码从 `@deepseek-ai/dsh-api-remotes`、`dsh-api-session-controller`、`dsh-client-product-analytics`、`dsh-typert-protocol`、`dsh-client-store` 取类型与服务，这些包需要显式声明。
- 客户端注入 `@deepseek-ai/dsh-client-ui-model-selection` 会一并带入 `remote`、`remote.session`；预设名册用 `remote.agentPresets`。
- `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 必须与 23 个 dsh 依赖逐项一致（`tests/dependency-versions.test.ts` 断言）。
- 现有客户端测试断言入口没有 `inject` 导出，升级后需要同步调整。

## Clarifications

### Session 2026-11-21

- [I-001] Q: 模型行采用哪种实现？ -> A: 复用官方 `ModelSelect`。
- [I-002] Q: 本次是否修改 CHANGELOG？ -> A: 新增 `Unreleased` 条目。
- [I-003] Q: 配置页新增行的文案？ -> A: 模型「选择新建桥接会话时使用的模型」，预设「选择新建桥接会话时使用的预设」，卡摘要「工作区、模型、预设与飞书连接」。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 依赖升级到 rc.5 带来接口漂移；官方选择器源码子路径导入随宿主版本变化；README 按用户要求暂不更新

## Summary

在插件配置页为新建桥接会话增加「模型」与「预设」两行，分别复用官方模型选择器与宿主预设名册。配置保存后，下一条需要新建桥接会话的飞书消息按「已保存值 > 宿主默认」解析模型与预设；预设不可用时回退宿主默认，模型不可用时回退宿主默认并记录日志，消息照常注入。已存在的桥接会话保持不变。为使用 rc.5 接口，全部 `@deepseek-ai/*` 依赖升级到 `0.2.2-rc.5`。

## Technical Context

**Language/Version**: TypeScript 6.0.3，Node.js ≥ 24.9，target es2024

**Primary Dependencies**: DSH `0.2.2-rc.5`；新增 `dsh-agent-preset-registry`、`dsh-api-remotes`、`dsh-api-session-controller`、`dsh-client-product-analytics`、`dsh-client-ui-model-selection`、`dsh-typert-protocol` 与 `@tsdown/css@^0.22.14`；cordis `~4.1.0`

**Storage**: 插件配置新增 `sessionProvider`、`sessionModel`、`sessionEffort`、`sessionPreset`；`state.json` 结构不变

**Testing**: vitest `code` 与 `dist` 两个 project；前端用 jsdom 与 `renderToStaticMarkup`；不做实机验证（D-008）

**Target Platform**: DSH 插件（Node 宿主 + Web Client）

**Project Type**: 单包插件

**Performance Goals**: 配置页生命周期内加载一次模型目录；每次新建桥接会话增加一次预设名册读取与一次模型校验

**Constraints**: 预设必须经 `sessionController.create` 组合；模型经 `agent.model.select` 写入；官方选择器需要 CSS 注入管线；新客户端代码需要 `dsh-client-store` 种子模块

**Scale/Scope**: 单用户、单工作区、单桥接会话

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 全部 23 个 `@deepseek-ai/dsh-*` 锁定 `0.2.2-rc.5` 并列入 `minimumReleaseAgeExclude`；cordis 子包与 schemastery 保持原版本 |
| II. 测试同步 | PASS | 更新 `tests/config-form.test.ts`、`tests/client.test.ts`、`tests/client-bundle.test.ts`、`tests/sessions.test.ts`、`tests/plugin.test.ts`；新增模型目录与预设目录测试；实机验证按 D-008 跳过（宪章列为 SHOULD） |
| III. 文档结构 | PASS（偏离已批准） | 更新 `docs/how-it-works.md`、`docs/known-risks.md` 与 `CHANGELOG.md`；README 按 D-007 暂不更新，记入 Complexity Tracking |
| IV. 质量门禁 | PASS | 提交前运行 `pnpm format && pnpm check`；新增构建链后运行 `pnpm build` |
| V. 公开引用 | PASS | 只引用仓库内路径与包路径 |

Phase 1 复核：设计产物与上表一致，无新增违规。

## Project Structure

### Documentation (this feature)

```text
specs/031-session-model-preset/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── config-page.md
│   └── session-creation.md
└── tasks.md          # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── config.ts              # 修改：四个配置字段、配对校验、模型选择解析
├── index.ts               # 修改：无新接线，保持读取实时配置
├── sessions.ts            # 修改：经 sessionController 建立会话、应用模型与预设
├── css.d.ts               # 新增：CSS Modules 类型声明
└── client/
    ├── config-form.ts     # 修改：四个文本字段
    ├── config-page.tsx    # 修改：模型行与预设行
    ├── index.ts           # 修改：inject 导出、模型目录与预设目录接线
    ├── locales.ts         # 修改：模型与预设文案、model 命名空间声明
    ├── model-defaults.ts  # 新增：模型目录状态与草稿写入
    ├── preset-defaults.ts # 新增：预设名册状态与草稿写入
    └── preset-select.tsx  # 新增：预设触发器与宿主 Menu

tsdown.config.ts           # 修改：css 选项、CSS 内联、补 dsh-client-store
package.json               # 修改：依赖版本、新增包、client.inject
pnpm-workspace.yaml        # 修改：minimumReleaseAgeExclude 的 23 条记录
docs/how-it-works.md       # 修改：配置与新建会话流程
docs/known-risks.md        # 修改：宿主版本与官方源码导入风险
CHANGELOG.md               # 修改：Unreleased 条目
tests/
├── client.test.ts         # 修改：入口注入与配置页渲染
├── client-bundle.test.ts  # 修改：产物种子模块与 inject
├── config-form.test.ts    # 修改：四字段草稿
├── sessions.test.ts       # 修改：预设与模型的应用与降级
├── plugin.test.ts         # 修改：配置解析与默认值
├── model-defaults.test.ts # 新增：模型目录状态与选择写入
├── preset-defaults.test.ts# 新增：预设名册状态与选择写入
└── helpers.ts             # 修改：补充远程与目录桩
```

**Structure Decision**: 沿用单包布局；模型目录与预设目录各用独立客户端模块，选择器组件与配置页同目录；后端改动集中在 `config.ts` 与 `sessions.ts`。

## Module Design

- **配置**：四个 volatile 字符串字段；`provider` 与 `model` 同时非空才构成选择，`effort` 只在成对时生效；空值与半组配置按未配置处理。
- **会话**：`SessionManager.create` 优先用 `sessionController.create({ workspaceId, cwd, agentPreset })`；预设值先经 `agentPresets.list()` 过滤，不可用则省略。创建后 `resolveAgent` 并 `agent.model.select(selection)`；`llm.resolveCallConfig` 失败的模型跳过并记录 warn。缺少 `sessionController` 时回退 `ctx.agents.create`，预设忽略并记录 warn。
- **标题**：创建后向会话追加 `session/title` 事件，与现有事件形状一致。
- **客户端目录**：`ModelDefaults` 复用官方 `ModelCatalogDirectory`，`PresetDefaults` 读 `remote.agentPresets.list()`；两者只写配置草稿。
- **配置页**：工作区行下方依次渲染模型行（官方 `ModelSelect`）与预设行（`PresetSelect`）；文案见 `contracts/config-page.md`。
- **构建**：`tsdown` 增加 `css` 输出并把 CSS 内联进 `dist/client.js`；`PLATFORM_MODULES` 补 `@deepseek-ai/dsh-client-store`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| README 未随用户可见行为更新（宪章 III） | 用户要求（D-007）：另一 PR 正在精简 README，本次改动会冲突 | 更新 README 会与并行分支冲突，合并成本高于收益 |
