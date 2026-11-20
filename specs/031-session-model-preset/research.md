# 技术研究：桥接会话的模型与预设

宿主版本以升级后的 `@deepseek-ai/*@0.2.2-rc.5` 源码为准。

## R-001 宿主依赖升级

**Decision**: 把 17 个现有 dsh 包升级到 `0.2.2-rc.5`，新增 `dsh-agent-preset-registry`、`dsh-api-remotes`、`dsh-api-session-controller`、`dsh-client-product-analytics`、`dsh-client-ui-model-selection`、`dsh-typert-protocol`，并把 `@tsdown/css@^0.22.14` 加入开发依赖。

**Rationale**: 已安装宿主为 `0.2.2-rc.5`，宪章 I 要求插件与宿主同版本。官方模型选择器与预设名册只在 rc.5 包集中提供；`dsh-client-ui-model-selection` 直接导入 `src/`，其自身没有 dependencies，所以它使用的 `dsh-api-remotes`、`dsh-api-session-controller`、`dsh-client-product-analytics`、`dsh-typert-protocol` 必须由本包声明。`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 同步为 23 条同版本记录。

**Alternatives Considered**:

- 保持 rc.3 自绘模型选择器：无法复用官方选择器，且预设名册类型缺失。
- 只升级部分包：`tests/dependency-versions.test.ts` 要求全部 dsh 子包同版本。

## R-002 预设的应用路径

**Decision**: 新建桥接会话改走 `sessionController.create({ sessionId, workspaceId, cwd, agentPreset })`，预设标识先经 `agentPresets.list()` 过滤。

**Rationale**: `sessionController.create` 在内部把 `agentPreset` 写入会话头，并执行 `presets.mount` 组合预设；`ctx.agents.create` 的 `meta.agentPreset` 只写会话头，预设不会挂载。`list()` 返回 `AgentPreset[]`，以 `broken === undefined` 作为可用判据，与参考插件一致。

**Alternatives Considered**:

- `ctx.agents.create` 加 `meta.agentPreset`：预设不生效，只有元数据。
- 创建后调用 `agentPresets.select(agent, id)`：接口写入时机与组合语义未在宿主文档中确认，风险更高。

## R-003 模型的应用与校验

**Decision**: 配置的模型先经 `llm.resolveCallConfig(selection)` 校验；校验通过后在会话创建后调用 `agent.model.select(selection)`。

**Rationale**: `Agent.model.select` 只写 `model/selection` 事件，宿主文档说明调用方负责可用性校验；`resolveCallConfig` 能提前拒绝不可用的 provider/model/effort。参考插件的模型路径相同。

**Alternatives Considered**:

- 在 `agentOptions` 里传配置值：`agentOptions` 是路由兜底，不会改变新会话的记录，且与宿主默认混用。
- 只依赖 `agent.model.select`：错误直到首轮才暴露，且会污染会话记录。

## R-004 降级与日志

**Decision**: 预设不可用时省略 `agentPreset`，模型校验失败时跳过 `agent.model.select`；两种情况都记录 `warn`，会话照常创建并注入消息。

**Rationale**: 飞书消息异步到达，创建失败等于消息丢失。参考插件对配置的预设采用回退，配置模型在工具侧直接报错；桥接场景需要消息不丢，因此模型同样回退。

**Alternatives Considered**:

- 模型不可用即中止创建：会让飞书侧静默失败，直到用户改配置。
- 静默回退不记录：用户无法发现配置失效。

## R-005 官方模型选择器与 CSS 管线

**Decision**: 复用 `@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx` 与 `catalog.ts`，在 `tsdown` 增加 `css: { fileName: 'client.css' }`、`onSuccess` 内联样式，新增 `src/css.d.ts`。

**Rationale**: 官方组件自带 CSS module，本仓库没有 CSS 处理链；`@tsdown/css` 与内联脚本是参考插件已验证的做法。内联后浏览器产物保持单文件。

**Alternatives Considered**:

- 自绘两级菜单：不新增构建依赖，但交互与官方选择器不一致，违背 spec 的界面要求。
- 引入完整 CSS 文件并在运行时 fetch：需要额外静态资源路由，宿主未提供。

## R-006 客户端服务与种子模块

**Decision**: 客户端入口导出 `inject = ['slots', 'locale', 'configForms', 'remote', 'remote.session']`；预设名册用 `ctx.inject(['remote.agentPresets'])` 可选接入；`tsdown.config.ts` 的 `PLATFORM_MODULES` 补 `@deepseek-ai/dsh-client-store`。

**Rationale**: `ModelCatalogDirectory` 依赖 `remote.session.modelCatalog()` 与 `dsh-client-store` 的 `createSnapshotStore`；rc.5 静态种子表包含 `dsh-client-store`，本仓库数组缺少它，内联后会在运行时抛错。声明 `dsh-client-ui-model-selection` 到 `dsh.client.inject` 会带入 `remote` 等宿主包。

**Alternatives Considered**:

- 把 `dsh-client-store` 打进产物：会与宿主的快照实现分成两份，状态订阅失效。

## R-007 预设名册的客户端读取

**Decision**: `PresetDefaults` 读取 `remote.agentPresets.list()`，过滤 `broken` 条目，维护 `loading`、`ready`、`noService`、`error` 状态；`gateway/invocation-unavailable` 视为宿主不提供名册。

**Rationale**: 与参考插件同源接口；`remote.agentPresets` 由 `dsh-agent-preset-registry` 的 typert 远程命名空间提供，客户端只在服务存在时接入。

**Alternatives Considered**:

- 复用 `sessionController` 的 session 远程：没有预设名册方法。

## R-008 测试策略

**Decision**: 更新 `tests/config-form.test.ts`、`tests/client.test.ts`、`tests/client-bundle.test.ts`、`tests/sessions.test.ts`、`tests/plugin.test.ts`；新增 `tests/model-defaults.test.ts` 与 `tests/preset-defaults.test.ts`；不做实机验证。

**Rationale**: 现有客户端测试断言入口没有 `inject` 导出，升级后必须改；会话测试需要覆盖预设传递、模型选择与两种降级；目录测试覆盖状态机与草稿写入。宪章 II 把实机验证列为 SHOULD，用户选择跳过。

**Alternatives Considered**:

- 一次性 profile 实机验证：会改动用户环境，用户选择不做。

## R-009 文档与变更记录

**Decision**: 更新 `docs/how-it-works.md` 的配置与新建会话小节、`docs/known-risks.md` 的宿主版本与官方源码导入风险、`CHANGELOG.md` 的 `Unreleased` 条目；README 不改。

**Rationale**: 宪章 III 把机制与风险归入 `docs/`。README 由另一分支精简（D-007），本次改动会冲突。`locale/*.json` 的 `meta.description` 同属另一分支的更新范围，本次不动。

**Alternatives Considered**:

- 同步 README 与 `locale/*.json`：与并行分支产生冲突。
