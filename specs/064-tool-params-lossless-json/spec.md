# Feature Specification: 修复工具参数声明不是无损 JSON 导致的宿主崩溃

**Feature Branch**: `fix/064-tool-params-lossless-json`

**Created**: 2026-11-26

**Status**: Approved

**Change Category**: 缺陷修复

**Input**: User description: "dsh: fatal uncaught exception: Error: tool \"lark_notify\" parameters must be lossless JSON before schema projection ... at VisibilityRuntime.sync (dsh-plugin-better-mcp/dist/index.mjs) ... 报这个错误"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-001] Q: 修复范围只改 `lark_notify`，还是同时做可复用的无损 JSON 校验？ -> A: 两者都做。测试侧提供按宿主规则校验的函数，覆盖 `lark_notify` 与全部已注册工具。
- [D-002] Q: `parameters` 是否继续删除 `$schema` 键？ -> A: 继续删除，与 059 的现状一致。
- [D-003] Q: 是否在 `docs/known-risks.md` 增加工具声明的无损 JSON 要求？ -> A: 不增加。
- [D-004] Q: 是否在启用 better-mcp 的真实宿主上复现并验收？ -> A: 不做实机验收，以宿主等价规则的单测为准。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 未做实机验收，宿主规则以 `0.2.2-rc.5` 的 `snapshotJsonValue` 为准；宿主升级改变规则时单测不再等价。

## 现状基线

以下结论均有代码或运行时证据：

1. 宿主把工具声明的 `parameters` 当作无损 JSON 克隆。判定规则是只允许纯对象、数组、字符串、有限数字、布尔与 null，并且对象的键必须全部是可枚举字符串键。任一检查失败时抛 `tool "<name>" parameters must be lossless JSON before schema projection`。
2. `src/tools.ts` 用 `z.toJSONSchema` 生成 `lark_notify` 的 `parameters`。zod 4.6.6 的返回对象带一个不可枚举的 `~standard` 键，正好触发上述检查失败。
3. 工具注册时不校验 `parameters`，崩溃发生在宿主枚举工具声明时。普通模型请求不受影响，因为不可枚举键不参与序列化。
4. 触发点是 `dsh-plugin-better-mcp` 的可见性同步：它在每一步为在线会话读取全部工具声明。异常发生在微任务里，未被捕获时终止整个 DSH 进程。
5. 本插件其余工具（`src/sa-dispatch`、`src/lark-super-agent/managed/report-tool.ts`）的 `parameters` 是字面量或由 `defineTool` 编译，不含 zod 转换产物，未命中该规则。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 工具声明通过宿主的无损 JSON 校验 (Priority: P1)

宿主枚举全部工具声明时，`lark_notify` 的声明能被无损克隆，枚举正常返回，进程继续运行。

**Why this priority**: 当前缺陷会以未捕获异常终止整个 DSH，飞书对话与所有会话一起中断。

**Independent Test**: 对注册后的全部工具声明运行与宿主等价的深拷贝校验，断言不抛异常、返回深拷贝且值与原始声明一致。

**Acceptance Scenarios**:

1. **Given** 插件注册了 `lark_notify`，**When** 宿主枚举全部工具声明，**Then** 枚举成功返回，不抛异常。
2. **Given** 桥接会话收到飞书消息并开始一步，**When** better-mcp 同步该会话的工具可见性，**Then** 声明枚举完成，DSH 进程保持运行。
3. **Given** 同一份声明连续克隆 10 次，**When** 每次都包含 `lark_notify`，**Then** 每次都成功，结果一致。

---

### User Story 2 - 工具参数声明保持不变 (Priority: P2)

桥接会话的模型仍然看到 `text` 必填、`reply_to` 可选，调用与发送行为不变。

**Why this priority**: 修复不能改变模型看到的参数与运行时校验，否则会破坏既有调用。

**Independent Test**: 读取注册后的声明，断言结构与键；再用合法与非法参数各调用一次，比对返回。

**Acceptance Scenarios**:

1. **Given** 插件已注册，**When** 读取 `lark_notify` 的 `parameters`，**Then** 它是 `type: object`，`properties` 含 `text` 与 `reply_to`，`required` 含 `text`，且不含 `$schema`。
2. **Given** 模型传入合法 `text`，**When** 调用执行，**Then** 发送成功，返回结构与现状一致。
3. **Given** 模型传入空 `text` 或非法 `reply_to`，**When** 调用执行，**Then** 返回 `invalid-text` 或 `invalid-reply-to`，不发请求。

---

### User Story 3 - 同类写法被测试拦住 (Priority: P3)

维护者新增或修改工具声明时，测试按宿主的无损 JSON 规则检查声明，越界写法在提交前失败。

**Why this priority**: 单靠人工审查会再次漏掉不可枚举键、类实例或其他不可克隆值。

**Independent Test**: 用一个复用校验函数检查声明，覆盖全部已注册工具；再故意传入含不可枚举键的声明，断言校验失败。

**Acceptance Scenarios**:

1. **Given** 校验函数收到含不可枚举键的声明，**When** 运行校验，**Then** 返回失败并指出键名。
2. **Given** 声明是纯 JSON，**When** 运行校验，**Then** 返回深拷贝，且修改副本不影响原始声明。

### Edge Cases

- zod 升级后 `~standard` 变为可枚举键：声明序列化后多出该键，测试必须能发现。
- 未来的工具改用其他 schema 库生成声明：同样需要满足无损 JSON 规则。
- PTC 模式下宿主渲染 SDK 时也会投影声明，同样的规则适用于该路径。
- 其他插件先于本插件枚举声明时，崩溃在启动阶段就会出现，而不是等到第一条飞书消息。
- 嵌套对象携带不可枚举键时同样失败，校验必须递归。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件注册的每个工具的 `parameters` MUST 是无损 JSON：只含纯对象、数组、字符串、有限数字、布尔与 null，且对象的键全部是可枚举字符串键。
- **FR-002**: `lark_notify` 的 `parameters` MUST 保持 `type: object`、`properties` 含 `text` 与 `reply_to`、`required` 含 `text`。
- **FR-003**: `lark_notify` 的 `parameters` MUST 保持删除 `$schema` 键。
- **FR-004**: 宿主枚举工具声明时 MUST NOT 抛出 `parameters must be lossless JSON`。
- **FR-005**: `lark_notify` 的参数校验、发送行为与失败码 MUST 保持现状。
- **FR-006**: `tests/` MUST 提供一个按 FR-001 规则校验的复用函数，并覆盖 `lark_notify` 与全部已注册工具的声明。

### Key Entities

- **工具声明参数**：注册时交给宿主的 `parameters` 对象，模型侧可见的 JSON Schema。
- **无损 JSON 校验**：宿主的克隆规则，失败即抛异常；测试侧实现等价校验函数。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 无损 JSON 校验对含不可枚举 `~standard` 键的声明返回失败，对修复后的声明返回深拷贝并通过。
- **SC-002**: 全部已注册工具的声明在同一次校验中全部通过，连续 10 次结果一致。
- **SC-003**: 新增的声明校验测试在修复前失败、修复后通过。
- **SC-004**: `pnpm check` 通过，`tests/tools.test.ts` 全绿。

## Assumptions

- 宿主版本为 `@deepseek-ai/dsh-* 0.2.2-rc.5`，无损 JSON 规则以该版本 `dsh-tools` 的 `snapshotJsonValue` 为准。
- `dsh-plugin-better-mcp` 在每一步枚举工具声明，是该缺陷唯一的实际触发路径。
- 本次不做实机验收，验收以宿主等价规则的单测为准，风险记录在 Review Record。
- 修复只触及声明生成与测试，不改变工具可见性、鉴权与消息发送流程。
