# Implementation Plan: main 合并门禁

**Branch**: `chore/020-require-checks-merge` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/020-require-checks-merge/spec.md`

## Summary

在 GitHub 仓库上为 `main` 建一条 active 的仓库规则集：要求全部 check 通过、要求 PR 分支与 `main` 同步、禁止强推与删除，并保留直推。管理员不进 bypass 列表，恢复手段是临时把规则集设为 `disabled`。规则以 `gh api` 命令表达并记录到 `docs/development.md`。

## Technical Context

**Language/Version**: Bash + `gh` CLI 2.97；仓库代码工具链（Node 24、pnpm 11）不变

**Primary Dependencies**: GitHub REST API（Repository rulesets）、`gh api`

**Storage**: GitHub 仓库设置，无仓库内状态文件

**Testing**: 真机验证：故意失败的探测 PR 验证合并被拒，无 check 提交直推 `main` 被拒，`gh api` 读取规则验证配置

**Target Platform**: GitHub.com，public 仓库 `FanetheDivine/dsh-plugin-lark-bridge`

**Project Type**: 仓库配置与开发者文档

**Performance Goals**: CI 结束后 1 分钟内门禁状态更新，无额外等待机制

**Constraints**: 规则集不设 bypass，管理员同样受限；恢复手段为临时 `disabled`；规则集不能表达「未来新增的 check 自动纳入」，新增 job 时需同步规则；直推与 PR 合并共用一次 check 校验，新提交必须先跑过 CI

**Scale/Scope**: 单仓库、`main` 一条规则集、两个 check context

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 判断 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | 不适用 | 不改依赖 |
| II. 测试同步 | 通过 | 不涉及插件代码；用真机验证覆盖合并、直推与规则读取，不新增 `tests/` 用例 |
| III. 文档结构 | 通过 | 流程归属 `docs/development.md`；`README.md` 面向插件用户，不改 |
| IV. 质量门禁 | 通过 | 提交前运行 `pnpm format && pnpm check` |
| V. 公开引用 | 通过 | 只引用 GitHub 公网 URL 与仓库内路径 |

## Project Structure

### Documentation (this feature)

```text
specs/020-require-checks-merge/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── spec.md
└── tasks.md             # Phase 2 output (/speckit-tasks)
```

### Source Code (repository root)

```text
.github/workflows/ci.yml   # check job 与 tag 发布 job，规则依据其 job 名
docs/development.md        # 新增「合并门禁」小节：规则、查看命令、临时关闭、新增 check
```

**Structure Decision**: 仓库内只改 `docs/development.md`；门禁本体是 GitHub 远端设置，由 `gh api` 调用创建。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 无单元测试覆盖门禁 | 门禁是 GitHub 远端配置，无本地可测面 | 只能靠真机验证；已在 quickstart 固化探测步骤 |
