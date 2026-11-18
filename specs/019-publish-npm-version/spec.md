# Feature Specification: 修复发布 job 的 npm 版本漂移

**Feature Branch**: `fix/019-publish-npm-version`

**Created**: 2026-11-18

**Status**: Draft

**Input**: 推送 `v0.1.0` tag 后 `publish` job 在 Build 步骤失败：`npm install -g npm@latest` 装入 npm 12.2.3，`npm pack --json` 改为返回以包名为键的对象，`tests/package-pack.test.ts` 只处理数组。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - tag 发布通过 (Priority: P1)

维护者推送版本 tag 后，`publish` job 在版本已存在时跳过发布并以成功结束。

**Why this priority**: tag 的红叉会掩盖真实的发布失败，下一次真实发布也无法区分。

**Independent Test**: 推送 `v0.1.0` tag，观察 `publish` job 的 Build 步骤通过并跳过发布。

**Acceptance Scenarios**:

1. **Given** `0.1.0` 已在 registry，**When** 推送 `v0.1.0` tag，**Then** `publish` job 成功结束且不发布。
2. **Given** 新版本尚未发布，**When** 推送 tag，**Then** `publish` job 用 runner 自带的 npm 完成 OIDC 发布。

### User Story 2 - npm 版本一致 (Priority: P2)

发布 job 与检查 job 使用同一个 npm 版本，本地与 CI 的打包结果一致。

**Why this priority**: 同一仓库的两个 job 跑出不同结果时，问题只能在 tag 上暴露。

**Independent Test**: 对比两个 job 日志中的 `npm --version`，两者相同。

**Acceptance Scenarios**:

1. **Given** runner 自带 npm 满足 OIDC 要求，**When** 运行 `publish` job，**Then** 输出 npm 版本并继续。
2. **Given** runner 自带 npm 低于 11.5.1，**When** 运行 `publish` job，**Then** job 立即失败并提示版本要求。

### User Story 3 - 打包测试兼容 npm 12 (Priority: P3)

开发者用 npm 12 运行 `pnpm build` 时，打包测试仍然通过。

**Why this priority**: npm 12 已是最新版，贡献者升级后本地门禁不能失败。

**Independent Test**: 用 npm 12 执行 `npm pack --dry-run --json`，测试读取到文件列表。

**Acceptance Scenarios**:

1. **Given** `npm pack --json` 返回数组，**When** 运行测试，**Then** 断言通过。
2. **Given** `npm pack --json` 返回以包名为键的对象，**When** 运行测试，**Then** 断言通过。

### Edge Cases

- `npm pack --json` 输出空对象时按无文件处理，测试失败并提示。
- runner 镜像升级 Node 后 npm 版本变化，版本检查步骤先报出版本号。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: `publish` job MUST 使用 runner 自带的 npm，不执行全局升级。
- **FR-002**: `publish` job MUST 在 npm 低于 11.5.1 时失败，并输出当前版本与要求。
- **FR-003**: `tests/package-pack.test.ts` MUST 同时解析数组与对象两种 `npm pack --json` 输出。
- **FR-004**: `docs/development.md` MUST 说明发布 job 对 npm 版本的要求。
- **FR-005**: CHANGELOG MUST 记录本次修复。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `v0.1.0` tag 的 `publish` job 以成功状态结束，且日志显示跳过发布。
- **SC-002**: `check` 与 `publish` job 日志中的 npm 版本相同。
- **SC-003**: `pnpm format && pnpm check && pnpm build` 在 npm 11 与 npm 12 下都通过。

## Assumptions

- Node 24 的 runner 镜像自带 npm 11.19.1，满足 OIDC 要求。
- tag `v0.1.0` 可以更新到修复后的 `main`，因为包内容与版本号不变。
