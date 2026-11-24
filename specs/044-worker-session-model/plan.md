# Implementation Plan: 工作会话模型配置

**Branch**: `feat/044-worker-session-model` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Status**: Waived

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [P-001] Q: 如何让 `dsh-plugin-meta-tools` 的 `session_create` 使用该模型？ -> A: 不改其配置与代码。调度子行用 `tools/execute` 包住 `session_create`，期间开启「调度创建中」标记；工作子行在 `agent/created`（`startup`）读取标记并 `agent.model.select`。创建发生在首条提示发送之前，首轮请求即用该模型。
- [P-002] Q: 显式参数如何优先？ -> A: `meta-tools` 在创建后用显式参数再次 `select`，覆盖本插件的选择；调度子行在显式 provider 与 model 同时存在时不开标记。
- [P-003] Q: 联动校验放在哪里？ -> A: 前端由官方 `ModelSelect` 保证 effort 属于所选模型；后端创建时调用 `llm.resolveCallConfig` 校验，失败回退宿主默认并记警告，与 `src/sessions.ts` 的主行做法一致。
- [P-004] Q: 配置字段放在哪里？ -> A: `lark-super-agent` 行的 `workerProvider`、`workerModel`、`workerEffort`，volatile 字符串，默认空。
- [P-005] Q: 前端怎样复用 `ModelDefaults`？ -> A: `ModelDefaults` 增加字段名参数，默认值保持 `sessionProvider` 等；配置页传入 `worker*`。
- [P-006] Q: 验证？ -> A: 单元测试与 `pnpm full-check`；不重启用户 GUI，不做实机验证，记为风险。

## Review Record

- 2026-11-24 | Decision: Waived | Scope: current full document | Open items: none | Risks: 见 [风险](#风险)

## Summary

`lark-super-agent` 行新增三个 volatile 字段。配置页复用官方 `ModelSelect` 编辑它们。宿主侧 `WorkerModelStore` 读取实时配置，调度子行在 `session_create` 执行期间标记，工作子行在新会话创建时选择模型。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`，React 18

**Primary Dependencies**: 宿主 `@deepseek-ai/*`；`dsh-plugin-meta-tools@0.1.7` 不改动

**Storage**: 宿主行配置，沿用 volatile 保存

**Testing**: vitest `code` 与 `dist`

**Constraints**: 宿主依赖保持 external；不改 `meta-tools`

## 设计

| 文件 | 变更 |
| --- | --- |
| `src/lark-super-agent/config.ts` | `Config` 增三个 volatile 字符串；`readWorkerModel(config)` 返回完整选择或 `undefined` |
| `src/lark-super-agent/worker-model.ts` | 新增 `WorkerModelStore`：`during(fn)` 标记调度创建中，`take(llm, logger, signal)` 在标记期内返回已校验的选择 |
| `src/lark-super-agent/index.ts`、`service.ts`、`api.ts` | 构造并暴露 `service.workerModel` |
| `src/sa-dispatch/index.ts` | `tools/execute` 包住 `session_create` |
| `src/sa-worker/index.ts` | `agent/created` 应用选择 |
| `src/client/model-defaults.ts` | 字段名参数化 |
| `src/client/presence-config.tsx`、`index.ts`、`locales.ts` | 配置页增加模型选择器、文案与注入 |

| `docs/how-it-works.md`、`README.md`、`CHANGELOG.md` | 说明新配置项 |

## 风险

- 标记期内并发创建的非调度 `SA-工作会话`（用户手动新建）会被选择该模型，窗口为一次 `session_create` 的执行时长。
- 未在真实宿主验证；`tools/execute` 与 `agent/created` 的作用域行为依据宿主类型声明与源码阅读。
