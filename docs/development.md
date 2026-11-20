# 开发

## 本地加载

1. 运行 `pnpm dev`，tsdown 监听 `src/` 并重建 `dist/index.mjs` 与 `dist/client.js`。
2. 在 profile 的 `cordis.patch.yml` 中加入：

```yaml
- insert:
    - id: dsh-plugin-lark-bridge-dev
      name: file:///<repo>/dist/index.mjs
```

前端部分不需要额外的插件行。宿主读到包的 `dsh.client` 声明后加载 `dist/client.js`。改动前端代码后重建并刷新页面。

## 热更新

在同一文件启用 `hmr` 并监听 `dist`：

```yaml
- id: hmr
  disabled: false
  config:
    root: ["<repo>/dist"]
    ignored: ["**/node_modules"]
```

- 修改补丁后无需重启 DSH，运行中的 profile 会重新应用补丁。
- 插件行指向新路径时同时修改 `id`，确保宿主加载新路径的模块。
- 仓库路径含 `.dsh` 等点目录时，去掉默认的 `**/.*` 忽略规则。

## 前端构建

`tsdown.config.ts` 有两组构建：

| 构建组 | 入口 | 产物 |
| --- | --- | --- |
| 宿主 | `src/index.ts` | `dist/index.mjs` |
| 浏览器 | `src/client/index.ts` | `dist/client.js` |

- 浏览器组用 banner/footer/intro 包成 `window.__ModuleLoader__.load({ id, factory })` 闭包工厂。
- `PLATFORM_MODULES` 列出宿主冻结模块表提供的模块，构建时保持 external。
- 新增或升级宿主客户端依赖时，核对平台种子表与宿主版本。
- 类型声明由 `tsc -p tsconfig.build.json` 生成到 `dist/client/`。

## 环境要求

- Node.js 24.9 及以上，与 DSH 的运行要求一致；CI 使用 Node 24。
- pnpm 11。

## 命令

| 命令 | 作用 |
| --- | --- |
| `pnpm dev` | 监听并构建 |
| `pnpm build` | 打包、生成类型声明并运行 `test:dist` |
| `pnpm check` | 依次运行类型检查、lint 和 `test:code` |
| `pnpm typecheck` | 类型检查 |
| `pnpm lint` | biome 检查 |
| `pnpm lint:fix` | biome 检查并自动修复 |
| `pnpm format` | biome 格式化 |
| `pnpm test:code` | 只运行源码测试 |
| `pnpm test:dist` | 只运行产物测试，要求 `dist` 新鲜 |
| `pnpm run release` | 检查并发布新版本 |

代码质量门禁是 `pnpm check`；`test:code` 与 `test:dist` 用于局部验证。

## 发布

npm 包为 `dsh-plugin-lark-bridge`，之后由 CI 用 Trusted Publishing 发布。

首次发布由维护者手工完成，因为 npm 要求包已存在才能绑定 Trusted Publisher。

| 步骤 | 命令 | 说明 |
| --- | --- | --- |
| 登录 | `npm login --auth-type=web` | 浏览器授权，凭据写入 `~/.npmrc` |
| 引导发布 | `pnpm build && npm publish` | 只有 `0.1.0` 需要 |
| 绑定 | `npm trust github dsh-plugin-lark-bridge --repo FanetheDivine/dsh-plugin-lark-bridge --file ci.yml --allow-publish -y` | 需要 2FA 口令 |
| 核对 | `npm trust list dsh-plugin-lark-bridge` | 只有 1 条 GitHub Actions 绑定 |
| 后续发布 | `pnpm run release` | 递增版本、归档 CHANGELOG、推送 commit 与 tag |

绑定参数必须与 workflow 一致：

| 字段 | 值 |
| --- | --- |
| Provider | GitHub Actions |
| Repository | `FanetheDivine/dsh-plugin-lark-bridge` |
| Workflow | `.github/workflows/ci.yml` |
| Environment | 空 |
| 允许的动作 | publish |

- `scripts/publish-guard.mjs` 查询 registry；目标版本已存在时 `publish` job 跳过发布。
- `publish` job 使用 runner 自带的 npm；npm 低于 11.5.1 时该 job 直接失败。
- 引导发布不带 provenance，从 CI 发布的版本开始生成。

## CI

`.github/workflows/ci.yml` 有两个 job：

| Job | 触发 | 内容 |
| --- | --- | --- |
| `check` | PR、打 tag | Node 24 上运行 `pnpm run full-check` |
| `publish` | 打 tag | 用 OIDC 发布新版本；版本已存在时跳过 |

- `full-check` 依次运行 `check` 与 `build`：`check` 不读取 `dist`，产物测试在 `build` 末尾执行。
- `pnpm run release` 推送 tag 后触发 `publish`。

## 测试

| 文件 | 覆盖内容 |
| --- | --- |
| `tests/plugin.test.ts` | 配置校验、热重载、工具与路由接线 |
| `tests/cli.test.ts` | 本机命令调用、JSON 解包、stdin 与退出码 |
| `tests/cli-process.test.ts` | Unix/Windows 进程参数、安全 token 与同步启动异常 |
| `tests/auth.test.ts` | 四阶段检测、应用绑定、设备码授权与取消 |
| `tests/bridge.test.ts` | 事件过滤、去重、提醒格式化与注入 |
| `tests/sessions.test.ts` | 工作区校验、创建/复用、标题、置顶与持久化 |
| `tests/tools.test.ts` | 参数校验、分段发送与失败返回 |
| `tests/routes.test.ts` | 同源校验、状态投影与动作路由 |
| `tests/state.test.ts` | 状态读写、去重窗口与损坏恢复 |
| `tests/config-form.test.ts` | 配置页草稿与字段集、校验、保存、恢复默认、放弃与卸载 |
| `tests/release-archive.test.mjs` | CHANGELOG 归档计划 |
| `tests/client.test.ts` | 前端服务声明、字典与槽位注册、弹窗与配置页渲染、CLI 缺失安装命令 |
| `tests/client-bundle.test.ts` | `dist/client.js` 的注册契约与导出（产物测试） |
| `tests/package-pack.test.ts` | npm 包不含 lark-cli，含发布所需文件与前端闭包工厂（产物测试） |
| `tests/metadata.test.ts` | 插件元数据的结构、键集、禁用字符与清单声明 |
| `tests/dependency-versions.test.ts` | `dsh-*` 依赖版本一致，并以同版本列入 `minimumReleaseAgeExclude` |
| `tests/dist-freshness.test.ts` | 产物新鲜度判定的三种状态 |
| `tests/worktree-extension.test.ts` | worktree 扩展的占号、改号、复用、编号校验与清理 |
| `tests/sync-main.test.ts` | 主工作区 `main` 快进到 `origin/main`，不满足约束时保持原样 |
| `tests/helpers.ts` | 模拟宿主与客户端 `ctx`，记录注册、事件监听与日志 |
| `tests/support/primitives.ts` | 把平台组件包解析到源码，避开已发布产物内联的依赖 |

测试要求见[宪章](../.specify/memory/constitution.md)原则 II。文案与元数据的规范见 [i18n.md](./i18n.md)。

vitest 拆成 `code` 与 `dist` 两个 project。产物测试读取 `dist`，由 `build` 末尾的 `test:dist` 执行；`test:code` 不读取 `dist`。产物缺失或早于构建输入时，产物测试失败并提示运行 `pnpm build`。

纯文档流程变更不新增测试文件时，仍须运行质量门禁。专项验收步骤记录在对应 spec 的 `quickstart.md`。

浏览器用例由仓库内的 `playwright` 驱动无头 Chrome。`vitest.config.ts` 把 `@deepseek-ai/dsh-client-ui-primitives` 指向包的源码：已发布的 `lib` 内联了 shiki、katex 等未声明的依赖，源码只依赖 react、clsx 与 `dsh-client-store`。

## Spec Kit 流程

DSH 从 `.dsh/skills/` 加载 `speckit-*` skill，在对话框输入 `/` 调用。

- 执行条件见 [AGENTS.md](../AGENTS.md#开发流程) 的开发流程节。
- 分支与 worktree 规则见 `/speckit-worktree-create`。

| 步骤 | 命令 | 产出 |
| --- | --- | --- |
| 1 | `/speckit-specify <需求描述>` | 主工作区 `main` 同步到 `origin/main`，占号分支、worktree、规格草稿与待确认决策 |
| 2 | `/speckit-clarify` | 探索结果、分批访谈记录、更新后的 spec，以及完整规格的 `Approved` 或 `Waived` 审查记录 |
| 3 | `/speckit-plan` | `plan.md` 与设计产物、实现细节访谈记录，以及完整计划的 `Approved` 或 `Waived` 审查记录 |
| 4 | `/speckit-tasks` | 通过规格与计划门禁后生成的 `tasks.md` |
| 5 | `/speckit-analyze` | 跨产物一致性报告 |
| 6 | `/speckit-implement` | 复核门禁并按阶段提交的实现；新未决项返回对应访谈 |
| 7 | `/speckit-worktree-finish` | 基线同步、编号校验、PR、无上限等待合并与合并后的清理，或以 `abandon` 放弃；清理后主工作区 `main` 同步到 `origin/main` |

- `base_ref` 默认为 `origin/main`，必须已包含 `.specify/` 与 `.dsh/skills/`。
- 创建 spec 时，`create-worktree.sh` 先同步远程全部分支，再推送 `<type>/<NNN>-<name>` 占号，最后创建 worktree。
- 同号分支按完整分支名排序，保留第一个，其余自动改号；占号失败时中止，不留下分支与 worktree。
- `/speckit-worktree-finish` 在推送与 PR 前运行 `check-spec-number.sh`，发现同号时停止。
- `worktrees/` 已加入 `.gitignore`，biome 与 vitest 也会跳过它。

## 维护 Spec Kit 核心流程

核心 `.dsh/skills/speckit-*/SKILL.md` 由 Spec Kit integration 生成，仓库没有对应的本地命令渲染源。修改这些文件时：

1. 保留 front matter。
2. 更新 `.specify/integrations/dsh.manifest.json` 中被修改 skill 的 SHA-256。
3. 修改 `.specify/templates/` 或 `.specify/scripts/` 时，同步更新 `.specify/integrations/speckit.manifest.json` 中对应条目。
4. 上游 Spec Kit 刷新后重新审查并应用本地流程定制。

可用以下命令计算候选文件哈希，再仅更新实际修改的 manifest 条目：

```sh
sha256sum .dsh/skills/speckit-*/SKILL.md .specify/templates/*.md
```

spec 与 plan 模板包含状态、待确认决策、澄清记录和审查记录。访谈与审查的完整执行规则归属对应 skill：

- [speckit-clarify](../.dsh/skills/speckit-clarify/SKILL.md)：需求探索、分批需求访谈与完整规格审查。
- [speckit-plan](../.dsh/skills/speckit-plan/SKILL.md)：技术探索、分批实现细节访谈与完整计划审查。
- [speckit-tasks](../.dsh/skills/speckit-tasks/SKILL.md)：任务生成前的规格与计划门禁。
- [speckit-implement](../.dsh/skills/speckit-implement/SKILL.md)：实现前复核与新未决项处理。

## 维护 worktree 扩展

扩展源码在 `.specify/extensions/worktree/`，`.dsh/skills/speckit-worktree-*` 由它渲染生成。

修改 `commands/` 或 `extension.yml` 后重新渲染：

1. 把扩展目录复制到仓库外的临时目录，删除其中的 `.specify-dev/`。
2. 运行 `specify extension add --dev <临时目录> --force`。

脚本行为由 `tests/worktree-extension.test.ts` 与 `tests/sync-main.test.ts` 覆盖。

- `scripts/bash/spec-number-lib.sh`：编号解析与同号分支匹配。
- `scripts/bash/check-spec-number.sh`：交付前的编号唯一性校验。
- 修改 `commands/` 后同步 `.dsh/skills/speckit-worktree-*/SKILL.md` 的正文，保留 front matter。

## 文件地图

```text
cordis.patch.yml            # 插件行，dsh plugin add 时插入 profile
src/
├── index.ts                # 打包入口，导出 name、inject、apply、Config
├── config.ts               # Config schema、默认值、严格校验与热重载读取
├── constants.ts            # 共享常量
├── cli.ts                  # 本机命令与子进程
├── auth.ts                 # 鉴权状态机与设备码授权
├── bridge.ts               # 事件消费、过滤、去重与注入
├── sessions.ts             # 工作区会话创建、恢复、标题与置顶
├── state.ts                # 会话标识与去重窗口持久化
├── tools.ts                # lark_notify 工具
├── routes.ts               # 同源 JSON 路由
├── errors.ts               # 可诊断错误
├── types.ts                # 宿主类型再导出
├── utils.ts                # 零依赖工具函数
└── client/
    ├── index.ts            # 浏览器入口：字典、弹窗与配置页
    ├── api.ts              # 路由调用与状态类型
    ├── auth-overlay.tsx    # shell.overlay 鉴权弹窗
    ├── auth-panel.tsx      # 配置页鉴权面板
    ├── cli-install-command.tsx # CLI 缺失时的只读安装命令
    ├── config-form.ts      # 配置页草稿模型与行键常量
    ├── config-page.tsx     # 配置页的 summary 与 page 视图
    └── locales.ts          # 中英文字典与命名空间
dist/
├── index.mjs               # 宿主产物
├── client.js               # 浏览器产物（闭包工厂）
├── index.d.ts              # 宿主类型声明
└── client/                 # 前端类型声明
scripts/release-archive.mjs # 发布时归档 CHANGELOG
locale/                     # 插件元数据资源，规范见 i18n.md
tests/                      # vitest 单元测试
docs/                       # 开发者文档
specs/<NNN>-<name>/         # 每个需求的 spec、plan、tasks
.dsh/skills/
└── speckit-*/              # Spec Kit 流程 skill
.specify/
├── memory/constitution.md  # 项目宪章
├── templates/              # Spec Kit 产物模板与审查区块
├── integrations/           # 受管 skill、脚本与模板的 SHA-256 清单
├── scripts/bash/           # Spec Kit 脚本
├── extensions.yml          # 扩展钩子
└── extensions/worktree/    # 本地 worktree 扩展
.github/workflows/ci.yml    # CI：check（Node 24）与 tag 发布
```
