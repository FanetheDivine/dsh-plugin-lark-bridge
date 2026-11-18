# Tasks: 使用 lark-cli 自带的 bot 身份

**Input**: [spec.md](./spec.md)、[plan.md](./plan.md)、[research.md](./research.md)、[data-model.md](./data-model.md)、[contracts/routes.md](./contracts/routes.md)

每个 Phase 对应一个 commit。

## Phase 1: 配置收敛（US3，FR-005、FR-007）

- [ ] T001 [US3] 在 `src/config.ts` 删除 `profile` 与 `ownerOpenId` 的 schema、`PluginConfig`、默认值与校验；在 `CONFIG_KEYS` 之外新增 `LEGACY_KEYS = ['profile','ownerOpenId']`，`resolveConfig` 接受并丢弃这两个键，其他未知键仍抛错
- [ ] T002 [US3] 在 `src/constants.ts` 删除 `DEFAULT_PROFILE`；在 `cordis.patch.yml` 删除 `profile` 与 `ownerOpenId` 及注释
- [ ] T003 [US3] 更新 `tests/plugin.test.ts`、`tests/helpers.ts`：删除旧字段断言，新增「旧键被容忍并丢弃、其他未知键仍被拒绝」用例
- [ ] T004 [US3] 运行 `pnpm format && pnpm check` 并提交

## Phase 2: 宿主端使用默认 bot 身份（US1、US2、US3，FR-001、FR-002、FR-004、FR-008）

- [ ] T005 [US1] 在 `src/auth.ts` 删除 `app-missing` 阶段、`profile list`、`findProfile`、`bindApp` 与快照的 `profile` 字段；`auth status`、`auth login` 命令去掉 `--profile`；`auth status` 抛错归为 `bot-unavailable` 并写入 `detail`；open_id 只取 `identities.user.openId`
- [ ] T006 [P] [US1] 在 `src/bridge.ts` 的 `event consume` 与 `src/tools.ts` 的 `im +messages-send` 去掉 `--profile`；owner 只来自 `auth.ownerOpenId`
- [ ] T007 [P] [US1] 在 `src/routes.ts` 删除 `/app` 路由与 `bindApp` 调用，`paths` 去掉 `app`；在 `src/index.ts` 清理 `profile` 日志与 `ownerOpenId` 配置回落
- [ ] T008 [US1] 更新 `tests/auth.test.ts`、`tests/bridge.test.ts`、`tests/tools.test.ts`、`tests/routes.test.ts`、`tests/sessions.test.ts`：命令断言不含 `--profile`；删除绑定与 `ownerOpenId` 用例；新增「`auth status` 失败得到 `bot-unavailable`」「`/app` 返回 not-found」用例
- [ ] T009 运行 `pnpm format && pnpm check` 并提交

## Phase 3: 浏览器端移除凭据入口并给出指引（US1、US2，FR-003、FR-006、FR-010）

- [ ] T010 [US1] 在 `src/client/api.ts` 删除 `bindApp`、`profile` 与 `app-missing`；在 `src/client/auth-panel.tsx` 删除 App ID、App Secret、绑定表单与档案行，新增只读 `appId` 行；`bot-unavailable` 显示 `lark-cli config init` 指引与重新检测
- [ ] T011 [P] [US1] 在 `src/client/auth-overlay.tsx` 删除档案行，`bot-unavailable` 提示同上
- [ ] T012 [P] [US3] 在 `src/client/config-form.ts` 与 `src/client/config-page.tsx` 删除 `profile`、`ownerOpenId` 字段
- [ ] T013 [P] [US2] 在 `src/client/locales.ts` 删除 `auth.stage.app-missing*`、`auth.appId`、`auth.appSecret*`、`auth.bind*`、`auth.profile`、`config.profile.*`、`config.ownerOpenId.*`；中英文更新 `auth.stage.bot-unavailable.hint`，新增 `auth.appIdLabel`
- [ ] T014 更新 `tests/client.test.ts`、`tests/config-form.test.ts`、`tests/client-bundle.test.ts`、`tests/metadata.test.ts`：删除旧字段与文案断言，新增 `bot-unavailable` 指引与无凭据输入的用例；检查中英文字典键一致
- [ ] T015 运行 `pnpm format && pnpm check` 并提交

## Phase 4: 文档与收尾

- [ ] T016 [P] 更新 `README.md`：前置改为「先用 lark-cli 配置好机器人」，删除绑定应用步骤与 `profile`、`ownerOpenId` 配置项
- [ ] T017 [P] 更新 `docs/how-it-works.md`：鉴权阶段表、删除「应用绑定」小节与 `/app` 路由、配置与命令示例去掉 `--profile`
- [ ] T018 [P] 更新 `docs/known-risks.md`：删除「独立档案」，新增「默认配置」风险（授权令牌范围、旧档案不清理）
- [ ] T019 更新 `CHANGELOG.md`（Unreleased：Changed、Removed、Fixed）与 `specs/017-lark-bot-bridge` 中被取代条款的指向说明
- [ ] T020 在 worktree 执行 `pnpm install`（如缺依赖）、`pnpm full-check`；按 `real-device-test` skill 做实机验证，对照 [quickstart.md](./quickstart.md)
- [ ] T021 运行 `pnpm format && pnpm check` 并提交

## Dependencies

- Phase 1 先行，后续阶段依赖新的 `PluginConfig`。
- Phase 2 先于 Phase 3：浏览器端的类型来自宿主端响应。
- Phase 4 最后。

## Parallel

- Phase 2：T006、T007 可并行。
- Phase 3：T011、T012、T013 可并行。
- Phase 4：T016、T017、T018 可并行。
