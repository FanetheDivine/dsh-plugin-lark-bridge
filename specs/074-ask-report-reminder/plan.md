# Implementation Plan: 被管理会话提问直接返回上报指令 S

**Branch**: `feat/074-ask-report-reminder` | **Date**: 2026-11-27 | **Spec**: [spec.md](./spec.md)

**Status**: Draft

## Open Decisions

无。

## Clarifications

### Session 2026-11-27

依据用户最新要求，S 直接作为工具结果，插件不维护待上报问题。宿主契约与选型见 [research.md](./research.md)。

## Review Record

- 2026-11-27：按用户最新要求直接实施。当前计划仍为 Draft，未获正式批准或豁免。PR 暂缓。

## Summary

`ask_user_question` 在工具执行链内成功返回固定 S。任务模型自行组织并发送 `question` 报告；调度会话走常规状态更新。取消已在等待的历史请求时，保留一次性的 `agent/pre-step` 提醒。

## Technical Context

- TypeScript/ESM，宿主依赖 `@deepseek-ai/dsh-*` `0.2.2-rc.5`。
- 拦截复用 `tools/pre-execute`、`tools/execute` 与 `tools/post-execute`。取消旧等待继续使用工具信号与网关私有接口。
- 不改变上报存档和任务台账格式。测试使用 Vitest 与 `tests/helpers.ts` 的模拟上下文。

## Constitution Check

| 条款 | 检查 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | 满足 | 沿用锁定版本，不调整宿主依赖 |
| II. 测试同步 | 满足 | 守卫、宿主工具管线及轮次报告回归通过，构建含打包验证 |
| III. 文档结构 | 满足 | README、工作机制、风险、测试文件地图与 Unreleased 同步 |
| IV. 质量门禁 | 满足 | `pnpm check` 与 `pnpm build` 通过，见 [验证记录](./quickstart.md#验证记录) |
| V. 公开引用 | 满足 | 文档使用仓库内相对路径和宿主包名 |

## Complexity Tracking

- 用户要求：按澄清后的需求继续实现和验证，本次保留 spec 与 plan 的 Draft 状态；完整评审待后续确认，暂不开 PR。

## Phase 0: Research

见 [research.md](./research.md)。

## Phase 1: Design

- `managed/ask-guard.ts`：`tools/pre-execute` 保留已有的 `deny`/`cancel`，对被管理会话的可接管调用返回 `allow`，绕过交互审批。`tools/execute` 不执行工具体，合成成功值 `{ answers: [] }`。`tools/post-execute` 将宿主渲染后的内容设为一个 S 文本块。每次接管独立处理，不结束轮次。
- `managed/task-rules.ts`：`TASK_RULES_TEXT` 是固定提示，说明尚无用户回答，要求模型用 `send_report(kind=question)` 写清任务目的、当前进展、问题和选项。它不接收原调用参数。
- `managed/index.ts`：保留调度消息包装和已等待请求被取消后的 `agent/pre-step` 提醒。新的拦截调用不排队提醒。移除问题记录、补报接线与拦截状态更新；轮次报告、失败通知及普通 `send_report` 路径保持独立。
- `ReportOrigin`：保留 `ask_intercept` 以兼容历史记录，新调用不产生该来源。调度会话继续处理普通 `question` 并更新 `waiting_user`。

结果和报告边界见 [data-model.md](./data-model.md)。

## Phase 2: Tasks

见 [tasks.md](./tasks.md) 与 [验证步骤](./quickstart.md)。本阶段不发版、不开 PR。