# Quickstart: 调度会话模型信息查询工具

**Feature**: `specs/056-dispatch-model-info/` | **Date**: 2026-11-26

## 前置条件

- Node.js 与 pnpm 可用。
- 依赖已安装：`pnpm install`。

## 验证命令

```sh
pnpm format
pnpm check
```

`pnpm check` 含 lint、类型检查与 `tests/` 单元测试，与 CI 一致。

## 验证场景

1. **工具注册**：`pnpm test:code` 中 `tests/list-models.test.ts` 断言 `list_models` 注册、命名正确、参数表为空。
2. **正常枚举**：模拟 llm 返回两个 provider，断言输出包含全部 provider、model 与 effort id，顺序与宿主一致。
3. **provider 级跳过**：模拟某 provider `listModels` 抛错，断言其余 provider 照常返回且 `skipped` 含 `{ provider, error }`。
4. **model 级跳过**：模拟某路由 `resolveModelInfo` 抛错，断言该 model 不在结果中且 `skipped` 含 `{ provider, model, error }`。
5. **llm 未挂载**：`llm` 为 undefined 时调用工具，断言抛出可读错误而非空结果。
6. **空目录**：无已注册 provider 时返回 `{ providers: [], skipped: [] }`。

## 端到端确认（实机，建议）

1. 在真实 DSH 宿主装载本分支插件。
2. 在 `SA-调度会话` 预设的会话中要求列出可用模型，确认调度会话调用 `list_models` 并转述结果。
3. 让调度会话用结果中的 provider/model/effort 通过 `session_create` 开任务会话，确认模型生效。
