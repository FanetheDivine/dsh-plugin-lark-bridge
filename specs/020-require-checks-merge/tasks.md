# Tasks: main 合并门禁

**Input**: Design documents from `/specs/020-require-checks-merge/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, quickstart.md

每个阶段对应一个 commit；没有仓库文件改动的阶段只做远端配置与验证。

## Phase 1: 规则集上线

- [x] T001 按 quickstart 的 JSON 创建规则集 `main-merge-gate`
- [x] T002 读取 `rulesets` 与 `rules/branches/main`，核对 `deletion`、`non_fast_forward`、`required_status_checks`（strict、两个 context、`integration_id` 15368）

## Phase 2: 文档与 CI 触发（commit）

- [x] T003 `.github/workflows/ci.yml` 的 push 触发增加 `branches: ['**']`，保留 `tags: ['*']`
- [x] T004 `docs/development.md` 新增「合并门禁」小节：规则清单、查看命令、直推流程、临时关闭
- [x] T005 `CHANGELOG.md` 的 Unreleased 增加条目
- [x] T006 运行 `pnpm format && pnpm check`
- [ ] T007 提交本阶段改动，包含 spec 产物

## Phase 3: 真机验证

- [ ] T008 探测 PR 带失败 check，合并被拒（SC-001），完成后关闭 PR 并删分支
- [ ] T009 无 check 的提交直推 `main` 被拒（SC-003）
- [ ] T010 强推与删除 `main` 被拒（SC-004）
- [ ] T011 分支推送跑完 CI 的提交直推 `main` 成功（SC-006）；在临时仓库验证平台行为，避免向 `main` 推入探测提交
