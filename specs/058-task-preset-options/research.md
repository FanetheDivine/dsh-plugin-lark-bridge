# Research: 任务会话预设移除 SA-调度会话 选项

## R-01 选项来源

**Decision**: 过滤点放在 `PresetDefaults.load()` 的名册展示层，按预设标识 `sa-dispatch` 排除。

**Rationale**:

- 「任务会话预设」与桥接「预设」共用同一来源：`remote.agentPresets.list()` 返回宿主名册，`PresetDefaults`（`src/client/preset-defaults.ts`）读取后过滤 `broken` 条目，`PresetSelect` 渲染菜单。
- 配置项本体是 `lark-super-agent` 行配置的 `taskPreset` 字段（`src/lark-super-agent/config.ts`，`Schema.string().default('')`），下拉选项不在 schema 中定义。
- 桥接「预设」实例（`field = 'sessionPreset'`）不得受影响，因此排除只能是实例级参数。

**Alternatives considered**:

- 在 schema 层做 union 校验：会改动后端配置并使已存 `sa-dispatch` 值校验失败，违反 FR-003。
- 在 `PresetSelect`/`menuItems` 过滤：该组件也被桥接「预设」复用，需要额外传参，过滤点不如数据层清晰。

## R-02 已存值兼容

**Decision**: 不改已存值的任何读写路径，依靠 `PresetSelect` 现有兜底。

**Rationale**:

- `currentText` 与 `menuItems` 已处理「当前值不在名册中」：显示 `${id} · 不可用`，菜单补一个禁用项，草稿值不被清除。
- `session_create`（`src/sa-dispatch/session-create.ts`）经 `service.taskPreset()` 读取配置原值，与名册无关，已存 `sa-dispatch` 继续生效。
- 默认值为空串表示跟随宿主默认，逻辑不变。

## R-03 排除参数形态

**Decision**: `PresetDefaults` 构造函数追加可选参数 `excludeIds: readonly string[]`，默认空数组；`load()` 在过滤损坏条目时一并排除。排除标识常量定义在 `presence-config.tsx` 的 `TASK_PRESET_FIELD` 旁。

**Rationale**: 现有签名 `(ctx, form, edit, field?, remote?)` 追加尾部可选参数，现有调用点与测试零改动；常量与字段名同处，语义内聚。
