# Implementation Plan: 完全使用本机 lark-cli

**Branch**: `025-local-lark-cli` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/025-local-lark-cli/spec.md`

**Status**: Approved

**Note**: 本计划由 `/speckit-plan` 生成。

## Open Decisions

无。

## Clarifications

### Session 2026-11-20

- [P-D001] Q: Windows 如何执行 npm 全局安装的 `lark-cli.cmd`？ -> A: Windows 使用受约束的 shell 命令，通知正文改走 stdin，所有动态参数使用安全字符白名单；macOS/Linux 保持 `shell: false`。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: Windows 使用受约束 shell；不支持 `--text -` 的旧版 CLI 会返回通知命令错误。

## Summary

移除插件对 `@larksuite/cli` 的运行时依赖和全部包内解析、下载回退。宿主统一以普通 `lark-cli` 命令启动本机程序，移除插件专用路径与环境变量覆盖。旧 `larkCli` 配置仅为升级兼容而忽略。`cli-missing` 弹窗和配置页鉴权面板共用只读安装命令展示。现有鉴权、消息、会话和通知流程保持不变。

## Technical Context

**Language/Version**: TypeScript 6、Node.js 24.9、React 18

**Primary Dependencies**: 宿主提供的 `@deepseek-ai/*`、React；移除 `@larksuite/cli`

**Storage**: 现有 `$DSH_HOME/lark-bridge/state.json`，结构不变

**Testing**: Vitest 源码与产物项目、React SSR、`npm pack --dry-run`、真实 DSH 宿主验证

**Target Platform**: DSH 桌面宿主的 Windows、macOS、Linux 环境

**Project Type**: DSH Host 插件与浏览器配置界面

**Performance Goals**: 保持现有一次性命令与单个长驻事件消费者的调用模型，不增加轮询或常驻进程

**Constraints**: 只调用 `lark-cli`；无专用路径配置、`LARK_CLI` 覆盖或自定义目录搜索；不检查最低版本；Windows 仅执行白名单参数组成的受约束 shell 命令，通知正文使用 stdin；安装命令只展示给用户

**Scale/Scope**: 修改 CLI 适配、配置模型、插件装配、鉴权界面、依赖清单、测试与用户/开发文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 核对 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不新增或修改 `@deepseek-ai/*` 依赖；现有版本与 `minimumReleaseAgeExclude` 保持不变 |
| II. 测试同步 | PASS | 更新 CLI、配置、表单、前端和 package-pack 测试；在真实宿主验证消息链路 |
| III. 文档结构 | PASS | 用户前置与配置归入 README；机制、风险和文件地图归入对应 docs；CHANGELOG 在 push 或 merge 时维护 |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check` 与 `pnpm build` |
| V. 公开引用 | PASS | 跟踪文件只使用公网 URL 与仓库内相对路径 |

设计后复核：以上各项仍为 PASS。

## Project Structure

### Documentation (this feature)

```text
specs/025-local-lark-cli/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── tasks.md             # 由 /speckit-tasks 生成
```

本变更只涉及内部接口，不新增 `contracts/`。

### Source Code (repository root)

```text
src/
├── cli.ts                    # 本机命令调用与子进程管理
├── config.ts                 # 配置 schema 与旧键兼容
├── index.ts                  # 单例 CLI 装配与配置热重载
├── client/
│   ├── auth-overlay.tsx      # cli-missing 弹窗
│   ├── auth-panel.tsx        # 配置页鉴权面板
│   ├── cli-install-command.tsx
│   ├── config-form.ts        # 移除 larkCli 草稿字段
│   ├── config-page.tsx       # 移除路径输入
│   └── locales.ts            # 双语提示与安装命令
├── bridge.ts                 # 复用 CLI，行为不变
└── tools.ts                  # 复用 CLI，行为不变

tests/
├── cli.test.ts
├── plugin.test.ts
├── config-form.test.ts
├── client.test.ts
├── package-pack.test.ts
└── helpers.ts

package.json                  # 移除运行时依赖
pnpm-lock.yaml
pnpm-workspace.yaml           # 移除 CLI 构建许可
cordis.patch.yml              # 移除 larkCli 默认配置
README.md
docs/how-it-works.md
docs/known-risks.md
docs/development.md
```

**Structure Decision**: 沿用单包 DSH 插件结构。CLI 调用继续集中在 `src/cli.ts`，两个界面复用一个安装命令组件，数据模型见 [data-model.md](./data-model.md)。

## Implementation Design

### 1. 本机命令适配

- 删除包目录解析、入口脚本回退、`LARK_CLI` 和自定义 `PATH` 扫描。
- `LarkCli` 不再接收路径或 Node 入口参数，所有一次性调用和事件消费者使用同一命令配置。
- macOS/Linux 使用 `spawn('lark-cli', args, { shell: false })`。
- Windows 将固定命令与通过 `^[A-Za-z0-9._:+-]+$` 校验的参数组成单一命令字符串，再启用 shell；不把参数数组交给 shell，避免 Node 24 的拼接与弃用警告。
- 通知统一使用 `--text -`，正文通过已有 stdin 通道写入；正文不进入命令字符串。
- 动态参数不满足白名单时在启动前返回 `CliError('unsafe-arg')`。
- 同步 `spawn` 异常统一转换为 `CliError('spawn-failed')`，保持 `cli-missing` 判定准确。
- 保持参数数组抽象、超时、输出上限、退出码和进程树清理行为。

### 2. 配置与生命周期

- 从 `Config`、`PluginConfig`、默认值和合法键集中移除 `larkCli`。
- 把 `larkCli` 加入旧键集合，读取后丢弃。
- `apply` 只创建一个 `LarkCli`；配置热重载继续更新其他字段并重新检测。
- 从 `cordis.patch.yml`、前端表单和配置页删除路径字段。

### 3. 安装命令界面

- 在中英文字典加入相同命令文本和更新后的 `cli-missing` 提示。
- 新增共享只读命令组件，在 `stage === 'cli-missing'` 时渲染。
- 弹窗与配置页鉴权面板均使用该组件；其他鉴权阶段不显示安装命令。
- 保持现有重新检测、授权和关闭流程。

### 4. 依赖与发布

- 从 `package.json` 删除 `@larksuite/cli`，从 workspace 配置删除其构建许可，并刷新锁文件。
- 保持宿主依赖 external 和现有发布文件集合。
- package-pack 回归同时检查依赖声明与实际 tarball，防止 CLI 重新进入发布内容。

### 5. 文档

- README 说明本机安装、升级、终端一致调用和无专用路径配置。
- 工作机制文档更新 CLI 定位、配置热重载与依赖说明。
- 已知风险文档记录本机命令不可用时的诊断和 DSH 环境刷新要求。
- 开发文档更新文件地图与测试说明。

### 6. 验证与交付

- 按 [quickstart.md](./quickstart.md) 运行源码、产物、打包和真实宿主验证。
- 平台无关单元测试覆盖 Windows 命令构造、危险参数拒绝、同步启动异常与 stdin 正文；Windows 实机覆盖 `.cmd`、鉴权、事件长连接和通知。
- 使用真实宿主检查中英文界面、私聊注入与通知。
- 对可见界面变更执行一次 UI/UX 子代理审查。
- 每个任务阶段对应一个 commit。

## Complexity Tracking

无。
