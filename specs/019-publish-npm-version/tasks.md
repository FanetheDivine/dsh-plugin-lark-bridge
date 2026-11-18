# Tasks: 修复发布 job 的 npm 版本漂移

**Input**: [plan.md](./plan.md) | [spec.md](./spec.md)

## Phase 1: CI 与测试

- [x] T001 `.github/workflows/ci.yml` 删除 `npm install -g npm@latest`，新增 npm 版本检查步骤
- [x] T002 `tests/package-pack.test.ts` 支持数组与对象两种 `npm pack --json` 输出
- [x] T003 新增 npm 12 对象输出的解析用例，用假 stdout 直接测解析函数
- [x] T004 运行 `pnpm format && pnpm check && pnpm build`
- [x] T005 提交阶段一

## Phase 2: 文档

- [ ] T006 `docs/development.md` 发布节说明 npm 版本要求
- [ ] T007 `CHANGELOG.md` 记录修复
- [ ] T008 运行 `pnpm format && pnpm check`，提交阶段二

## Phase 3: 合并与 tag

- [ ] T009 推送分支、创建 PR、等待合并
- [ ] T010 合并后把 `v0.1.0` 更新到新的 `main` 并推送，确认 `publish` job 成功
