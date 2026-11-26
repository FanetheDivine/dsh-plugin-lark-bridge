# Research: 调度会话更名与任务类型模型配置

## R-01 行元数据与文档更名

- **Decision**:
  - `rows/lark-super-agent/locale/zh.json`：`meta.title` 改为 `"调度会话"`，`meta.description` 改为 `"用调度会话统一管理其他任务会话"`。
  - `rows/lark-super-agent/locale/en.json`：`meta.title` 改为 `"Dispatch session"`，`meta.description` 改为 `"Manage task sessions from the dispatch session."`。
  - `rows/lark-super-agent/icon.svg`：`<title>` 改为 `Dispatch session`。
  - `cordis.patch.yml`、`README.md`、`docs/how-it-works.md`、`docs/known-risks.md` 及代码注释中的「飞书任务与调度会话」全部更新为「调度会话」。
- **Rationale**: 满足 FR-001 与 SC-001，保持中英文元数据键集和含义一致。
- **Alternatives Considered**: 保持英文 `Lark task dispatch` 不变——与中文新名称「调度会话」及新描述不一致，故一并更新。

## R-02 任务模型分档与默认任务类型的配置键

- **Decision**:
  - 任务类型枚举：`TASK_TYPES = ['common', 'complex'] as const`，`type TaskType = 'common' | 'complex'`。
  - `lark-super-agent` 行配置（`src/lark-super-agent/config.ts`）：
    - 普通任务模型：`commonTaskProvider`、`commonTaskModel`、`commonTaskEffort`（均为 `Schema.string().default('').volatile()`）。
    - 复杂任务模型：`complexTaskProvider`、`complexTaskModel`、`complexTaskEffort`（均为 `Schema.string().default('').volatile()`）。
    - 默认任务类型：`defaultTaskType`（`Schema.union([Schema.const('common'), Schema.const('complex')]).default('common').volatile()`）。
  - 删除旧配置键 `taskProvider`、`taskModel`、`taskEffort`。
- **Rationale**: 与现有三元组模型配置结构（`provider` + `model` + `effort`）完全同构，可直接复用 `ModelDefaults`。
- **Alternatives Considered**: 嵌套对象存储——`SettingsFormModel` 的 `settingsTextField` 与 `ModelDefaults` 按顶层字段名读写，平铺字段最简且零侵入。

## R-03 前端配置页双模型选择器与默认切换控件

- **Decision**:
  - `src/client/index.ts` 为 `PRESENCE_ROW_ID` 创建两个 `ModelDefaults` 实例：`commonTaskModels`（绑定 `COMMON_TASK_MODEL_FIELD_NAMES`）与 `complexTaskModels`（绑定 `COMPLEX_TASK_MODEL_FIELD_NAMES`）。
  - `src/client/task-model-field.tsx` 渲染两个任务模型配置项（`data-dsh-lark-config-model="common"` 与 `data-dsh-lark-config-model="complex"`）。
  - 每个模型项顶部行左侧为标题（「普通任务模型」/「复杂任务模型」），右侧复用 `@deepseek-ai/dsh-client-ui-primitives` 的 `Pill` 组件（`active={isDefault}`）：
    - 当前为默认任务类型时：`active={true}`，文案显示「默认」（`presenceConfig.taskType.default`）。
    - 非默认任务类型时：`active={false}`，文案显示「设为默认」（`presenceConfig.taskType.setDefault`），点击调用 `edit('defaultTaskType', type)`。
  - `defaultTaskType` 字段规范：当值为 `'complex'` 时格式化为 `'complex'`，其余（含空或 `'common'`）按 `'common'` 显示，编辑写入 `'common'` 或 `'complex'`。
- **Rationale**: `Pill` 已在 `presence-config.tsx` 中用于闹钟跳过项，视觉风格与宿主原语一致，无需引入新 UI 依赖。
- **Alternatives Considered**: 独立下拉菜单选择默认任务类型——用户在 D-002 中已确认采用模型标题旁设默认的方式。

## R-04 `session_create` 任务类型参数与模型解析优先级

- **Decision**:
  - `session_create` 新增可选参数 `task_type: { type: 'string', description: ... }`（允许 `'common'`、`'complex'`、空串或省略；传入其他非空字符串抛 `ToolArgsError`）。
  - `LarkSuperAgentService.taskModel(type?: TaskType): ModelSelection | undefined`：
    - 当 `type` 未传时，先通过 `readDefaultTaskType(config)` 取默认任务类型（`'common'` 或 `'complex'`，缺省 `'common'`）。
    - 按确定的任务类型读取对应前缀的模型三元组（`commonTask*` 或 `complexTask*`）。
    - 对应模型未配置（provider 或 model 为空）时返回 `undefined`，不在两种任务模型之间互相回退。
  - `session_create` 执行时：
    1. 校验 `task_type`：若非空且不在 `['common', 'complex']` 中，立即抛 `ToolArgsError`。
    2. 解析显式 `provider` / `model` / `effort`：若提供，经 `llm.resolveCallConfig` 校验后使用（失败抛错，不创建会话）。
    3. 若未提供显式模型参数，调用 `service.taskModel(taskType)` 获取对应任务类型的模型配置；若非空，经 `llm.resolveCallConfig` 校验后使用（校验失败记警告并回退宿主默认）。
- **Rationale**: 严格符合 FR-004、FR-005、FR-006、FR-007 与 D-001 ~ D-005。
- **Alternatives Considered**: 在 JSON Schema 上直接写 `enum: ['common', 'complex']`——若 schema 限制 enum，模型传空字符串 `""` 会在 schema 校验层被拒，而需求要求「允许传空值（即按默认值）」，因此在参数类型上声明为 `string`，在描述中写明取值 `common` / `complex` 或空值，并在 `execute` 内校验空串与枚举值。
