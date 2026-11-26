# Tasks: 修复 lark_notify 参数声明不是 JSON Schema

## Phase 1: 声明修正与测试

- [ ] T001 `src/tools.ts`：用 zod 定义 `text`、`reply_to`，转成 JSON Schema 填入 `parameters`
- [ ] T002 `tests/tools.test.ts`：断言 `parameters.type`、`properties`、`required` 与工具名
- [ ] T003 更新 `docs/how-it-works.md` 与 `CHANGELOG.md`
- [ ] T004 运行 `pnpm format && pnpm check`
