# Implementation Plan: send_report 相对附件路径解析

**Branch**: `fix/079-report-file-cwd` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/079-report-file-cwd/spec.md`

**Status**: Approved

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Open Decisions

None.

## Clarifications

### Session 2026-11-27

- [P-001] Q: 工作目录读取放在哪一层？ -> A: 工具层传 `exec.agent.session`，service 统一解析。
- [P-002] Q: 是否删除 `AgentLike.session.cwd`？ -> A: 删除，只留 `header.cwd`。
- [P-003] Q: 错误文本是否附基准目录？ -> A: 附上。
- [P-004] Q: 回退告警怎么输出？ -> A: `logger.warn`。
- [P-005] Q: 是否做真实宿主验证？ -> A: 执行 real-device-test。
- [P-006] Q: 文档更新范围？ -> A: `docs/how-it-works.md` 与 CHANGELOG。

## Review Record

- 2026-11-27 | Decision: Approved | Scope: current full document | Open items: none | Risks: none

## Summary

`send_report` 的 `files` 相对路径按调用会话的当前工作目录解析。基准目录取自宿主 `workingDirectory` 服务的会话投影，依次回退到会话创建目录、任务记录的 cwd、进程当前目录；校验失败的错误带上解析后的绝对路径与基准目录。

## Technical Context

**Language/Version**: TypeScript 6 + Node.js（`engines.node` 约束），tsdown 构建，biome 检查，vitest 测试

**Primary Dependencies**: `@deepseek-ai/dsh-tools`、`@deepseek-ai/dsh-agent`、`zod`（宿主依赖统一为 `0.2.2-rc.5`）

**Storage**: 调度工作区文件（`message-task-status.json`、`reports/<taskId>/`）与 git 提交

**Testing**: `pnpm test:code`（vitest），`pnpm check` 与 CI 同组检查

**Target Platform**: DSH 宿主内的插件进程，Windows、macOS、Linux

**Project Type**: 宿主插件（单仓库，`src/` + `tests/`）

**Performance Goals**: 无额外要求；工作目录读取不触发文件系统访问

**Constraints**: 不新增 `@deepseek-ai/*` 依赖；宿主缺少 `workingDirectory` 服务时按回退链工作

**Scale/Scope**: 单个会话的一次上报调用

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | 通过 | 不新增 `@deepseek-ai/*` 依赖；沿用 `0.2.2-rc.5` |
| II. 测试同步 | 通过 | 同步更新 `tests/lark-super-agent-service.test.ts` 的会话夹具，并新增投影、回退与错误文本用例 |
| III. 文档结构 | 通过 | 机制写入归属文档 `docs/how-it-works.md`；README 无 `send_report` 段落，无需改动 |
| IV. 质量门禁 | 通过 | 交付前执行 `pnpm format && pnpm check` 与 `pnpm test:code` |
| V. 公开引用 | 通过 | 文档只引用仓库内路径与占位符路径 |

## Project Structure

### Documentation (this feature)

```text
specs/079-report-file-cwd/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/send-report-files.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/lark-super-agent/
├── api.ts              # CallerSessionLike 与会话工作目录契约
├── service.ts          # callerDirectory 解析链、manageSession 与 sendReport
├── reports.ts          # validateReportInput 的错误文本
└── managed/report-tool.ts  # 把 exec.agent.session 传给 service

tests/
├── lark-super-agent-service.test.ts  # 会话夹具与解析用例
└── lark-super-agent-reports.test.ts  # 错误文本用例
```

**Structure Decision**: 沿用现有单仓库插件结构，只改 `src/lark-super-agent/` 与会话相关测试，不新增目录层级。

## Complexity Tracking

无偏离项。
