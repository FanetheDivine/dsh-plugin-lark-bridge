# Quickstart: send_report 相对附件路径解析

**Date**: 2026-11-27 | **Plan**: [plan.md](./plan.md)

## 前置

- Node.js 与 pnpm 可用，仓库根目录执行 `pnpm install`。
- DSH 宿主为 `0.2.2-rc.5`，已安装本插件的待测构建。

## 静态验证

```sh
pnpm install
pnpm format
pnpm check
pnpm test:code
```

预期：`check` 无报错，`test:code` 全部通过。

## 单元场景

| 场景 | 构造 | 预期 |
| --- | --- | --- |
| 投影生效 | 会话 `header.cwd` 为 A，`workingDirectory.get` 返回 B，B 下有 `specs/demo/spec.md` | 上报成功，存档目录出现副本 |
| 回退到创建目录 | 未提供 `workingDirectory` 服务，A 下有该文件 | 上报成功 |
| 回退到任务 cwd | 会话句柄缺失，任务记录 cwd 为 A，A 下有该文件 | 上报成功 |
| 全部缺失 | 三级都不可用 | 使用进程目录，`logger.warn` 被调用一次 |
| 错误文本 | 上报不存在的相对路径 | 错误含 `原始值 -> 绝对路径` 与 `(base <基准目录>)` |
| 绝对路径 | 直接给绝对路径 | 与相对路径结果一致 |

## 真实宿主验证

用 `real-device-test` skill：

1. 由调度会话建立一个被管理会话，工作目录切到 worktree。
2. 会话调用 `send_report`，`files` 只给相对路径。
3. 预期：工具成功，卡片显示附件；错误场景下错误文本包含解析后的绝对路径与基准目录。

## 已知边界

- 宿主未提供 `workingDirectory` 服务时只有创建目录可用，worktree 会话会退回创建目录。
- 附件仍限定 `.md`，非 Markdown 文件按无效项报错。
