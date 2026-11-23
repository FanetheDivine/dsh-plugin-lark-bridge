# Implementation Plan: 迁入飞书任务与调度会话

**Branch**: `feat/039-dispatch-session-migration` | **Date**: 2026-11-23 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/039-dispatch-session-migration/spec.md`

**Status**: Approved

## Open Decisions

无。

## Clarifications

### Session 2026-11-23

- [P-000] Q: 实现层面的命名、目录、文案与结构如何取舍？ -> A: 完全和组合包现有实现保持一致，仅作代码和功能上的迁移。

由 P-000 推出的实现选择：

| 编号 | 选择 |
| --- | --- |
| P-001 | 行 id、入口名与组合包相同：`lark-super-agent`、`sa-dispatch`、`sa-worker`、`preset-sa-dispatch`、`preset-sa-worker`。 |
| P-002 | 源码目录与测试文件名与组合包相同：`src/lark-super-agent/`、`src/sa-dispatch/`、`src/sa-worker/`、`tests/lark-super-agent-*.test.ts`、`tests/sa-*.test.ts`、`tests/presets-patch.test.ts`。 |
| P-003 | 服务照旧每次读取 `$DSH_HOME/lark-bridge/state.json`。 |
| P-004 | 三行的 `rows/<row>/locale/*.json` 与 `icon.svg` 逐字复制。 |
| P-005 | 代码注释、提示词、工具描述与提交信息逐字复制。 |
| P-006 | README 与 `docs/` 的调度章节从组合包对应章节搬入，只删去组合包自身的上下文。 |
| P-007 | `tasks.md` 每个阶段一个 commit。 |

为满足规格必须做的改动，见 [迁移调整](#迁移调整)。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 见 [风险](#风险)

## Summary

把组合包 `main`（`cc3c25d`）的调度服务、两个预设子行与两个预设声明原样复制进本插件。本插件新增三行与两个预设声明，随包安装 `dsh-plugin-meta-tools@0.1.7`。只做规格要求与运行环境必需的调整。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`

**Primary Dependencies**: 宿主 `@deepseek-ai/*@0.2.2-rc.5`、`dsh-plugin-meta-tools@0.1.7`

**Storage**: 调度工作区内的 JSON、Markdown 与 git 仓库

**Testing**: vitest，`code` 与 `dist` 两个 project；实机验证用 `real-device-test` skill

**Target Platform**: DSH 宿主，Windows、macOS、Linux

**Project Type**: DSH 插件 npm 包

**Performance Goals**: 与组合包一致

**Constraints**: 宿主依赖保持 external；新入口不内联宿主包

**Scale/Scope**: 约 2000 行源码、1700 行测试

## 迁移调整

| 编号 | 位置 | 调整 | 依据 |
| --- | --- | --- | --- |
| A-01 | `src/lark-super-agent/status.ts`、`index.ts` 的路由、`service.status()`、`api.ts` 的 `status` 成员、`tests/lark-super-agent-status.test.ts` | 删除 | 规格 D-006 |
| A-02 | `src/lark-super-agent/index.ts` | 去掉 `connection` 注入与 `../rows.ts`、`../utils.ts` 引用，只保留 `provide('larkSuperAgent')` | 随 A-01 |
| A-03 | `src/lark-super-agent/service.ts` | 读取 `workspaceRoot` 后经本仓 `toHostWorkspacePath` 转换再访问文件 | 本仓状态文件保存 `/c/...` 形式；Windows 上原值解析到错误目录，见 [research R-03](./research.md#r-03-桥接状态的读取与路径) |
| A-04 | `../types.ts` 引用 | 改用本仓 `src/types.ts` 的 `Context` | 本仓类型模块 |
| A-05 | `cordis.patch.yml` 的 `preset-sa-worker` 与 `rows/sa-worker/locale/zh.json` | `name` 与行标题改为 `SA-工作会话` | 规格 D-013 |
| A-06 | `rows/lark-super-agent/locale/*.json` | 描述去掉「通过独立安装的 lark-bridge」：中文为「派发任务，协调调度会话与任务会话，并维护笔记、上报和任务归档。」，英文为 `Dispatch tasks, coordinate dispatch and worker sessions, and maintain notes, reports, and task archives.` | 功能已在本插件内 |
| A-07 | `locale/*.json`、`package.json` 的 `description` | 中文标题「用飞书和DSH对话」，描述「配置lark-cli即可在手机和dsh对话，体验Super Agent！」；英文标题 `Talk to DSH from Lark`，描述 `Configure lark-cli to chat with DSH from your phone and try Super Agent!` | 规格 D-009、FR-013 |
| A-08 | `package.json` 三行的 `types` | 指向 tsc 实际产物 `./dist/<row>/index.d.ts` | 本仓 `tsconfig.build.json` 按目录输出 |

其余代码逐字复制。

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I 宿主依赖版本 | 通过。新代码只用已锁定为 `0.2.2-rc.5` 的 `dsh-llm`、`dsh-session`、`dsh-tools`。`dsh-plugin-meta-tools@0.1.7` 列入 `minimumReleaseAgeExclude`。 |
| II 测试同步 | 通过。组合包对应测试全部迁入；`package-pack`、`metadata` 与 `dist-freshness` 覆盖新入口、`rows/` 与依赖；`dependency-versions` 继续校验。实机验证见 [quickstart.md](./quickstart.md)。 |
| III 文档结构 | 通过。README 写用法；`docs/how-it-works.md` 写机制；`docs/known-risks.md` 写风险；`docs/development.md` 更新测试表与文件地图；`docs/i18n.md` 补子行元数据；`AGENTS.md` 更新项目说明；`CHANGELOG.md` 增加条目。 |
| IV 质量门禁 | 通过。每阶段运行 `pnpm format && pnpm check`，最后运行 `pnpm full-check`。 |
| V 公开引用 | 通过。文档只引用仓库内路径与组合包公网仓库链接。 |

设计完成后复核：结论不变。

## 设计

### 包结构

| 入口 | 行 id | 作用 |
| --- | --- | --- |
| `dist/index.mjs` | `dsh-plugin-lark-bridge` | 现有主行，不变 |
| `dist/lark-super-agent.mjs` | `lark-super-agent` | `larkSuperAgent` 服务 |
| `dist/sa-dispatch.mjs` | `sa-dispatch` 预设子行 | 调度工具、提示词与在场提醒 |
| `dist/sa-worker.mjs` | `sa-worker` 预设子行 | `send_report`、提示词、调度消息标记与失败通知 |
| `dist/client.js` | 随主行 | 不变 |

- `cordis.patch.yml` 在主行之后插入 `lark-super-agent`、`preset-sa-dispatch`、`preset-sa-worker`，内容按 [contracts/presets.md](./contracts/presets.md)。
- `tsdown.config.ts` 宿主构建增加三个入口，`neverBundle` 保持 true，`alwaysBundle` 保持空。
- `package.json`：
  - `exports` 增加三行的模块、`locale/*.json` 与 `icon`。
  - `files` 增加 `rows`。
  - `dependencies` 增加 `dsh-plugin-meta-tools: 0.1.7`。
  - `devDependencies` 增加 `yaml: ^2.9.1`，供 `tests/presets-patch.test.ts` 解析补丁。
  - `keywords` 增加 `lark-super-agent`、`dispatch`。
  - 版本号保持 `0.2.0`。`0.3.0` 由单独的发布 PR 完成，见 [research R-07](./research.md#r-07-发布方式)。

### 数据与接口

- 数据文件见 [data-model.md](./data-model.md)。
- 工具、注入块与预设见 [contracts/](./contracts/)。

### 测试

| 测试 | 来源 | 调整 |
| --- | --- | --- |
| `tests/lark-super-agent-{blocks,git,index,notes,reports,service}.test.ts` | 组合包 | `index` 去掉路由断言；`service` 增加 A-03 的路径转换用例 |
| `tests/sa-dispatch.test.ts`、`tests/sa-worker.test.ts` | 组合包 | 使用本仓 `tests/helpers.ts` 的 `makeCtx` |
| `tests/presets-patch.test.ts` 与 `tests/support/standard-preset.yml` | 组合包 | 断言预设名 `SA-工作会话`，去掉组合包其他行的断言 |
| `tests/package-pack.test.ts` | 本仓 | 包含三份新入口、`rows/` 与 `dsh-plugin-meta-tools` 依赖 |
| `tests/metadata.test.ts` | 本仓 | 校验三行元数据与清单声明 |
| `tests/plugin.test.ts` 等现有测试 | 本仓 | 不改，作为 FR-012 的回归 |

### 文档

| 文档 | 内容 |
| --- | --- |
| `README.md` | 增加「飞书任务与调度会话」章节：前置、远程调度用法、两个预设、上报与注入、笔记与归档 |
| `docs/how-it-works.md` | 增加「调度服务与预设叠加」「调度工作区存储」「上报投递与失败监听」，组成表增加三行 |
| `docs/known-risks.md` | 增加 `lark-super-agent` 各小节，删去状态路由相关句 |
| `docs/development.md` | 测试表与文件地图增加新文件 |
| `docs/i18n.md` | 元数据资源增加 `rows/<row>/locale/*.json` |
| `AGENTS.md` | 项目说明增加调度会话 |
| `CHANGELOG.md` | `Unreleased` 增加 `Added` 条目 |

## Project Structure

### Documentation (this feature)

```text
specs/039-dispatch-session-migration/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── presets.md
│   ├── tools.md
│   └── injection.md
└── tasks.md
```

### Source Code (repository root)

```text
cordis.patch.yml              # 主行 + lark-super-agent + 两个预设声明
rows/
├── lark-super-agent/{icon.svg,locale/}
├── sa-dispatch/{icon.svg,locale/}
└── sa-worker/{icon.svg,locale/}
src/
├── lark-super-agent/         # api、blocks、bridge、git、ids、index、notes、reports、service
├── sa-dispatch/              # index、presence、prompt、tools
└── sa-worker/                # dispatch-message、host、index、prompt、tools
tests/
├── lark-super-agent-*.test.ts
├── sa-dispatch.test.ts
├── sa-worker.test.ts
├── presets-patch.test.ts
└── support/standard-preset.yml
```

**Structure Decision**: 与组合包目录一致，按行分目录。

## 风险

- 本插件与旧版组合包同时启用时，行 id、预设与工具重复注册。规格 D-004 决定不处理。
- 独立安装的 `dsh-plugin-meta-tools` 与预设内子行同时启用时，同名工具重复注册。
- 服务依赖本仓状态文件格式；修改 `state.json` 时必须同步调度服务。

## Complexity Tracking

无违反项。
