# Implementation Plan: 修复 lark_notify 参数声明不是 JSON Schema

**Branch**: `fix/059-notify-tool-schema` | **Spec**: [spec.md](./spec.md) | **Status**: Waived

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 无

## Summary

1. `src/tools.ts`：用 zod 定义 `lark_notify` 参数，`z.toJSONSchema` 转成 JSON Schema 后填入 `parameters`，去掉 `$schema` 键。参数校验保持现有分支与错误码。
2. `tests/tools.test.ts`：断言 `parameters` 是含 `properties` 与 `required` 的 JSON Schema，并断言工具名是单下划线 `lark_notify`。
3. `docs/how-it-works.md` 与 `CHANGELOG.md`：补充参数声明来源。

## Constitution Check

- 测试同步：`tests/tools.test.ts` 覆盖声明结构。PASS
- 文档结构：行为写入 `docs/how-it-works.md`。PASS
- 质量门禁：执行 `pnpm check`。PASS

## Technical Context

- `ToolSchema.parameters` 是 `Record<string, unknown>`，宿主原样下发；现有实现手写扁平对象，模型看到空 schema。
- 现有 `lark_notify` 不走 `defineTool`，宿主不校验参数，执行体自行校验并返回结果。本次保留该形态，只修正声明。

## Changes

| 文件 | 变更 |
| --- | --- |
| `src/tools.ts` | zod schema + `z.toJSONSchema`，`parameters` 改为 JSON Schema |
| `tests/tools.test.ts` | 声明结构断言 |
| `docs/how-it-works.md` | 通知小节说明参数由 zod 生成 |
| `CHANGELOG.md` | Unreleased 增加条目 |

## Verification

1. `pnpm test:code -- tests/tools.test.ts`。
2. `pnpm check`。
3. 真实宿主：桥接会话发一步，核对请求头 `lark_notify.parameters.properties` 含 `text`、`reply_to`。
