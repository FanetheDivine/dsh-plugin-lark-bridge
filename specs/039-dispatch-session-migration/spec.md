# Feature Specification: 迁入飞书任务与调度会话

**Feature Branch**: `feat/039-dispatch-session-migration`

**Created**: 2026-11-23

**Status**: Approved

**Input**: User description: "`<repo>/dsh-plugin-practical-tool-bundle` 查看此项目的main分支。从此项目中迁移 “飞书任务与调度会话” 功能" 补充输入: "Agent预设的标题改为 SA-调度/工作会话"

## Open Decisions

无。

## Clarifications

### Session 2026-11-23

- [D-001] Q: 迁移范围包含哪些部分？ -> A: 全部迁入，等同复制组合包的相关代码；组合包随后删除该功能。
- [D-002] Q: 调度功能在 Plugins 页如何呈现？ -> A: 一行可单独停用的功能行，默认启用；停用后桥接与 `lark_notify` 照常工作。
- [D-003] Q: 两个预设的 id 是否沿用？ -> A: 沿用 `sa-dispatch` 与 `sa-worker`。
- [D-004] Q: 本插件与仍含该功能的旧版组合包同时启用时怎么处理？ -> A: 不处理，忽略这种情况。
- [D-005] Q: 桥接会话的默认预设是否改为调度预设？ -> A: 保持空值，用户在配置页自行选择。
- [D-006] Q: 调度状态接口如何处理？ -> A: 不迁入。问题由工具结果的错误与 `warning` 体现。
- [D-007] Q: 调度工作区已有数据如何处理？ -> A: 原样沿用，路径与格式不变，升级不做迁移。
- [D-008] Q: 组合包未合并的 `feat/030-lark-dispatch-config` 是否迁入？ -> A: 不迁入。
- [D-009] Q: 插件标题与描述如何同步？ -> A: 中文标题为「用飞书和DSH对话」，中文描述为「配置lark-cli即可在手机和dsh对话，体验Super Agent！」。
- [D-010] Q: 组合包的规格 `025`、`031`、`032` 是否复制进本仓？ -> A: 不复制。
- [D-011] Q: 发布版本号？ -> A: `0.3.0`。
- [D-012] Q: 是否做实机验证？ -> A: 做。
- [D-013] Q: 两个预设的名称？ -> A: 调度预设为 `SA-调度会话`，工作预设为 `SA-工作会话`。

### 探索发现

- 组合包 `main` 的该功能由三部分组成：
  - `lark-super-agent` 全局行：提供 `larkSuperAgent` 服务与调度状态路由。
  - `sa-dispatch` 预设子行：调度提示词、`task_create`、`task_update`、`workspace_note_set`、`workspace_note_remove`、`task_candidates`，以及用户在场提醒。
  - `sa-worker` 预设子行：工作提示词、`send_report`、`<dispatch_session_message>` 标记与轮次失败通知。
- `preset-sa-dispatch` 与 `preset-sa-worker` 两行声明预设；调度预设内含 `dsh-plugin-meta-tools` 子行，`session_preset` 固定为 `sa-worker`。
- 组合包从本插件的状态文件读取 `sessionId` 与 `workspaceRoot`；用户在场判定依赖本插件注入消息的 `source.kind` 为 `lark-bridge`。
- 组合包的调度状态路由没有前端使用者。
- 两个预设的提示词为英文，只用 preset id 指代对方，预设名称只出现在注释与文档中。
- 本插件 `main` 只有一行；`lark_notify` 只在桥接会话可见；配置页已有 `sessionPreset` 预设选择器。
- 本仓 `fix/036-immediate-injection` 与 `fix/037-steer-interjection` 正在修改注入路径，可能影响用户在场判定。

## Review Record

- 2026-11-23 | Decision: Approved | Scope: current full document | Open items: none | Risks: 与旧版组合包并存时预设与工具重复注册；进行中的注入修改可能改变消息来源标识

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 只装本插件即可远程派发任务 (Priority: P1)

用户只安装 `dsh-plugin-lark-bridge`，在配置页把桥接会话预设选为 `SA-调度会话`。用户在飞书私聊登记工作区并发送任务，调度会话选择工作区、新建或复用 `SA-工作会话` 并回执。

**Why this priority**: 这是迁移的核心价值。用户不再需要另装组合包。

**Independent Test**: 全新 profile 只装本插件，完成飞书授权与工作区选择，发送一项任务，确认工作会话被创建并开始执行。

**Acceptance Scenarios**:

1. **Given** 全新 profile 只装本插件，**When** 打开配置页的预设选择器，**Then** 列表含 `SA-调度会话` 与 `SA-工作会话`。
2. **Given** 桥接会话使用 `SA-调度会话`，**When** 用户在飞书登记一个工作区并发送任务，**Then** 调度会话写入笔记、新建并置顶 `SA-工作会话`，经 `lark_notify` 回执目标工作区与执行会话。
3. **Given** 没有匹配的工作区，**When** 用户发送任务，**Then** 调度会话先请用户新增工作区或补充说明。

---

### User Story 2 - 任务上报与完成归档 (Priority: P1)

工作会话通过 `send_report` 上报进展、提问与结果。调度会话转述给用户，并把回答送回原工作会话。任务完成后，任务与其工作会话自动归档。

**Why this priority**: 上报是派发后用户获得结果的唯一通道。

**Independent Test**: 在工作会话调用 `send_report`，检查调度会话收到 `<work_session_message>`、调度工作区写入上报记录并提交 git；把任务标记完成后检查归档目录。

**Acceptance Scenarios**:

1. **Given** 工作会话执行中，**When** 调用 `send_report`，**Then** 调度会话收到带 `sessionid`、`reportid`、`taskid` 的上报块，`reports/<taskId>/` 出现记录与附件副本。
2. **Given** 工作会话的一轮以错误结束，**When** 轮次结束，**Then** 调度会话收到一次 `<work_session_failure>`；取消不触发。
3. **Given** 任务被改为完成，**When** 调用完成，**Then** 任务快照与上报移入 `archive/<taskId>/`，未被其他未完成任务引用的工作会话被归档。

---

### User Story 3 - 从组合包升级无缝衔接 (Priority: P2)

已用组合包该功能的用户升级本插件与已删除该功能的组合包。调度工作区的笔记、上报与归档继续可用，桥接会话的预设选择保持有效。

**Why this priority**: 已有用户的数据与配置不能因迁移丢失。

**Independent Test**: 在使用过组合包该功能的 profile 上升级两者并重启宿主，继续推进一项未完成任务。

**Acceptance Scenarios**:

1. **Given** 调度工作区已有未完成任务，**When** 升级并重启，**Then** `task_update` 能更新该任务，`task_candidates` 能列出其会话。
2. **Given** 桥接会话配置的预设为 `sa-dispatch`，**When** 升级并重启，**Then** 新建的桥接会话使用 `SA-调度会话`。

---

### User Story 4 - 用户在电脑前直接对话 (Priority: P2)

用户在 Web GUI 的调度会话或工作会话直接发言时，会话改为正文回复。下一条飞书消息恢复飞书通知。

**Why this priority**: 两种渠道并存时，回复必须落在用户正在看的地方。

**Independent Test**: 在调度会话先发 Web GUI 消息，再发飞书消息，检查两次切换各插入一条在场提醒。

**Acceptance Scenarios**:

1. **Given** 调度会话处于远程状态，**When** 用户在 Web GUI 发言，**Then** 会话插入本机提醒，回复写在正文。
2. **Given** 调度会话处于本机状态，**When** 收到飞书消息，**Then** 会话插入远程提醒，回复经 `lark_notify` 发送。
3. **Given** 工作会话收到调度会话消息，**When** 模型读取，**Then** 消息包在 `<dispatch_session_message>` 中。

---

### User Story 5 - 只用飞书对话的用户不受影响 (Priority: P3)

不使用调度功能的用户保留现有体验：桥接、提醒、通知与配置页行为不变。

**Why this priority**: 迁移不能改变已有核心功能。

**Independent Test**: 停用调度功能行，或桥接会话使用其他预设，执行现有测试与一次飞书往返。

**Acceptance Scenarios**:

1. **Given** 桥接会话使用标准预设，**When** 收到飞书消息，**Then** 注入、提醒补注与 `lark_notify` 行为与迁移前一致。
2. **Given** 调度功能行被停用，**When** 重启宿主，**Then** 调度工具与 `send_report` 下线，桥接照常工作。

### Edge Cases

- 桥接会话尚未创建或已归档时，`send_report` 返回明确错误，并保留已写入的上报记录。
- 调度工作区不是 git 仓库时，首次写笔记自动初始化；本机没有 git 或未配置作者时，写入成功并在工具结果附带 `warning`。
- `send_report` 的附件不是 Markdown、不存在或越出允许范围时，工具拒绝并说明原因。
- 用户更换调度工作区后，新工作区从空笔记开始，旧工作区数据保留在磁盘。
- 调度功能行被停用时，正在运行的工作会话失去 `send_report`，已写入数据保留。
- 独立安装的 `dsh-plugin-meta-tools` 与 `SA-调度会话` 内的子行同时启用时，同名工具重复注册。
- 本插件与仍含该功能的旧版组合包同时启用时，本插件不做检测与处理。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 本插件 MUST 提供 `SA-调度会话`（id `sa-dispatch`）与 `SA-工作会话`（id `sa-worker`）两个预设，能力与组合包 `main` 一致。
- **FR-002**: `SA-调度会话` MUST 提供 `task_create`、`task_update`、`workspace_note_set`、`workspace_note_remove`、`task_candidates` 与 `dsh-plugin-meta-tools` 的十一项能力，并以 `sa-worker` 作为新建工作会话的预设。
- **FR-003**: `SA-工作会话` MUST 提供 `send_report`，并在轮次以错误结束时通知调度会话一次。
- **FR-004**: 两个预设 MUST 都不含 `ask_user_question`，且都不成为新会话的默认预设。
- **FR-005**: 上报与失败通知 MUST 注入当前桥接会话，注入块格式与组合包一致。
- **FR-006**: 调度数据 MUST 存放在当前桥接工作区，路径、格式、git 提交与归档行为与组合包一致；已有数据无需迁移即可读写。
- **FR-007**: 调度会话 MUST 按消息来源切换用户在场状态，切换时插入一次提醒。
- **FR-008**: 工作会话 MUST 把来自调度会话的消息包进 `<dispatch_session_message>`。
- **FR-009**: 调度功能 MUST 是一行默认启用、可单独停用的功能行；停用时桥接与 `lark_notify` 保持现有行为。
- **FR-010**: 桥接会话的 `sessionPreset` 默认值 MUST 保持空值。
- **FR-011**: 本插件 MUST 随包安装 `dsh-plugin-meta-tools`，版本与组合包 `main` 一致。
- **FR-012**: 现有桥接、鉴权、提醒、通知与配置页行为 MUST 保持不变。
- **FR-013**: 插件中文标题 MUST 为「用飞书和DSH对话」，中文描述 MUST 为「配置lark-cli即可在手机和dsh对话，体验Super Agent！」；英文元数据与 `package.json` 的 `description` 同步。
- **FR-014**: `README.md` MUST 描述调度功能的用法、两个预设、上报格式与数据目录；`docs/` MUST 同步机制、风险与文件地图。
- **FR-015**: 测试 MUST 覆盖迁入的工具、提示词注册、在场判定、消息标记、失败通知、笔记、上报、归档与 git，并回归打包内容与预设补丁。
- **FR-016**: 版本 MUST 发布为 `0.3.0`，`CHANGELOG.md` 记录本次迁入。

### Key Entities

- **调度会话**：使用 `SA-调度会话` 的桥接会话，接收飞书消息、派发任务、转述上报。
- **工作会话**：使用 `SA-工作会话` 的会话，执行任务并上报。
- **任务笔记**：`message-task-status.json` 中的未完成任务，含状态、工作区、会话、上报与消息列表。
- **工作区笔记**：`workspaces.json` 中的工作区说明、关键词与派发白名单。
- **上报记录**：`reports/<taskId>/` 下的 Markdown 记录与附件副本，由 `reportid` 标识。
- **任务归档**：`archive/<taskId>/` 下的任务快照与上报。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 全新 profile 只装本插件后，预设名册中 `SA-调度会话` 与 `SA-工作会话` 各出现 1 次。
- **SC-002**: 组合包该功能的测试场景迁入后全部通过，`pnpm check` 与 `pnpm build` 通过。
- **SC-003**: 一次 `send_report` 在调度会话产生 1 条上报块、在调度工作区产生 1 次 git 提交。
- **SC-004**: 停用调度功能行后，现有桥接测试全部通过，桥接会话的工具集与迁移前一致。
- **SC-005**: 从组合包升级的 profile 中，已有未完成任务的读取与更新成功率为 100%。
- **SC-006**: 实机验证覆盖预设名册、派发任务、`send_report` 注入与停用功能行后桥接照常工作四项，全部通过。

## Assumptions

- 组合包删除该功能由组合包仓库的 `refactor/033-remove-lark-dispatch` 负责，不在本规格范围。
- 本规格基于本仓 `main`；`036`、`037` 合并后按其结果复核在场判定。
- `dsh-plugin-meta-tools` 0.1.7 与本插件依赖的宿主版本 `0.2.2-rc.5` 兼容。
- 调度工作区即本插件配置的 `workspaceRoot`。
- 功能行沿用组合包的行标题「飞书任务与调度会话」，描述去掉「独立安装的 lark-bridge」措辞；逐字文案在计划阶段确认。
- 预设描述沿用组合包文案。
