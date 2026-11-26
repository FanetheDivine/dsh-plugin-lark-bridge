# Implementation Plan: 修复工具参数声明不是无损 JSON 导致的宿主崩溃

**Branch**: `fix/064-tool-params-lossless-json` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/064-tool-params-lossless-json/spec.md`

**Status**: Approved

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-101] Q: 无损 JSON 校验函数放在哪里？ -> A: `tests/support/lossless-json.ts`，support 放纯工具函数，`tests/helpers.ts` 保持 ctx 模拟。
- [D-102] Q: 「全部已注册工具」如何收集？ -> A: 新增 `tests/tool-schema.test.ts`，经真实注册入口汇总三行插件的 `_registeredTools`。
- [D-103] Q: 是否在 `docs/how-it-works.md` 补声明生成方式？ -> A: 补一句，机制变化归入通知小节。
- [D-104] Q: 最终验证用哪条命令？ -> A: `pnpm format && pnpm check`，不重建 `dist`。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current complete plan | Open items: none | Risks: 宿主升级改变克隆规则时测试与宿主不再等价；不做实机验收，崩溃不复现由等价规则的单测证明

## Summary

`src/tools.ts` 的 `parametersOf` 直接把 `z.toJSONSchema` 的返回值当作工具声明。zod 4.6.6 在该对象上挂了不可枚举的 `~standard` 键，宿主 `projectToolSchema` 的克隆只接受可枚举字符串键，克隆失败即抛致命异常，`dsh-plugin-better-mcp` 每步枚举声明时终止进程。

方案：

- `parametersOf` 改成返回纯 JSON 副本：解构剔除 `$schema` 与 `~standard`，其余键原样保留。
- 测试侧新增按宿主规则递归校验的复用函数，覆盖 `lark_notify` 与全部已注册工具的声明。
- 新增一条测试走真实注册入口，汇总三行插件的工具后逐个校验。
- `docs/how-it-works.md` 的通知小节补一句声明生成方式，`CHANGELOG.md` 加一条。

声明的可见结构、参数校验、发送行为与失败码均不变。

## Technical Context

**Language/Version**: TypeScript 6.0（Node ESM，DSH 插件）

**Primary Dependencies**: `zod@4.6.6`；`@deepseek-ai/dsh-tools@0.2.2-rc.5`（宿主提供）；无新增依赖

**Storage**: 不适用

**Testing**: vitest，`code` 项目（`pnpm test:code`）；本次不改 `dist` 项目

**Target Platform**: DSH 宿主 0.2.2-rc.5

**Performance Goals**: 不适用；转换只在注册时执行一次

**Constraints**: 不改宿主代码；`~standard` 由 zod 添加，行为不随版本开关变化；声明不含宿主无法克隆的值；声明结构、发送行为与失败码保持现状

**Scale/Scope**: 1 个源文件（`src/tools.ts`）、2 个测试文件（`tests/tools.test.ts` 与新增 `tests/tool-schema.test.ts`）、1 个测试支撑文件、1 份文档、`CHANGELOG.md`

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级依赖；规则以宿主 0.2.2-rc.5 的 `snapshotJsonValue` 为准 |
| II. 测试同步 | 通过。新增声明校验测试并更新 `tests/tools.test.ts`；实机验证经用户确认不做（规格 D-004），替代验证见 Quickstart |
| III. 文档结构 | 通过。机制归属 `docs/how-it-works.md` 通知小节一句；`README.md` 面向用户行为，行为未变，不改；变更条目进 `CHANGELOG.md` |
| IV. 质量门禁 | 通过。实现后运行 `pnpm format && pnpm check` |
| V. 公开引用 | 通过。改动只涉及仓内标识与相对路径 |

## Project Structure

### Documentation (this feature)

```text
specs/064-tool-params-lossless-json/
├── spec.md              # 需求规格
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/
└── tools.ts                     # parametersOf 返回纯 JSON 副本

tests/
├── tools.test.ts                # lark_notify 声明的校验与结构断言
├── tool-schema.test.ts          # 新增：全部已注册工具的声明校验
└── support/
    └── lossless-json.ts         # 新增：按宿主规则递归校验并返回深拷贝

docs/
└── how-it-works.md              # 通知小节补一句声明生成方式

CHANGELOG.md                     # 变更条目
```

**Structure Decision**: 沿用现有单插件布局，不新增源码模块。校验函数只在测试侧使用，不进入发布产物。

## Complexity Tracking

| 偏离 | 理由 | 影响 |
| --- | --- | --- |
| 不做实机验收（宪章 II 的 SHOULD） | 用户明确不做（规格 D-004） | 崩溃不复现由宿主等价规则的单元测试证明；宿主升级改变规则时测试与宿主不再等价，已记入规格 Review Record 风险 |
