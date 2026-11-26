# Quickstart: 调度会话更名与任务类型模型配置

## 自动化验证

```sh
pnpm format && pnpm full-check
```

预期结果：

1. `typecheck`、`lint`、`test:code`、`build` 与 `test:dist` 全部通过。
2. `rows/lark-super-agent/locale/zh.json` 标题为「调度会话」，描述为「用调度会话统一管理其他任务会话」。
3. `tests/task-model.test.ts` 覆盖普通任务模型、复杂任务模型与默认任务类型的读取。
4. `tests/session-create.test.ts` 覆盖 `task_type` 为空、`'common'`、`'complex'`、非法值及显式 `provider`/`model`/`effort` 覆盖的优先级。
5. `tests/presence-client.test.ts` 与 `tests/model-defaults.test.ts` 覆盖双模型选择器与默认任务类型切换。
