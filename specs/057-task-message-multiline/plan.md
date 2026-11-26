# Implementation Plan: 修复多行任务消息导致 task_update 报 task not found

**Branch**: `fix/057-task-message-multiline` | **Spec**: [spec.md](./spec.md) | **Status**: Waived

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 无

## Summary

1. `src/lark-super-agent/notes.ts`：消息正文 schema 改为非空多行文本；`updateTask` 与 `endTask` 在台账无效时抛出校验失败错误。
2. `src/lark-super-agent/service.ts`：`manageSession` 折叠标题中的换行。
3. 更新 `docs/how-it-works.md`、`docs/known-risks.md` 与 `CHANGELOG.md`。

## Constitution Check

- 测试同步：新增 notes 与 service 回归测试。PASS
- 文档结构：行为写入 `docs/`。PASS
- 质量门禁：执行 `pnpm check`。PASS
