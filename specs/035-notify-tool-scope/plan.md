# Implementation Plan: 通知工具限定在桥接会话

**Branch**: `fix/035-notify-tool-scope` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/035-notify-tool-scope/spec.md`

**Status**: Approved

## Open Decisions

| ID | 问题 | 结论 | 依赖 | 状态 |
| --- | --- | --- | --- | --- |
| 无 | 待确认决策已全部回答 | - | - | - |

## Clarifications

### Session 2026-11-21

- [I-001] Q: 工具执行体是否加会话守卫？ -> A: 加。agent 缺失或不是桥接会话时直接返回错误，不发飞书请求。
- [I-002] Q: 验证到哪一层？ -> A: 单元测试加 `pnpm build`；不搭建真实宿主环境。
- [I-003] Q: 桥接提醒文案是否更新？ -> A: 保持不变。
- [I-004] Q: 是否包含版本发布？ -> A: 发布 `0.1.6`。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 不搭建真实宿主验证，宿主 when 行为漂移只能靠单元测试发现；agent 缺失时工具报错，宿主当前不会这样分发条件工具

## Summary

`lark_notify` 目前在 `apply` 中全局注册，所有会话都能看到并调用。规格要求它只对桥接会话可见与可执行。

实现用宿主 `ctx.tools.register` 的 `when` 条件按步骤判定当前会话是否为桥接会话，判定复用提醒补注使用的 `SessionManager.isBridgeSession`。执行体再加一道守卫：agent 缺失或不是桥接会话时返回 `not-bridge-session`，不发飞书请求。工具参数、拆分与发送实现不变。

## Technical Context

**Language/Version**: TypeScript 6.0，Node.js 24

**Primary Dependencies**: `@deepseek-ai/dsh-tools`（`ToolRegistrationOptions`）、`@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-session`，版本 `0.2.2-rc.5`

**Storage**: 插件状态文件 `~/.dsh/lark-bridge/state.json`

**Testing**: vitest（`tests/tools.test.ts`、`tests/plugin.test.ts`）；不搭建真实宿主环境

**Target Platform**: DSH 宿主（Windows 桌面版，`0.2.2-rc.5`）

**Project Type**: DSH 插件（单包 TypeScript 库）

**Performance Goals**: `when` 每步调用一次，命中 `StateStore` 内存缓存；发送路径不增加调用

**Constraints**: 保持 032 的整批丢弃策略、033 的引用回复语义与 034 的会话创建请求；提醒文案不变

**Scale/Scope**: 单工作区、单桥接会话

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或升级依赖；只使用已锁定的 `0.2.2-rc.5` 导出类型 |
| II. 测试同步 | PASS | 更新 `tests/tools.test.ts` 与 `tests/plugin.test.ts`，覆盖条件求值与执行守卫；真实宿主验证经用户选择不执行，风险记录在案 |
| III. 文档结构 | PASS | README 增加工具小节；`docs/how-it-works.md#通知` 写明作用范围；`CHANGELOG.md` 增加条目，发布时归档 |
| IV. 质量门禁 | PASS | 每步执行 `pnpm format && pnpm check`；交付前 `pnpm build` |
| V. 公开引用 | PASS | 文档只引用仓库内路径与宿主包名 |

## Project Structure

### Documentation (this feature)

```text
specs/035-notify-tool-scope/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/tool-availability.md
├── checklists/requirements.md
└── tasks.md（由 /speckit-tasks 生成）
```

### Source Code (repository root)

```text
src/
├── index.ts        # 注册通知工具与 when 条件
├── tools.ts        # 工具定义与执行守卫
└── sessions.ts     # isBridgeSession（复用，不改）

tests/
├── helpers.ts      # ctx 模拟记录注册选项并支持求值 when
├── plugin.test.ts  # apply 接线与条件求值
└── tools.test.ts   # 执行守卫

README.md           # 工具小节
docs/
└── how-it-works.md # 通知范围
CHANGELOG.md        # Unreleased 条目
```

**Structure Decision**: 沿用单包结构。可见性判定与提醒共用 `SessionManager.isBridgeSession`，注册选项在 `apply` 中给出，执行守卫落在 `buildNotifyTool`。

## Complexity Tracking

无宪章违规项。

## 变更点

| 文件 | 改动 |
| --- | --- |
| `src/index.ts` | `ctx.tools.register(notifyTool, { when })`；条件求值 `sessions.isBridgeSession(agent.session)`，异常按不可见处理；把判定传给工具依赖 |
| `src/tools.ts` | `buildNotifyTool` 依赖增加桥接会话判定；执行体先校验会话，失败返回 `not-bridge-session`；`render` 为该错误给出独立文案 |
| `tests/helpers.ts` | `tools.register` 记录第二个参数，暴露按 agent 求值 `when` 的入口 |
| `tests/plugin.test.ts` | 断言注册带 `when`；状态文件为空时条件为 false，写入会话标识后为 true；会话标识变化后跟随 |
| `tests/tools.test.ts` | 断言非桥接会话执行时不调用 CLI、返回 `not-bridge-session`；桥接会话行为不变 |
| `README.md` | 增加工具小节，说明 `lark_notify` 只在桥接会话可用 |
| `docs/how-it-works.md` | 通知一节写明作用范围与判定来源 |
| `CHANGELOG.md` | Unreleased 增加修复条目 |

## 验证

- 单元：`pnpm run test:code -- tools plugin`。
- 全量：`pnpm format && pnpm check && pnpm build`。
- 实机：不执行。风险是宿主 `when` 行为漂移只能靠单元测试发现。
- 发布：合并后在独立分支执行 `pnpm release` 发布 `0.1.6`；主工作区只做 `git fetch` 与 `git pull`。
