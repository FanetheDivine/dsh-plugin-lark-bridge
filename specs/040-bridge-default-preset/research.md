# 研究记录: 桥接会话默认预设

**Feature**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md) | **Date**: 2026-11-23

## R-01 配置页默认值来自 schema

**Decision**: 只改 `src/config.ts` 的 schema 与 `DEFAULT_CONFIG`，配置页自然显示新默认值。

**Rationale**: 宿主 `dsh-settings` 的 `describe` 用 `projectForm(form, plainConfig(entry.fiber.effectiveConfig))` 生成表单的 `value`。`effectiveConfig` 是 schema 解析后的配置，包含缺省值，因此未保存过的 `sessionPreset` 在表单里显示 `sa-dispatch`。

**Alternatives Considered**:

- 在客户端再写一份默认值：与 schema 重复，两处可能不一致。
- 依赖客户端空值兜底：表单快照已含默认值，客户端兜底不会触发。

## R-02 文本字段的空文本等于清除

**Decision**: 移除预设菜单里的「跟随宿主默认」项。

**Rationale**: `dsh-client-ui-primitives` 的 `settingsTextField.parse` 把空文本映射为 `{ kind: 'clear' }`，保存时写成 `unset`。`sessionPreset` 有了 schema 缺省值后，`unset` 会让值回到 `sa-dispatch`，该选项实际无法生效。

**Alternatives Considered**:

- 给 `sessionPreset` 定制字段规则，把空文本写成显式空串：保留选项，多一份字段规则与用例。
- 保留选项但接受它回到默认值：用户看到的现象与所选不符。

## R-03 预设解析与回退已具备

**Decision**: `src/sessions.ts` 的 `resolvePreset` 不改。

**Rationale**: 候选预设为 `sa-dispatch` 时会先查宿主名册；名册缺失、读取失败或候选不可用时回退宿主默认并记录警告。默认值的变化只改变候选来源。

**Alternatives Considered**:

- 在解析前额外校验预设是否属于本插件：多一次判断，回退逻辑已有。

## R-04 旧配置的空值保留

**Decision**: 已保存的 `sessionPreset: ''` 不做迁移。

**Rationale**: 用户层显式保存的空串在 `projectForm` 中保留，配置页显示「跟随宿主默认」，新建会话按空值处理并跟随宿主。schema 缺省值只对未保存过该键的配置生效。

**Alternatives Considered**:

- 升级时把空串改写为 `sa-dispatch`：覆盖用户主动保存的选择。

## R-05 文档归属

**Decision**:

| 内容 | 文档 |
| --- | --- |
| 默认预设与改选方式 | `README.md` 的「飞书任务与调度会话」 |
| 改选其他预设后的能力缺失 | `docs/known-risks.md` 的预设小节 |
| `sessionPreset` 的取值与回退机制 | `docs/how-it-works.md` 的配置小节 |
| 本次变更 | `CHANGELOG.md` 的 Unreleased |

**Rationale**: 宪章 III 按读者划分文档归属，同一信息只写一处。

**Alternatives Considered**:

- 全部写进 README：把风险与机制混进用户文档。
