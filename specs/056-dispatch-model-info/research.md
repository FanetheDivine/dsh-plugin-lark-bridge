# Research: 调度会话模型信息查询工具

**Feature**: `specs/056-dispatch-model-info/` | **Date**: 2026-11-26

## R-001: 宿主模型目录数据源

**Decision**: 使用宿主 `llm` 服务（`@deepseek-ai/dsh-llm`）的三个方法枚举模型目录。

- `listProviders(): LlmProviderInfo[]`：已注册 provider，注册顺序。
- `listModels(provider): Promise<LlmModelInfo[]>`：某 provider 的可发现 model，`{ provider, id, name }`。
- `resolveModelInfo(provider, model, signal?): Promise<LlmResolvedModelInfo>`：exact route 元数据，`reasoning.efforts` 为 `LlmReasoningEffortInfo[]`（`id`、`name`），`reasoning.defaultEffort` 可选。

**Rationale**: 插件只读取宿主目录，不自行维护清单，满足 FR-002/FR-005。

**Alternatives considered**:

- 配置页前端目录（`dsh-client-ui-model-selection`）：仅客户端可用，调度会话工具在宿主侧运行，排除。
- `listConfigurableProviders()`：含未注册（dormant）provider，不能保证路由可用，排除。

## R-002: effort 的获取方式

**Decision**: 逐路由调用 `resolveModelInfo` 取 `reasoning.efforts`，只返回 effort id 列表（D-002）。

**Rationale**: `listModels` 不含 effort；spec FR-003 要求每个 model 附带支持的 effort。调用次数为 model 总数，宿主本地解析，无网络放大。

**Alternatives considered**:

- 只返回 `listModels` 结果不含 effort：与 FR-003 冲突，排除。
- 同时返回 effort name/defaultEffort：用户确认只需 id，保持最小字段。

## R-003: 失败粒度

**Decision**: 三级失败策略，与 spec FR-006/FR-007 及 P-D-002 一致。

| 失败 | 行为 |
| --- | --- |
| `llm` 服务未挂载 | 注册工具，execute 抛出可读错误 |
| 某 provider `listModels` 失败 | 跳过该 provider，`skipped` 记录 `{ provider, error }` |
| 某 model `resolveModelInfo` 失败 | 跳过该 model，`skipped` 记录 `{ provider, model, error }` |

**Rationale**: 调用总能得到尽可能完整且诚实标注的结果（SC-004）。

## R-004: 工具接线方式

**Decision**: 新文件 `src/sa-dispatch/list-models.ts` 导出 `buildListModelsTool(deps)`；在 `src/sa-dispatch/index.ts` 现有 `ctx.inject(['sessionController'], ...)` 块内注册，`llm` 以 `scoped.get('llm')` 读取、允许为 undefined。

**Rationale**: 与 `session_create` 覆写完全同构（同一 inject 块、同一可选 llm 模式、execute 内兜底报错），不新增 cordis 依赖声明。工具落在 `sa-dispatch` 预设作用域，满足 FR-009。

**Alternatives considered**:

- 放入 `registerDispatchTools`：该处未读取 `llm`，需改签名与注入声明，收益为零。
- 独立 `ctx.inject(['llm'], ...)`：llm 未挂载时工具不会注册，与 FR-006「工具存在并返回错误」不符。

## R-005: 执行顺序与并发

**Decision**: provider 与 model 均顺序遍历（`for...of` + `await`），遵守 `exec.signal`。

**Rationale**: 目录规模小（个位数 provider、每 provider 十余 model），顺序执行保证输出顺序稳定且与宿主注册顺序一致；并发无收益。

## R-006: 提示词与文档

**Decision**: 不改 `SA_DISPATCH_PROMPT`（P-D-001）；README「关于调度会话」补一句工具能力；`docs/how-it-works.md` 预设表的工具列表加 `list_models`。

**Rationale**: 宪章 III 要求用户可见行为更新 README、机制变化更新归属文档；提示词保持不动是用户明确选择。

## R-007: 测试方式

**Decision**: 新增 `tests/list-models.test.ts`，用 `tests/helpers.ts` 的模拟 `ctx` 与可编程 llm 模拟覆盖：注册与命名、无参数 schema、正常枚举、provider 级跳过、model 级跳过、llm 未挂载报错、空目录。运行 `pnpm test:code` 与 `pnpm check`。

**Rationale**: 宪章 II 要求代码与测试同步；现有 `tests/session-create.test.ts` 已验证同一接线模式，可直接参照。
