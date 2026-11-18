# Tasks: 发布到 npm 并配置 Trusted Publishing

**Input**: [plan.md](./plan.md) | [spec.md](./spec.md)

**Tests**: 每个代码阶段包含对应测试，门禁为 `pnpm check`。

**Organization**: 阶段对应提交；运维阶段不产生代码提交。

## Phase 1: 包元数据与发布判定

- [x] T001 `package.json` 增加 `repository`（`git+https://github.com/FanetheDivine/dsh-plugin-lark-bridge.git`）、`homepage`、`bugs`
- [x] T002 [P] 新增 `scripts/publish-guard.mjs`：导出 `isVersionPublished(name, version, fetchImpl)`，CLI 输出 `exists=true|false`
- [x] T003 [P] 新增 `tests/publish-guard.test.mjs`：版本存在、包不存在、版本缺失、网络错误、请求参数
- [x] T004 新增 `tests/package-metadata.test.ts`：`repository.url` 归一化后等于 `git remote get-url origin`，`homepage`、`bugs` 由仓库地址派生
- [x] T005 运行 `pnpm format && pnpm check`，提交阶段一

## Phase 2: CI 守卫与文档

- [x] T006 `.github/workflows/ci.yml`：`publish` job 增加 `publish-guard` 步骤，发布步骤用 `exists` 输出守卫
- [x] T007 `docs/development.md`：更新 CI 表，写绑定参数、引导发布与 tag 步骤
- [x] T008 `README.md`：安装节补 npm 包链接
- [x] T009 `CHANGELOG.md`：记录本次变更
- [x] T010 运行 `pnpm format && pnpm check && pnpm build`，提交阶段二

## Phase 3: 发布与绑定

- [x] T011 用户执行 `npm login --auth-type=web`，`npm whoami` 确认账号
- [x] T012 在主工作区检出该分支，`pnpm build` 后执行 `npm publish` 发布 `0.1.0`
- [x] T013 `npm trust github dsh-plugin-lark-bridge --repo FanetheDivine/dsh-plugin-lark-bridge --file ci.yml --allow-publish -y`，必要时提供 OTP
- [x] T014 `npm trust list dsh-plugin-lark-bridge` 核对 1 条 GitHub Actions 绑定
- [ ] T015 合并分支后在 `main` 打 `v0.1.0` tag 并推送，确认 `publish` job 跳过发布且成功
- [x] T016 `npm view dsh-plugin-lark-bridge version` 返回 `0.1.0`

## Dependencies

- T002 先于 T003、T006；T001 先于 T004。
- T012 依赖 T011；T013 依赖 T012（npm 要求包已存在）。
- T015 依赖 T013 与分支合并。

## Parallel Example

Phase 1 中 T002 与 T003 可并行；T001 与 T004 串行。
