# Research: 迁入飞书任务与调度会话

## R-01 组合包实现的组成

- Decision: 按组合包 `main` 的三个入口迁入，模块边界保持不变。
- Rationale: 组合包的三个入口职责清晰，测试按模块组织，整体复制风险最低。
- Alternatives considered: 把三个入口合并进本插件主入口。预设子行必须是独立入口，宿主按 `name` 分别 import，因此不可行。

| 组合包入口 | 源码 | 测试 |
| --- | --- | --- |
| `lark-super-agent` 全局行 | `src/lark-super-agent/` 共 10 个文件 | `tests/lark-super-agent-*.test.ts` 共 7 个文件 |
| `sa-dispatch` 预设子行 | `src/sa-dispatch/` 共 4 个文件 | `tests/sa-dispatch.test.ts` |
| `sa-worker` 预设子行 | `src/sa-worker/` 共 5 个文件 | `tests/sa-worker.test.ts` |
| 两个预设声明 | `cordis.patch.yml` 的 `preset-sa-dispatch`、`preset-sa-worker` | `tests/presets-patch.test.ts` 与 `tests/support/standard-preset.yml` |

组合包外部依赖只有 `@deepseek-ai/dsh-llm`、`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-tools` 与 Node 内置模块。三者都已在本仓 `devDependencies`，版本为 `0.2.2-rc.5`，与组合包一致。

## R-02 需要删改的组合包代码

- Decision: 删除调度状态路由，替换组合包的工具模块引用。
- Rationale: 规格 D-006 不迁入状态接口；其余引用指向组合包的共享模块。

| 组合包代码 | 处理 |
| --- | --- |
| `src/lark-super-agent/status.ts` 与 `service.status()`、`api.ts` 中的 `status` 成员 | 删除 |
| `lark-super-agent/index.ts` 的路由注册与 `connection` 注入 | 删除 |
| `../rows.ts`、`../utils.ts` 的 `jsonResponse` | 删除引用 |
| `../types.ts` 的 `Context` | 改用本仓 `src/types.ts` |
| `bridge.ts` 读取 `state.json` | 改用本仓 `StateStore` 与 `statePath()`，见 R-03 |
| `sa-dispatch/presence.ts` 的 `'lark-bridge'` 字面量 | 改用本仓 `src/message.ts` 的来源常量 |

## R-03 桥接状态的读取与路径

- Decision: 服务每次调用用 `new StateStore(statePath()).load()` 读取状态，访问文件系统前用 `toHostWorkspacePath` 转换 `workspaceRoot`。
- Rationale:
  - 本仓 `state.json` 保存 Linux 风格路径，例如 `/c/work/demo`。
  - Windows 上 Node 把 `/c/work/demo` 解析为当前盘符下的 `\c\work\demo`。
  - 组合包直接使用该值，调度工作区在 Windows 上会解析到错误目录。
  - 每次新建 `StateStore` 读取文件，得到主行最新写入的值。
- Alternatives considered: 主行提供服务，调度行注入。见计划 P-002。

## R-04 预设子行的依赖解析

- Decision: 本插件 `dependencies` 增加 `dsh-plugin-meta-tools@0.1.7`，并列入 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude`。
- Rationale: 组合包以包名在预设内加载 meta-tools，宿主从本插件的依赖解析它。
- 事实：
  - 0.1.7 是 npm 最新版本。
  - 它不声明 `peerDependencies` 与 `dependencies`，只要求 Node `>=24.9.0`，与本插件一致。

## R-05 行元数据与图标

- Decision: 每个新行在 `rows/<row>/locale/*.json` 提供标题与描述，在 `rows/<row>/icon.svg` 提供图标，并在 `package.json` 的 `exports` 与 `files` 声明。
- Rationale: 组合包用同一结构让宿主读取子行的元数据；本仓 `docs/i18n.md` 只覆盖根行，需要补充子行规则。

## R-06 进行中的注入修改

- Decision: 不需要额外复核。
- Rationale: `fix/036` 与 `fix/037` 已经以 #20、#21 合入 `main`，本分支已包含。注入仍使用 `source.kind` 为 `lark-bridge` 的用户消息，调度会话的在场判定不受影响。

## R-07 发布方式

- Decision: 本分支只在 `CHANGELOG.md` 的 `Unreleased` 写条目。`0.3.0` 由单独的发布 PR 完成。
- Rationale: `0.2.0` 由 `chore(release): 发布 0.2.0 (#22)` 单独发布；`pnpm run release` 只递增补丁号。

## R-08 实机验证可行性

- Decision: 使用仓库的 `real-device-test` skill，以 mock provider 驱动会话，并手写 `state.json` 指定桥接会话与工作区。
- Rationale: 真实飞书消息需要用户的 lark-cli 授权；预设名册、工具调用、上报注入与行停用都可以在 mock 模型下验证。
