# Implementation Plan: 发布到 npm 并配置 Trusted Publishing

**Branch**: `chore/018-npm-trusted-publish` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: 把 `dsh-plugin-lark-bridge@0.1.0` 发布到 npm，并让 CI 用 OIDC Trusted Publishing 发布后续版本。

## Summary

- `package.json` 补 `repository`、`homepage`、`bugs`：npm 在 OIDC 发布时校验 `repository.url` 与 OIDC 声明一致，缺失时返回 `E422`。
- 新增 `scripts/publish-guard.mjs`：查询 registry 是否已有当前版本；CI 据此跳过重复发布，让 `0.1.0` 的引导发布与 `v0.1.0` tag 共存。
- `.github/workflows/ci.yml` 的 `publish` job 接入该判断。
- 文档记录绑定参数、引导发布与 tag 发布步骤。
- 运维步骤：用户 `npm login --auth-type=web` → 手工发布 `0.1.0` → `npm trust github` 绑定 → 推送 `v0.1.0` tag 验证跳过。

## Technical Context

**Language**: Node.js 24（脚本与 CI 均为 ESM）

**Registry**: `https://registry.npmjs.org`，包名 unscoped，默认公开

**CI**: GitHub Actions，`ubuntu-latest`，Node 24，pnpm 11.7.0

**Trusted Publisher**: provider GitHub Actions，仓库 `FanetheDivine/dsh-plugin-lark-bridge`，workflow `.github/workflows/ci.yml`，环境留空，允许 publish

**凭据**: 首次发布用维护者 `npm login --auth-type=web` 的会话；CI 只用 `id-token: write`，不保存令牌

## Constitution Check

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不改动任何 `@deepseek-ai/*` 版本，`pnpm-workspace.yaml` 不变。 |
| II. 测试同步 | PASS | 新增 `tests/publish-guard.test.mjs` 与 `tests/package-metadata.test.ts`；package-pack 测试继续回归发布内容。 |
| III. 文档结构 | PASS | 安装命令与绑定步骤分别写入 README 与 `docs/development.md`；CHANGELOG 增条目。 |
| IV. 质量门禁 | PASS | 每个阶段结束运行 `pnpm format && pnpm check`。 |
| V. 公开引用 | PASS | 只引用公网 GitHub 与 npm 地址，不含本机路径。 |

## Design

### 发布判定

`scripts/publish-guard.mjs` 导出 `isVersionPublished(name, version, fetchImpl)`：

- 请求 `https://registry.npmjs.org/<encoded name>`，`Accept: application/vnd.npm.install-v1+json`。
- HTTP 404 → `false`；HTTP 200 → 看 `versions` 是否含目标版本。
- 网络异常与其它状态码抛错，让 job 失败，避免在无法确认时重复发布。

CLI 读取根目录 `package.json`，向 stdout 输出 `exists=true|false`；workflow 把输出追加到 `$GITHUB_OUTPUT`，发布步骤用 `if: steps.published.outputs.exists != 'true'` 守卫。

### 引导发布与 tag

| 步骤 | 执行者 | 结果 |
| --- | --- | --- |
| `npm publish`（0.1.0） | 维护者本机会话 | registry 出现包，尚未绑定信任 |
| `npm trust github ... --allow-publish` | 维护者本机会话 | 包绑定仓库与 workflow |
| `git push origin v0.1.0` | 维护者 | `publish` job 检测到 0.1.0 已存在，跳过 |

后续版本由 `pnpm run release` 推送 tag，`publish` job 发布并生成 provenance。

## Project Structure

```text
package.json                     # + repository / homepage / bugs
.github/workflows/ci.yml         # publish job 接入版本判断
scripts/publish-guard.mjs        # 新增：registry 版本查询
tests/publish-guard.test.mjs     # 新增：判定逻辑
tests/package-metadata.test.ts   # 新增：元数据与 origin 一致
docs/development.md              # CI 与发布步骤
README.md                        # npm 包链接
CHANGELOG.md                     # 条目
```

## Verification

1. `pnpm format && pnpm check` 通过。
2. `pnpm build` 通过，`package-pack` 测试仍只含发布所需文件。
3. `node scripts/publish-guard.mjs` 在包未发布时输出 `exists=false`，发布后输出 `exists=true`。
4. `npm view dsh-plugin-lark-bridge version` 返回 `0.1.0`。
5. `npm trust list dsh-plugin-lark-bridge` 返回 1 条绑定。
6. `v0.1.0` tag 的 `publish` job 成功且跳过发布。

## Complexity Tracking

无偏离。
