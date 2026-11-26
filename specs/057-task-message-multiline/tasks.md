# Tasks: 修复多行任务消息导致 task_update 报 task not found

## Phase 1: 修复与测试

- [x] T001 放宽消息正文 schema，台账无效时 `updateTask` 与 `endTask` 报错，折叠会话标题换行
- [x] T002 增加 notes 与 service 回归测试
- [x] T003 更新 `docs/how-it-works.md`、`docs/known-risks.md`、`CHANGELOG.md`
- [x] T004 运行 `pnpm format && pnpm check`
