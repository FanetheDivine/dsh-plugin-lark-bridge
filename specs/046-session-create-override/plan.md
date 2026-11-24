# Implementation Plan: 覆写 session_create 套用工作会话模型

**Branch**: `feat/046-session-create-override` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Status**: Waived

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [P-001] Q: 如何覆写 meta-tools 的 `session_create`？ -> A: 预设补丁把 meta-tools 行的 `session_create` 设为 `false`，`sa-dispatch` 子行用 `tools.register` 注册自己的 `session_create`。依据：宿主工具表同一作用域内重名注册会抛错（`NamedEntries.insert`），作用域内后注册者不会遮蔽先注册者；`tools.restrict` 只作用于全局与祖先工具，对同作用域的 meta-tools 工具无效；meta-tools 每个工具有独立开关，关闭 `session_create` 不影响另外十项。
- [P-002] Q: 创建参数如何传入？ -> A: 宿主 `sessionController.create` 没有模型参数。meta-tools 的做法是创建后 `resolveAgent` 并 `agent.model.select`，覆写保持同一流程：模型选择先于首条提示发送，首轮请求即用该模型。
- [P-003] Q: 模型优先级与回退？ -> A: 显式 provider/model/effort（成对校验，失败报错，与 meta-tools 一致）> 配置的「工作会话模型」（校验失败、`llm` 缺失时回退宿主默认并 `warn`）> 宿主默认。
- [P-004] Q: 预设默认值？ -> A: meta-tools 靠 `session_preset: sa-worker` 配置，覆写后内置常量 `sa-worker`，经 `agentPresets.list()` 过滤；补丁删除该配置项。
- [P-005] Q: meta-tools 自身的默认模型配置？ -> A: 补丁从未设置，覆写后对该工具不再生效；记入已知风险。
- [P-006] Q: 配置读取？ -> A: `service.workerModel` 改为返回实时 `ModelSelection | undefined` 的函数，`worker-model.ts` 只保留 `readWorkerModel`。
- [P-007] Q: 旧 profile 保留 `session_create: true` 时？ -> A: 注册时捕获重名错误并记警告，不抛出；记入已知风险。
- [P-008] Q: 验证？ -> A: 单元测试与 `pnpm full-check`；实机在隔离 `DSH_HOME` 与 mock 模型下验证，不触碰用户的 GUI 与 `~/.dsh`。

## Review Record

- 2026-11-24 | Decision: Waived | Scope: current full document | Open items: none | Risks: 见 [风险](#风险)

## Summary

删除 044 的调用链标记与事件监听，改由 `sa-dispatch` 子行注册同名 `session_create`，并在预设补丁里关闭 meta-tools 的版本。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`

**Primary Dependencies**: 宿主 `@deepseek-ai/*`；`dsh-plugin-meta-tools@0.1.7` 不改代码，只改其行配置

**Testing**: vitest `code` 与 `dist`；实机测试

## 设计

| 文件 | 变更 |
| --- | --- |
| `src/sa-dispatch/session-create.ts` | 新增 `buildSessionCreateTool`，复刻 meta-tools 的 `session_create` 并加入工作会话模型 |
| `src/sa-dispatch/index.ts` | 删除 `tools/execute` 包装；`inject(['sessionController'])` 后注册工具，重名失败记警告 |
| `src/sa-worker/index.ts` | 删除 `agent/created` 监听 |
| `src/lark-super-agent/worker-model.ts` | 删除 `WorkerModelStore`、`AsyncLocalStorage` 与类型 `LlmLike`、`WarnLogger`，保留 `readWorkerModel` |
| `src/lark-super-agent/{api,service,index}.ts` | `workerModel` 改为读取函数 |
| `cordis.patch.yml` | meta-tools 行 `session_create: false`，删除 `session_preset` |
| `tests/`、`docs/`、`README.md`、`CHANGELOG.md` | 同步 |

## 风险

- 覆写复刻 meta-tools 0.1.7 的流程，meta-tools 升级后需对照。
- 预设内 meta-tools 行被改回 `session_create: true` 时重名，见 `docs/known-risks.md`。
