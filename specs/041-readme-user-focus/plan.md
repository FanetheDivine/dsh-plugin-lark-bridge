# Implementation Plan: README 面向使用者

**Branch**: `docs/041-readme-user-focus` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/041-readme-user-focus/spec.md`

**Status**: Approved

## Open Decisions

无。技术事实均已从仓库确认，见 [research.md](./research.md)。

## Clarifications

### Session 2026-11-24

无需用户回答的实现问题。

## Review Record

- 2026-11-24 | Decision: Approved | Scope: current full document | Open items: none | Risks: 不介绍工具与宪章 III 的内容归属不一致，按用户要求执行

## Summary

把 `README.md` 改写为三节：简介、使用、关于两个预设，全文见 [contracts/readme.md](./contracts/readme.md)。删除的信息中 `docs/` 未覆盖的部分迁入 `docs/how-it-works.md`，归属见 [data-model.md](./data-model.md)。同步修正依赖 README 锚点的两处引用。

## Technical Context

**Language/Version**: Markdown

**Primary Dependencies**: 无

**Storage**: N/A

**Testing**: `pnpm format && pnpm check`；package-pack 测试确认 `README.md` 进包

**Target Platform**: npm 页、GitHub 仓库页、DSH「插件」页详情

**Project Type**: DSH 插件的文档

**Performance Goals**: N/A

**Constraints**: README 无相对链接；界面名称与中文界面一致

**Scale/Scope**: 改动 `README.md`、`docs/how-it-works.md`、`AGENTS.md` 一行、`CHANGELOG.md`

## 改动清单

### `README.md`

整体替换为 [contracts/readme.md](./contracts/readme.md) 的全文。

### `docs/how-it-works.md`

| 章节 | 改动 |
| --- | --- |
| 鉴权 | 锚点 `README.md#前置` 改为 `README.md#使用` |
| 鉴权 | 追加飞书开放平台配置：启用机器人能力；订阅 `im.message.receive_v1` 并选择接收单聊消息；授予 `im:message.p2p_msg:readonly` 与 `im:message:send_as_bot` |
| 调度服务与预设叠加 | 全局行停用一句补充：飞书对话与 `lark_notify` 照常工作 |
| 调度服务与预设叠加 | 追加：只有 `workspaces.json` 已登记的工作区可接收任务；无匹配时先请用户新增或补充工作区，多个匹配时先问清目标；派发后回执目标工作区与执行会话 |
| 调度工作区存储 | 追加：本机需安装 git，并配置 `user.name` 与 `user.email` |
| 上报投递与失败监听 | `send_report` 一句补充：`text` 与 `files` 至少提供一项，`files` 为 Markdown 文件路径 |

### `AGENTS.md`

文档索引中 README 的描述改为「插件简介、使用与预设」。

### `CHANGELOG.md`

在 `[Unreleased]` 下增加 `### Changed` 条目：README 改为面向使用者的精简版本。按宪章 III 在 push 前提交。

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I 宿主依赖版本 | 通过。不改依赖 |
| II 测试同步 | 通过。不改代码；package-pack 测试照常确认 `README.md` 进包 |
| III 文档结构 | 通过，含一项用户要求的偏离，见 Complexity Tracking。实现细节移出 README；每条信息只有一个归属；锚点与索引同步修正；CHANGELOG 在 push 前补充 |
| IV 质量门禁 | 通过。改动后运行 `pnpm format && pnpm check` |
| V 公开引用 | 通过。README 只含 npm 与 shields.io 公网 URL |

设计完成后复核：结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/041-readme-user-focus/
├── plan.md
├── research.md
├── data-model.md        # 信息归属表
├── quickstart.md
├── contracts/
│   └── readme.md        # README 目标全文
├── checklists/
│   └── requirements.md
└── tasks.md             # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
README.md
AGENTS.md
CHANGELOG.md
docs/
└── how-it-works.md
```

**Structure Decision**: 只改上述文档文件，不涉及 `src/` 与 `tests/`。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| 宪章 III 把「工具」列为 README 的归属内容，README 不介绍工具 | 用户要求（spec D-007） | 保留工具介绍与用户要求冲突；工具说明已归属 `docs/how-it-works.md` |
