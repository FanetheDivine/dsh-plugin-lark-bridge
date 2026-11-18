# Implementation Plan: 修复发布 job 的 npm 版本漂移

**Branch**: `fix/019-publish-npm-version` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

## Summary

- `.github/workflows/ci.yml`：删除 `npm install -g npm@latest`，改为版本检查；publish job 使用 runner 自带 npm。
- `tests/package-pack.test.ts`：`npm pack --json` 的结果同时支持数组（npm 11）与对象（npm 12）。
- 文档与 CHANGELOG 记录要求。

## Technical Context

**npm 11.19.1**：随 Node 24 runner 提供，`npm pack --json` 返回数组。
**npm 12.2.3**：`npm pack --json` 返回以包名为键的对象。
**门槛**：trusted publishing 要求 npm >= 11.5.1。

## Constitution Check

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不涉及 `@deepseek-ai/*`。 |
| II. 测试同步 | PASS | 打包测试改为两种输出都覆盖，新增 npm 12 用例。 |
| III. 文档结构 | PASS | 发布要求写入 `docs/development.md`，CHANGELOG 增条目。 |
| IV. 质量门禁 | PASS | 结束运行 `pnpm format && pnpm check`。 |
| V. 公开引用 | PASS | 只引用公网 URL。 |

## Design

```text
publish job steps
  setup-node (npm 11.19.1)
  Check npm supports OIDC (>= 11.5.1)   # 打印版本，低于门槛退出 1
  install / build / guard / publish
```

`tests/package-pack.test.ts` 的解析：

- 数组 → 原样使用。
- 对象 → `Object.values` 取每个包的报告。
- 两者都用 `files[].path` 汇总路径。

## Verification

1. `pnpm format && pnpm check && pnpm build` 通过（本地 npm 11.19.1）。
2. `npx npm@12.2.3 pack --dry-run --json` 的输出能被解析（新增用例）。
3. 合并后更新 `v0.1.0` tag，CI 的 `publish` job 成功。

## Complexity Tracking

无偏离。
