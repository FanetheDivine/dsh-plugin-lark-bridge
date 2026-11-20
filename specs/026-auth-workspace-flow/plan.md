# Implementation Plan: 独立鉴权与工作区选择流程

**Branch**: `026-auth-workspace-flow` | **Date**: 2026-11-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/026-auth-workspace-flow/spec.md`

**Status**: Approved

**Note**: 本计划由 `/speckit-plan` 生成。

## Open Decisions

无。

## Clarifications

### Session 2026-11-20

- [P-D002] Exploration: 保留 `workspaceRoot` 路径配置，插件内部统一使用 Linux 风格 `/d/Git`。前端保存归一化选项路径，Host 在注册表与会话边界转换回原生路径，避免引入工作区 id 配置迁移。
- [P-D003] Exploration: `plugins.row.config` 与 `shell.overlay` 都通过全局标准 props 接收 `useWorkspaces`；直接引入 `@deepseek-ai/dsh-client-ui-workspace` 类型与 Client inject 声明，版本跟随现有宿主。
- [P-D004] Exploration: `lark-cli auth status --json --verify` 一次返回两种身份，三个检测按钮共用同一个并发复用的完整检查；状态展示保持独立。
- [P-D005] Exploration: 固定标题与必检测删除两个运行时配置字段；旧 `sessionTitle` 与 `authCheckOnStartup` 按既有旧键规则接受并忽略。
- [P-D006] Exploration: 删除授权与会话重置交互后，对应 Host 方法、浏览器 API 和路由一并删除，避免保留无界面的设备码授权入口。
- [P-D007] Exploration: WorkspaceRegistry 没有专用 Host 生命周期事件；使用 `domain/changed` 监听注册删除，并在目标删除回调里同步停止事件桥。新增同版本 `dsh-storage-domain` 纯类型依赖。
- [P-D001] Q: 共用弹窗中的工作区选择如何提交？ -> A: 选择后点击「保存选择」，保存成功后关闭弹窗；保存失败保留选择，配置页继续使用表单保存按钮。
- [P-D008] Q: 所有工作区路径采用什么统一形式？ -> A: 统一归一化为 Linux 风格，例如 `D:\Git` 与 `D:/Git` 都转为 `/d/Git`；配置、前端选项和状态文件使用该形式，Host API 边界转回原生路径。

## Review Record

- 2026-11-20 | Decision: Draft | Scope: current full document | Open items: none | Risks: 完整计划待审查；`--verify` 依赖网络；`domain/changed` 需要与宿主版本对齐；工作区无效期间不补投历史消息。
- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: `--verify` 依赖网络；`domain/changed` 需要与宿主版本对齐；工作区无效期间不补投历史消息。
- 2026-11-20 | Decision: Draft | Scope: current full document with P-D008 path normalization | Open items: none | Risks: 完整计划待复审；Linux 风格路径必须在 Host API 边界正确转换；`--verify` 依赖网络；`domain/changed` 需要与宿主版本对齐；工作区无效期间不补投历史消息。
- 2026-11-20 | Decision: Approved | Scope: current full document with P-D008 path normalization | Open items: none | Risks: Linux 风格路径必须在 Host API 边界正确转换；`--verify` 依赖网络；`domain/changed` 需要与宿主版本对齐；工作区无效期间不补投历史消息。

## Summary

把鉴权状态从串行四阶段改为 CLI、bot、user 三个独立连接状态。插件启动与 GUI 打开时执行带 `--verify` 的完整检测，三个界面区域共享同一检查动作。浏览器状态接口只暴露笼统状态，终端命令由用户在插件外执行。

配置仅保留 `workspaceRoot`。配置页与共用设置弹窗通过同一表单模型选择当前注册工作区，后端按注册表校验并控制事件监听。会话标题固定为「来自用户的飞书消息」，会话复用依赖现有归档与恢复规则。

## Technical Context

**Language/Version**: TypeScript 6、Node.js 24.9、React 18

**Primary Dependencies**: 宿主 `@deepseek-ai/*` 0.2.2-rc.3、React；新增显式纯类型依赖 `@deepseek-ai/dsh-client-ui-workspace@0.2.2-rc.3` 与 `@deepseek-ai/dsh-storage-domain@0.2.2-rc.3`

**Storage**: 现有 profile 配置与 `$DSH_HOME/lark-bridge/state.json`，状态文件结构不变

**Testing**: Vitest 源码与产物项目、React SSR、Playwright 真实 GUI、真实 DSH 0.2.2-rc.3 profile

**Target Platform**: DSH Web GUI 的 Windows、macOS、Linux 环境

**Project Type**: DSH Host 插件与浏览器配置界面

**Performance Goals**: 保持单个长驻事件消费者；完整 CLI 检测只在启动、GUI 打开和手动点击时执行；状态轮询只读缓存，工作区列表使用宿主推送

**Constraints**: 不展示鉴权 URL、原始错误或身份元数据；不在插件内执行安装、初始化或登录；不接收任意工作区路径；不在注入时创建工作区注册；固定标题；兼容旧配置键

**Scale/Scope**: 修改鉴权、路由、事件桥、会话、配置模型、共用弹窗、配置页、双语文案、依赖声明、测试与文档

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结果 | 核对 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 新增 `dsh-client-ui-workspace` 与 `dsh-storage-domain` 时锁定 `0.2.2-rc.3`，同步 `minimumReleaseAgeExclude` 与锁文件；其余宿主依赖不变 |
| II. 测试同步 | PASS | 更新鉴权、路由、桥接、会话、配置、表单与客户端测试；真实宿主覆盖状态组合、工作区删除与私聊注入；发布包回归保持 |
| III. 文档结构 | PASS | 用户流程归入 README；机制、风险和文件地图归入对应 docs；CHANGELOG 在 push 或 merge 时维护 |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check`、`pnpm build` 与真实宿主验证 |
| V. 公开引用 | PASS | 跟踪文件只使用公网 URL、仓库内相对路径与占位符路径 |

设计后复核：五项均为 PASS。新增依赖已纳入原则 I 检查，路径转换、接口与竞态测试满足原则 II，文档与质量门禁范围不变。

## Project Structure

### Documentation (this feature)

```text
specs/026-auth-workspace-flow/
├── plan.md
├── research.md
├── data-model.md
├── contracts/
│   └── routes.md
├── quickstart.md
└── tasks.md             # 由 /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── auth.ts                    # 独立连接状态与完整检测
├── bridge.ts                  # 鉴权和工作区共同控制监听
├── config.ts                  # 仅保留 workspaceRoot
├── constants.ts               # 固定会话标题
├── index.ts                   # 必检测与生命周期装配
├── routes.ts                  # status/check 与安全状态投影
├── sessions.ts                # 注册校验、固定标题与归档恢复
├── workspace.ts               # 当前注册选择与变更同步
├── workspace-path.ts          # Linux 风格归一化、比较与 Host 路径转换
└── client/
    ├── api.ts                 # 安全状态类型与两条路由
    ├── auth-overlay.tsx       # 共用设置弹窗
    ├── auth-panel.tsx         # 三个连接状态与检测按钮
    ├── config-form.ts         # 单工作区字段的共享草稿
    ├── config-page.tsx        # 注册工作区 select
    ├── index.ts               # 共享表单与状态控制器
    ├── locales.ts             # 双语状态、命令与工作区文案
    ├── status-controller.ts   # 共享检测、状态订阅与轮询清理
    └── terminal-command.tsx   # 只读终端命令

tests/
├── auth.test.ts
├── bridge.test.ts
├── client.test.ts
├── config-form.test.ts
├── helpers.ts
├── plugin.test.ts
├── routes.test.ts
├── sessions.test.ts
├── workspace.test.ts
└── workspace-path.test.ts

cordis.patch.yml
package.json
pnpm-lock.yaml
pnpm-workspace.yaml
README.md
docs/how-it-works.md
docs/known-risks.md
docs/development.md
```

**Structure Decision**: 沿用单包 DSH 插件。Host 工作区同步集中在 `src/workspace.ts`，浏览器共用同一配置表单和状态控制器。数据与接口见 [data-model.md](./data-model.md) 和 [contracts/routes.md](./contracts/routes.md)。

## Implementation Design

### 1. 独立鉴权状态

- `AuthSnapshot` 使用 `checking | connected | disconnected` 分别表示 CLI、bot、user；内部保留消息注入所需的用户 open_id 与日志诊断。
- 初始状态为 `checking`。CLI 启动失败时三项均为未连接；`auth status` 失败时 bot 与 user 均为未连接，详细原因只写后端日志。
- user 是否连接按现有 open_id 规则判定；bot 与 user 分别取值，整体 `ready` 要求三项连接且 owner open_id 可用。
- `AuthManager.check()` 固定执行 `--verify`，并发调用共享同一 Promise。启动、GUI 打开和三个检测按钮均调用该方法。
- 删除 `LoginFlow`、`startLogin`、`cancelLogin`、后台设备码轮询和相关清理。

### 2. 安全路由与浏览器状态

- 仅注册 `GET /lark-bridge/status` 与 `POST /lark-bridge/check`，沿用回环、Origin 与宿主连接校验。
- `GET` 返回最近一次快照；`POST` 执行完整检测。两者使用同一份仅含笼统状态的投影。
- 响应不包含鉴权 URL、原始错误、App ID、用户名、open_id、token、scope 或会话错误。
- 删除 `/auth/start`、`/auth/cancel`、`/session/reset` 及对应客户端方法。

### 3. 注册工作区同步

- 保留 `workspaceRoot`，`src/workspace-path.ts` 将反斜杠统一为 `/`，将 Windows 盘符路径转为小写盘符的 `/d/Git` 形式；POSIX 绝对路径保持原义。
- 前端 select 的值和路径标签使用归一化路径，显示标题与路径以区分同名工作区；配置读取与表单格式化也归一化旧值。
- Windows 上调用 `resolveByPath`、创建会话或访问目录前，将 `/d/Git` 转回 `D:/Git`；macOS 与 Linux 不做盘符转换。
- Host `WorkspaceSelection` 使用 `resolveByPath` 校验配置，保存当前有效工作区，不调用 `create`。
- 配置热重载、鉴权变化与目标工作区删除共用 `reconcile()`；鉴权失效、配置变化和注册删除先同步停止旧监听。
- 使用 `domain/changed` 筛选 workspace 表的 deleted 事件；目标 id 命中当前缓存时立即失效，无关删除不影响监听。
- 每次异步解析递增 generation，只有最新结果可在鉴权就绪且配置仍匹配时启动事件桥。
- 配置保存后立即 reconcile，无需等待同时触发的完整鉴权检测结束。
- 注入前再次校验注册关系，防止状态变更与消息处理之间的竞争。
- 无有效选择时不消费事件，不增加历史消息补投队列。

### 4. 共用设置界面

- 新增直接 `dsh-client-ui-workspace` 依赖声明，使 `useWorkspaces` 的类型与运行时提供方明确。
- 客户端只创建一个 `PluginConfigForm` 与一个状态控制器，同时注入配置页和 `shell.overlay`；工作区列表通过全局标准 props 读取。
- 状态控制器在 Client 加载时执行一次完整检测，之后定时读取缓存状态；手动检测共享忙碌状态，卸载时清理订阅与计时器。
- 配置页仅保留连接状态与工作区 select。没有注册项时显示空状态并禁用选择。
- 共用弹窗在任一连接未就绪或工作区无效时出现；三个状态区复用同一连接面板，工作区使用同一 select。
- 弹窗关闭记录当前失效签名，避免每次状态轮询重复打开；出现新的失效或下次 GUI 加载时再次提示。
- 弹窗中的 select 只更新草稿；「保存选择」调用共享表单的 `save`，通过 `saving/dirty/failed` 观察结果，成功后关闭，失败保留选择。
- 原生 `select` 使用宿主主题变量。命令以只读 `<code>` 展示，不提供授权链接或原始错误区域。

### 5. 配置与会话

- `Config` 与 `PluginConfig` 只包含 `workspaceRoot`；配置值与状态文件中的路径统一保存 Linux 风格形式，旧 `sessionTitle`、`authCheckOnStartup` 加入旧键集合。
- `cordis.patch.yml` 只声明空工作区。插件加载与 volatile 更新始终触发完整检测。
- 会话创建和复用统一使用固定标题「来自用户的飞书消息」；已有会话通过现有 `syncMeta` 追加标题事件。
- `SessionManager` 只使用已注册工作区，不再自动补注册；删除 `reset` 与状态存储的公开重置方法。
- 归档恢复、置顶、去重、私聊过滤和 `lark_notify` 保持现有行为。

### 6. 测试与文档

- 鉴权测试覆盖三种 CLI 状态、bot/user 四种组合、命令失败、`--verify` 与并发去重。
- 路由测试覆盖安全响应字段和已删除路由；桥接与工作区测试覆盖配置变化、注册删除和注入竞争。
- 表单与客户端测试覆盖单字段保存、当前选项、空列表、共用弹窗、失效重开、命令和无敏感信息。
- 真实 profile 检查 CLI 缺失、身份独立状态、终端登录后的检测、工作区选择/删除、固定标题、私聊注入与中英文界面。
- 按宿主指引用真实运行界面做一次 UI/UX 子代理审查。
- 更新 README、工作机制、已知风险、开发文件地图和验证记录；每个任务阶段对应一个 commit。

## Complexity Tracking

无。