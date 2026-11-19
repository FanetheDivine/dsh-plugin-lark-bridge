# Implementation Plan: 使用 lark-cli 自带的 bot 身份

**Branch**: `fix/022-default-bot-identity` | **Date**: 2026-11-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from [spec.md](./spec.md)

## Summary

插件改为直接使用 lark-cli 当前生效配置的 bot 身份，删除应用绑定与专用档案。

- 所有 lark-cli 调用去掉 `--profile`。
- 鉴权阶段收敛为 `cli-missing`、`bot-unavailable`、`user-missing`、`ready`。
- 删除 `POST /lark-bridge/app`、`bindApp`、`profile` 与 `ownerOpenId` 配置。
- 配置页与弹窗删除 App ID、App Secret、档案名与 open_id 输入，`bot-unavailable` 显示终端配置指引。
- 配置校验容忍旧键 `profile` 与 `ownerOpenId`，读取后丢弃。

决策依据见 [research.md](./research.md)。

## Technical Context

**Language/Version**: TypeScript（ESM），Node.js 24

**Primary Dependencies**: `@larksuite/cli`、宿主提供的 `@deepseek-ai/*`、React（浏览器端）

**Storage**: `$DSH_HOME/lark-bridge/state.json`，不变

**Testing**: vitest，`tests/helpers.ts` 的模拟 `ctx`

**Target Platform**: DSH 宿主插件（Windows、macOS、Linux）

**Project Type**: DSH 插件（宿主端 + 浏览器端）

**Performance Goals**: 沿用现状，鉴权检查少一次 `profile list` 调用

**Constraints**: 插件不得读取或写入 lark-cli 的凭据与档案

**Scale/Scope**: 一个用户、一个工作区

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过：不改依赖 |
| II. 测试同步 | 通过：更新 `auth`、`config`、`routes`、`bridge`、`tools`、`client`、`config-form` 相关测试，新增旧键容忍与 bot 不可用指引用例 |
| III. 文档结构 | 通过：用户可见变化写入 README，机制写入 how-it-works，风险写入 known-risks，CHANGELOG 增加条目 |
| IV. 质量门禁 | 通过：实施后运行 `pnpm format && pnpm check` |
| V. 公开引用 | 通过：文档只引用仓库路径与公网 URL |

设计后复核：同上，无偏离。

## Project Structure

### Documentation (this feature)

```text
specs/022-default-bot-identity/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   └── routes.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── auth.ts            # 去掉 profile list、bindApp、--profile
├── bridge.ts          # event consume 去掉 --profile
├── tools.ts           # im +messages-send 去掉 --profile
├── config.ts          # 删除 profile、ownerOpenId；容忍旧键
├── constants.ts       # 删除 DEFAULT_PROFILE
├── routes.ts          # 删除 /app 路由
├── index.ts           # 日志与 owner 读取去掉旧字段
└── client/
    ├── api.ts         # 删除 bindApp，收窄 AuthStage
    ├── auth-panel.tsx # 删除绑定表单，新增配置指引
    ├── auth-overlay.tsx
    ├── config-form.ts # 删除 profile、ownerOpenId 字段
    ├── config-page.tsx
    └── locales.ts     # 同步中英文文案

tests/                 # 对应更新
cordis.patch.yml       # 删除 profile、ownerOpenId
README.md, docs/how-it-works.md, docs/known-risks.md, CHANGELOG.md
```

**Structure Decision**: 沿用现有单包结构，只做删减与文案调整。

## Complexity Tracking

无偏离。
