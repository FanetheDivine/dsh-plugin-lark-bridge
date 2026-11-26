# Contracts: `session_create` 工具与提示词契约

## 1. `session_create` 工具定义

- **Name**: `session_create`
- **Description**:
  `Create a DSH (DeepSeek Harness) session in a workspace or directory, name it, send its first prompt, and make it the task session. The preset comes from the plugin configuration. task_type selects the user's preconfigured common or complex task model (or the user's default when empty), and provider/model/effort override that model; omit or pass empty values for all of them unless the user explicitly asks. Returns the session id and the new task id.`
- **Parameters**:
  - `workspace_id` (`string`, optional): Workspace the session joins. Must have a workspace note. Exclusive with `cwd`; defaults to the calling session's working directory.
  - `cwd` (`string`, optional): Absolute directory the session owns. Exclusive with `workspace_id`.
  - `task_type` (`string`, optional): Task complexity type: `common` or `complex`. Maps to the user's preconfigured common or complex task model. Always pass an empty string (or omit) to use the user's default task type unless the user explicitly specifies the task type.
  - `provider` (`string`, optional): Provider id that overrides the `task_type` model configuration. Required together with `model`. Omit unless the user explicitly specifies a model.
  - `model` (`string`, optional): Model id that overrides the `task_type` model configuration. Required together with `provider`. Omit unless the user explicitly specifies a model.
  - `effort` (`string`, optional): Reasoning effort id for the exact `provider`/`model`. Requires `provider` and `model`. Omit unless the user explicitly specifies it.
  - `title` (`string`, required): Display title for the task.
  - `prompt` (`string`, required): The task's first message.
  - `message_id` (`string`, optional): Optional remote message id recorded on the task.

- **校验与执行语义**:
  1. `task_type`：去掉首尾空白后为 `''` 时表示未指定（取配置的 `defaultTaskType`）；为 `'common'` 或 `'complex'` 时使用该类型；为其他值时抛出 `ToolArgsError(['task_type must be common, complex, or empty'])`。
  2. `provider` / `model` / `effort`：若任意非空，要求 `provider` 与 `model` 成对提供，经 `llm.resolveCallConfig` 校验后作为目标模型（覆盖 `task_type` 对应的模型配置）。
  3. 若未传 `provider` / `model` / `effort`，调用 `service.taskModel(taskType)` 获取对应任务类型的配置模型；若已配置则经 `llm.resolveCallConfig` 校验（校验失败记警告并回退为 `undefined`）。
  4. 返回值结构保持 `{ sessionId, taskId, agentPreset?, title, prompted }` 不变。

## 2. `SA-调度会话` 提示词（`Start a task` 节）

```markdown
## Start a task

- Dispatch only into a workspace registered in workspaces.json. Match the request against each note's summary and keywords.
- When no workspace matches or several match, do not guess and do not start work. Tell the user "我不知道在哪个工作区" and ask which one.
- Create the session with session_create. Pass workspace_id, a title, and a prompt. The prompt holds only this task's request and its target workspace; leave out conclusions and content from other tasks.
- Always pass an empty task_type and omit provider, model, and effort unless the user explicitly asks for a task type (common or complex) or a specific model.
- The new session becomes the task's only session. Tell the user the task id and the workspace.
```

## 3. 配置页槽位与文案契约 (`dsh-plugin-lark-bridge#lark-super-agent`)

- 行元数据：
  - `rows/lark-super-agent/locale/zh.json`: `title: "调度会话"`, `description: "用调度会话统一管理其他任务会话"`
  - `rows/lark-super-agent/locale/en.json`: `title: "Dispatch session"`, `description: "Manage task sessions from the dispatch session."`
- 配置页模型选择项：
  - `data-dsh-lark-config-model="common"`: 标签「普通任务模型」（`Common task model`），标题旁带默认切换按钮 `data-dsh-lark-default-task-type="common"`。
  - `data-dsh-lark-config-model="complex"`: 标签「复杂任务模型」（`Complex task model`），标题旁带默认切换按钮 `data-dsh-lark-default-task-type="complex"`。
  - 当前默认项按钮显示「默认」（`Default`），非默认项按钮显示「设为默认」（`Set as default`）。
