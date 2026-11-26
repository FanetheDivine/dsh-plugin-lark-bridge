# Research: 工具参数声明的无损 JSON

## R-01 宿主如何判定无损 JSON

**Decision**: 以 `@deepseek-ai/dsh-tools@0.2.2-rc.5` 的 `snapshotJsonValue` 为唯一规则来源。

**Rationale**: 该函数是 `projectToolSchema(definition, true)` 的克隆实现，失败即抛 `tool "<name>" parameters must be lossless JSON before schema projection`。规则逐条为：

- 值域：null、布尔、字符串、有限数字；`-0` 与 `NaN`、`Infinity` 被拒。
- 数组：原型必须是原生的 `Array.prototype`，且除 `length` 外只能有连续下标。
- 对象：原型必须是 `null` 或原生 `Object.prototype`；全部自有键必须可枚举且是字符串键。
- 循环引用被拒。

**Alternatives considered**: 用 `JSON.stringify` 能序列化即算通过。它漏掉不可枚举键与 `-0`，而崩溃正是不可枚举键触发的，规则不等价。

## R-02 缺陷成因

**Decision**: `z.toJSONSchema` 在返回对象上用 `Object.defineProperty` 定义了不可枚举的 `~standard` 键，触发 R-01 的键检查失败。

**Rationale**: 该键是 Standard Schema 规范要求，zod 在 `toJSONSchema` 收尾时挂上，`enumerable: false`。宿主遍历自有键时看到它，随即拒绝整个声明。

**Alternatives considered**: 认为声明里有多余的可枚举键只需删除。实测 `~standard` 不可枚举，`delete` 之外的普通序列化与 `Object.keys` 都看不到它，只有 `Reflect.ownKeys` 可见。

## R-03 修复方式

**Decision**: `parametersOf` 用解构复制生成新对象，同时剔除 `$schema` 与 `~standard`。

```ts
const { $schema: _schema, '~standard': _standard, ...parameters } = z.toJSONSchema(schema);
return parameters;
```

**Rationale**: 展开只复制自有可枚举字符串键，一次性满足 R-01 的键规则；zod 自身的 `JSONSchemaGenerator.emit` 也用同样写法删除 `~standard`。

**Alternatives considered**:

- `JSON.parse(JSON.stringify(json))`：可用，但把类型与空值处理交给序列化，读起来看不出删除意图。
- 关闭 Standard Schema：zod 没有对应开关。
- 升级或降级 zod：`~standard` 是规范键，换版本只会换位置，且会牵动宿主依赖版本原则。

## R-04 为什么注册时不报错

**Decision**: 工具注册不校验 `parameters`，崩溃只出现在枚举声明时，因此修复必须放在声明生成处，不能依赖注册期拦截。

**Rationale**: `ToolsService.register` 只校验 `output.schema`、`timeoutMs` 与保留名。原生执行器 `NativeToolExecutor.describe` 以 `detachParameters=false` 直接透传声明，模型请求因此正常；`ToolsService.schemas()` 以 `true` 克隆，`better-mcp` 的可见性同步调的正是它，异常发生在微任务里，未被捕获即终止进程。

**Alternatives considered**: 只在 `better-mcp` 侧容错。它属于其他插件，不在本仓库范围。

## R-05 校验函数的语义

**Decision**: 测试侧实现与 R-01 等价的最小校验：递归检查值域、原型、键可枚举性、数组稠密度与循环引用，通过时返回深拷贝，失败时抛出带路径的 `Error`。

**Rationale**: 校验要能证明「宿主不会拒绝」，因此必须与宿主同一套判定，不能简化成 `JSON.stringify` 往返。深拷贝同时证明声明与副本互不影响。

**Alternatives considered**: 引入 `structuredClone`。它不拒绝不可枚举键以外的差异，且不满足「可枚举字符串键」判定。

## R-06 覆盖范围与收集方式

**Decision**: 新增 `tests/tool-schema.test.ts`，经三处真实注册入口汇总工具后逐个校验：主行 `apply`（`lark_notify`）、`registerDispatchTools`（调度七项）、`lark-super-agent` 的 `apply`（`send_report`）。

**Rationale**: `makeCtx` 已记录 `_registeredTools`，既有测试（`plugin.test.ts`、`sa-dispatch.test.ts`、`lark-super-agent-index.test.ts`）都用这条路径断言工具注册。走真实入口能覆盖接线，直接构造工具会漏掉注册条件。

**Alternatives considered**: 只在 `tests/tools.test.ts` 校验 `lark_notify`。它无法满足 FR-006 的「全部已注册工具」。

## R-07 产物与验证

**Decision**: 只跑 `pnpm format && pnpm check`；不重建 `dist`。

**Rationale**: `dist/` 被 `.gitignore` 排除，发布时由 `pnpm build` 重新生成。`code` 项目测试只跑 `src` 与 `tests`。

**Alternatives considered**: `pnpm full-check` 额外跑构建与 `test:dist`。可作为 PR 前的可选复核，不进入本特征的验收。
