# Feature Specification: 移除用户在场机制

**Feature Branch**: `refactor/067-presence-removal`

**Created**: 2026-11-26

**Status**: Approved

**Change Category**: 插件变更

**Input**: User description: "移除「用户在场」机制"

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-002] Q: 调度提示词的「Track where the user is」段落与在场提醒如何处置？ -> A: 删除提示词该段落，停止向调度会话注入在场提醒；全局在场状态的处理见 D-008。
- [D-003] Q: 桥接提醒「其他来源的用户消息按普通方式回复」与统一渠道矛盾，是否同步修改？ -> A: 桥接提醒同步改为所有桥接会话一律经 `lark_notify` 回复，正文只留一句概述。
- [D-004] Q: 「text 一句话概述即可」的准确含义？ -> A: `lark_notify` 成功送达后，本轮正文最多一句话概述，允许为空；完整内容只写在通知里。
- [D-006] Q: 移除在场机制后，被管理任务会话调用 `ask_user_question` 时如何处理？ -> A: 无条件拦截 `ask_user_question` 并注入 S。
- [D-007] Q: 移除在场按钮与定时闹钟后，仅服务于它们的 `src/client/ui/`（time-picker/popover/tooltip 等）与 Tailwind 构建管线是否一并清理？ -> A: 一并清理专属 UI 组件与 Tailwind 构建。
- [D-008] Q: 全局在场状态、两个自动更新开关与全局消息观察是否保留？ -> A: 一并删除，覆盖 D-002 中保留状态的表述。
- [D-009] Q: `/lark-bridge/presence` 路由是否删除？ -> A: 删除。
- [D-010] Q: 节假日数据是否随闹钟一并删除？ -> A: 一并删除。
- [D-011] Q: 移除后是否在真实宿主做端到端验收？ -> A: 做。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 网页不再显示桥接会话的完整回复，只显示通知后的一句概述；模型忽略提示词时正文可能为空或残留完整内容，程序不强制截断；删除 Tailwind 与 `src/client/ui/` 后，后续组件需重新引入样式方案。

## 现状基线

以下结论均有代码或运行时证据：

1. `src/lark-super-agent/presence.ts` 维护内存中的全局在场状态（`local`/`remote`），按消息来源自动更新，并为两个预设生成 `sa-presence` 提醒。
2. `src/lark-super-agent/schedule.ts` 与 `alarms.ts` 按闹钟条目定时切换状态；`holidays.ts` 抓取并缓存法定节假日数据，供跳过周末与节假日使用。
3. `src/lark-super-agent/routes.ts` 注册 `GET`/`POST /lark-bridge/presence`；`src/lark-super-agent/index.ts` 用 `webServer` 可选依赖接入，并在全局 `agent/pre-step` 观察消息。
4. `src/sa-dispatch/index.ts` 在调度会话的 `agent/pre-step` 调用 `presence.reminderFor`，状态变化时在本批消息最前插入提醒；`src/sa-dispatch/prompt.ts` 的「Track where the user is」要求按提醒选择「正文」或 `lark_notify` 渠道。
5. `src/lark-super-agent/managed/ask-guard.ts` 只在状态为 `remote` 时拒绝被管理会话的 `ask_user_question`、中止等待中的调用并排队 S。
6. `src/reminder.ts` 的桥接提醒规定：回复飞书消息时调用 `lark_notify`，其他来源的用户消息按普通方式回复。
7. 前端 `src/client/presence-controller.ts` 每 3 秒读取一次状态；`presence-button.tsx` 在 `sidebar.footer.action` 注册页脚图标；`presence-config.tsx` 在该行配置页提供两个开关、两组自动切换时间与节假日提示，同时承载任务模型、默认任务类型与任务会话预设。
8. `src/client/presence-alarms-editor.tsx` 使用 `src/client/ui/time-picker.tsx`，`presence-button.tsx` 使用 `src/client/ui/tooltip.tsx`；这两个文件是本插件使用 `src/client/ui/` 的唯一入口。
9. `src/client/tailwind.css` 由 `scripts/build-client-css.mjs` 编译成 `tailwind.generated.css`，在 `build`、`dev`、`check` 前执行；`package.json` 为此安装了 Tailwind、Radix 浮层与 shadcn 工具链依赖。
10. `tests/` 下有 6 个在场测试文件，另有 `managed-ask-guard.test.ts`、`client.test.ts`、`lark-super-agent-index.test.ts`、`sa-dispatch.test.ts` 覆盖在场行为。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 任务会话不等待无法回答的提问 (Priority: P1)

用户通过调度会话管理任务会话。任务会话需要用户决定时，经调度会话上报提问；它不再有一个「用户暂时不在」的分支，也不会停在等待回答的界面上。

**Why this priority**: 这是唯一会阻塞任务推进的行为。移除在场状态后若仍放行提问，任务会在无人查看的界面上无限等待。

**Independent Test**: 让一个被管理会话调用 `ask_user_question`，断言调用被拒绝、S 进入下一次模型请求，且会话可以改用 `send_report` 的 `question` 提问。

**Acceptance Scenarios**:

1. **Given** 会话被调度会话管理，**When** 它调用 `ask_user_question`，**Then** 调用返回拒绝，且不进入等待用户回答的状态。
2. **Given** 上一步的提问被拒绝，**When** 该会话发出下一次模型请求，**Then** 请求里含且只含一条 S，S 要求改用 `send_report` 的 `question` 提问。
3. **Given** 会话未被管理，**When** 它调用 `ask_user_question`，**Then** 调用照常执行。
4. **Given** 插件加载前已有被管理会话在等待回答，**When** 插件完成加载，**Then** 该等待被结束，并注入 S；网关不可用时只记日志。

---

### User Story 2 - 桥接会话统一经飞书回复 (Priority: P2)

桥接会话（含调度会话）不再按用户位置选择渠道。每次回复都把完整内容放进 `lark_notify`，正文最多保留一句话；调度会话不再收到在场提醒。

**Why this priority**: 在场机制删除后，若仍按来源或位置分流，飞书用户会收不到网页输入触发的回复与上报转达。

**Independent Test**: 在桥接会话发起一轮请求，断言本批消息没有 `sa-presence` 提醒、提示词不含「Track where the user is」段落，且回复调用 `lark_notify`，正文不超过一句话。

**Acceptance Scenarios**:

1. **Given** 调度会话收到用户消息，**When** 它开始新一轮，**Then** 本批消息不插入在场提醒。
2. **Given** 用户在网页里向桥接会话发消息，**When** 会话回复，**Then** 完整内容经 `lark_notify` 送达，正文最多一句话。
3. **Given** 用户在飞书发消息，**When** 会话回复，**Then** 行为与网页输入一致。
4. **Given** 任务会话上报到达调度会话，**When** 调度会话转达，**Then** 转达内容经 `lark_notify` 送达，正文最多一句话。
5. **Given** `lark_notify` 调用失败，**When** 本轮结束，**Then** 正文保留完整内容，不因一句话规则丢失信息。

---

### User Story 3 - 配置与环境只保留调度能力 (Priority: P3)

用户打开「调度会话」配置页时，只看到任务模型、默认任务类型与任务会话预设；侧栏没有在场图标；构建不再为在场界面生成 Tailwind 样式。

**Why this priority**: 移除机制后残留的开关、按钮和时间编辑没有作用，会误导用户。

**Independent Test**: 渲染配置页与侧栏动作，断言在场分区、按钮与轮询都不存在；运行 `pnpm check` 与 `pnpm build`，断言构建不再执行 Tailwind 生成且专属 UI 资源已删除。

**Acceptance Scenarios**:

1. **Given** 插件已加载，**When** 用户查看侧栏页脚，**Then** 没有在场状态图标。
2. **Given** 用户打开「调度会话」配置页，**When** 页面渲染，**Then** 只有任务模型、默认任务类型与任务会话预设，没有自动更新开关、自动切换时间与节假日提示。
3. **Given** 用户打开「用飞书和DSH对话」配置页，**When** 页面渲染，**Then** 工作区、模型与预设的配置保持现状。
4. **Given** 维护者执行 `pnpm build`，**When** 构建完成，**Then** 产物正常生成，且构建过程不再调用 Tailwind。

### Edge Cases

- 旧配置里仍保存着已移除的键（两个开关、`presenceAlarms`）时，插件启动、配置页与保存都正常，已移除的键不再被读取。
- 磁盘上残留 `<DSH_HOME>/lark-bridge/holiday-cache.json` 时，插件不读取、不删除它。
- 历史会话表层已有 `sa-presence` 提醒时，插件不再读取或补齐这类提醒。
- 多个被管理会话在同一时刻提问时，每个会话各自被拒绝并各自获得 S。
- 网关不可用时，插件无法结束加载前已在等待的提问，只记日志，新提问仍被拒绝。
- 调度会话是桥接会话时，它自己调用 `ask_user_question` 不受拦截。
- 非桥接会话使用其他预设时，行为与本次变更前一致。
- 桥接会话在 `lark_notify` 失败后仍要把完整内容留在正文，避免用户看不到回复。
- 桥接会话在一轮里多次调用 `lark_notify` 时，正文仍只保留一句概述。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件 MUST NOT 再根据用户位置改变提示词、追问拦截或回复渠道（D-002、D-006）。
- **FR-002**: 被管理会话调用 `ask_user_question` 时 MUST 一律拒绝，判定不读取任何用户位置信息（D-006）。
- **FR-003**: 拒绝后 MUST 在该会话下一次模型请求前注入 S，内容要求改用 `send_report` 的 `question` 提问；同一会话同一时刻最多一条 S。
- **FR-004**: 会话开始被管理时与插件加载后，已在等待的提问 MUST 被结束并注入 S；无法结束等待时 MUST 只记日志，不影响新提问的拒绝。
- **FR-005**: 调度会话 MUST NOT 再收到在场提醒；`SA-调度会话` 的提示词 MUST NOT 含「Track where the user is」段落（D-002）。
- **FR-006**: 桥接会话 MUST 一律经 `lark_notify` 回复与转达用户；`lark_notify` 成功送达后，本轮正文 MUST 最多一句概述，允许为空，完整内容只写在通知里（D-003、D-004）。
- **FR-007**: 桥接提醒 MUST 删除「其他来源的用户消息按普通方式回复」及同类例外，改为统一经 `lark_notify`（D-003）。
- **FR-008**: 插件 MUST NOT 再注册 `/lark-bridge/presence` 的读取或写入路由（D-009）。
- **FR-009**: 「调度会话」配置页 MUST 只保留普通任务模型、复杂任务模型、默认任务类型与任务会话预设；两个自动更新开关、自动切换时间与节假日提示 MUST 移除。
- **FR-010**: 侧栏页脚 MUST NOT 再出现在场状态按钮。
- **FR-011**: 仅服务于在场能力的实现与资源 MUST 移除：全局在场状态、两个自动更新开关、全局消息观察、闹钟条目、到点调度、节假日抓取与缓存、在场提醒、专属 UI 组件与 Tailwind 构建；`package.json` MUST NOT 再依赖这些能力专属的包。
- **FR-012**: 已移除的配置键 MUST NOT 再被读取；旧值存在时插件启动、配置页与保存 MUST 保持正常。
- **FR-013**: `README.md`、`docs/` 与 `AGENTS.md` MUST 删除在场说明，并写明桥接会话统一经 `lark_notify`、正文最多一句的规则。
- **FR-014**: `tests/` MUST 删除在场测试，并覆盖：无条件拦截、S 注入、不插入提醒、统一渠道文案、配置页与侧栏不含在场能力。

### Key Entities

- **被管理会话**：`message-task-status.json` 中未结束任务对应的会话；本次提问拦截的判定对象。
- **S**：提问被拒后插入的一次性指令，说明改用 `send_report` 的 `question`。
- **桥接会话**：状态文件记录 `sessionId` 的会话，回复一律经 `lark_notify`。
- **调度会话配置页**：`lark-super-agent` 行的配置界面，保留任务模型、默认任务类型与任务会话预设。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 被管理会话的 `ask_user_question` 被放行的次数为 0；每次拒绝后下一次模型请求都含一条 S。
- **SC-002**: 调度会话一轮内插入的 `sa-presence` 提醒为 0 条；提示词不含「Track where the user is」段落。
- **SC-003**: 抽查桥接会话的 3 轮回复，全部经 `lark_notify` 送达，正文句数不超过 1；通知失败时正文保留完整内容。
- **SC-004**: `/lark-bridge/presence` 不再回答成功状态，前端不再发起该请求。
- **SC-005**: 配置页渲染结果不含两个自动更新开关、自动切换时间与节假日提示；侧栏注册的在场动作数量为 0。
- **SC-006**: `pnpm build` 不再执行 Tailwind 生成；`src/client/ui/`、`tailwind.css`、`tailwind.generated.css` 与 `build-client-css.mjs` 不再存在；`package.json` 不含 Tailwind、Radix 浮层与 shadcn 工具链依赖。
- **SC-007**: `pnpm check` 与 `pnpm build` 通过，`tests/` 全绿。
- **SC-008**: 在真实宿主上装载插件后，配置页、侧栏、被管理会话的拦截与 S、桥接会话的统一渠道均按规格工作（D-011）。

## Assumptions

- 用户接受网页里不再看到桥接会话的完整回复，只看到通知后的一句概述（D-003、D-004）。
- 历史会话表层里的 `sa-presence` 提醒不清理。
- 宿主版本为 `@deepseek-ai/dsh-* 0.2.2-rc.5`。
- 本次只移除在场机制，调度、上报、任务台账与桥接流程的其余部分保持现状。
