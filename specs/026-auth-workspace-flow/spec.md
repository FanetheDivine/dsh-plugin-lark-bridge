# Feature Specification: 独立鉴权与工作区选择流程

**Feature Branch**: `026-auth-workspace-flow`

**Created**: 2026-11-20

**Status**: Approved

**Input**: User description: "1. 先检测lark-cli是否安装；2. user&bot两种身份独立检测，分别把鉴权/登录命令贴出来让用户自己鉴权自己检测，不展示鉴权url，也不展示报错信息，只笼统地展示连接状态；3. 工作区只能在当前注册的workspace中选择select组件，没选择的或者已选但工作区被删除的要出弹窗让用户选；4. 启动时检测鉴权删了，必检测；5. 重置桥接会话删除，用户自己归档；6. 会话标题改为来自用户的飞书消息。"

## Open Decisions

<!--
Status values:
- Draft: the current full document is not approved or waived.
- Approved: the user approved the current full document.
- Waived: the user waived the review and accepted the recorded risks.
Record each undecided question with a stable id and its dependencies.
-->

无。

## Clarifications

### Session 2026-11-20

- [D-006] Exploration: `resolveConfig` 已将旧键 `profile`、`ownerOpenId` 与 `larkCli` 接受并丢弃，避免升级后加载失败。`authCheckOnStartup` 删除后沿用该兼容规则，不需要用户决策。
- [D-007] Exploration: `lark-cli auth status --json` 同时返回 bot 与 user 状态；`--verify` 额外向服务器验证 token。界面独立展示两种身份，D-004 已确认自动与手动完整检测均使用 `--verify`。
- [D-008] Exploration: 现有会话恢复失败时已经会创建新会话，归档后的下一条消息不依赖「重置桥接会话」。
- [D-009] Exploration: 当前注入路径会在注册表找不到工作区时自动创建注册项。新流程必须改为只接受已注册工作区，不能在注入时补注册。
- [D-010] Exploration: 当前事件监听在鉴权未就绪时停止，没有离线消息队列。工作区无效时沿用该语义，本次不增加历史消息补投。
- [D-011] Exploration: 浏览器可通过 `useWorkspaces` 订阅当前注册工作区，删除会实时从列表移除；后端可通过 `workspaceRegistry.list/get/resolveByPath` 校验。宿主没有公开 `Select` 组件，使用原生 `select` 即可满足选择交互。
- [D-001] Q: 会话标题是固定为「来自用户的飞书消息」，还是仅把默认值改为该文案并保留编辑能力？ -> A: 固定标题并删除 `sessionTitle` 设置，所有桥接会话统一使用「来自用户的飞书消息」。
- [D-002] Q: 鉴权未就绪与工作区未选择的提示共用一个设置弹窗，还是按状态分别弹出？ -> A: 共用一个设置弹窗，分区展示 CLI、bot、user 连接状态与工作区选择。
- [D-003] Q: 三种状态分别展示哪些命令？ -> A: CLI 展示 `npm install -g @larksuite/cli@latest`；bot 展示 `lark-cli config init`；user 展示 `lark-cli auth login --scope auth:user.id:read`。
- [D-004] Q: 自动检测与手动检测分别如何触发？ -> A: 每次加载插件与打开 GUI 时使用 `--verify` 自动完整检测；CLI、bot、user 三个区域分别提供检测按钮，每个按钮执行完整检测并更新全部状态；定时刷新只读取已有状态。
- [D-005] Q: 工作区弹窗是否允许暂时关闭？ -> A: 允许关闭，期间暂停飞书事件监听；下次打开 GUI 或选择再次失效时重新提示。
- [D-012] Exploration: 固定标题后，旧配置中的 `sessionTitle` 沿用 D-006 的旧键兼容规则，接受并忽略。

## Review Record

- 2026-11-20 | Decision: Draft | Scope: current full document | Open items: none | Risks: 完整规格待审查；`--verify` 依赖网络；最小权限登录会替换同一 lark-cli 配置的现有用户授权范围；监听停止期间不补投历史消息。
- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: `--verify` 依赖网络；最小权限登录会替换同一 lark-cli 配置的现有用户授权范围；监听停止期间不补投历史消息。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 按连接状态自行完成环境准备 (Priority: P1)

用户打开插件设置，先看到本机 `lark-cli` 的安装状态。CLI 可用后，再分别看到 bot 与 user 的连接状态及对应命令。用户在终端自行执行命令，再主动检测，界面只反馈笼统状态。

**Why this priority**: 用户需要在不接触插件内部鉴权流程的情况下恢复消息链路。

**Independent Test**: 分别构造 CLI 缺失、bot 未连接、user 未连接和两者均就绪的环境，检查状态、命令、检测入口与消息链路。

**Acceptance Scenarios**:

1. **Given** 本机没有可用的 `lark-cli`，**When** 用户打开设置或弹窗，**Then** 先显示 CLI 未连接状态和安装命令，界面不展示鉴权 URL 或原始错误。
2. **Given** CLI 可用且 bot 与 user 状态不同，**When** 完成检测，**Then** 两种身份分别显示自己的连接状态与对应命令，一个身份就绪不会掩盖另一个身份的状态。
3. **Given** 用户在终端完成某一步配置或登录，**When** 用户执行对应检测，**Then** 对应状态更新，其他身份的检测结果保持独立。
4. **Given** 任一检测命令失败，**When** 界面显示结果，**Then** 只显示笼统的未连接状态与恢复命令，不显示原始报错或鉴权 URL。
5. **Given** CLI、bot 与 user 均已就绪且工作区有效，**When** 收到符合现有规则的私聊，**Then** 消息接收、会话注入与通知能力保持可用。

---

### User Story 2 - 从已注册工作区选择消息目标 (Priority: P2)

用户通过选择框从当前 DSH 已注册的工作区中选择消息目标。未选择或所选工作区已删除时，界面弹出选择提示；用户完成有效选择后，后续消息进入该工作区。

**Why this priority**: 工作区直接决定消息投递位置，选择范围必须与宿主当前状态一致。

**Independent Test**: 使用多个已注册工作区，覆盖初次选择、正常选择、删除后重新选择和目录仍存在但注册已删除的情况。

**Acceptance Scenarios**:

1. **Given** 当前存在多个已注册工作区，**When** 用户打开工作区选择框，**Then** 选项仅来自当前注册列表，且没有手工输入任意路径的入口。
2. **Given** 尚未选择工作区，**When** 用户打开 GUI，**Then** 出现工作区选择弹窗，完成选择后保存并用于后续消息。
3. **Given** 已选工作区从当前注册列表删除，**When** 插件再次检测工作区状态，**Then** 即使磁盘目录仍存在也判定选择失效并提示重新选择。
4. **Given** 工作区未选择或选择失效，**When** 收到飞书私聊，**Then** 消息不会注入其他工作区；用户完成有效选择后，新消息按现有规则投递。
5. **Given** 注册列表在插件运行期间变化，**When** 用户再次打开选择框，**Then** 列表反映当前注册状态。

---

### User Story 3 - 使用精简且固定的会话规则 (Priority: P3)

用户不再需要管理启动检测开关或手动重置桥接会话。插件始终执行必要检测，会话归档由用户使用 DSH 已有能力完成，新消息按统一标题规则进入会话。

**Why this priority**: 删除重复控制可以减少配置负担，同时保留宿主已有的会话管理能力。

**Independent Test**: 检查配置页字段、插件加载时的检测行为、归档后的下一条消息以及会话标题。

**Acceptance Scenarios**:

1. **Given** 用户打开配置页，**Then** 页面不包含「启动时检测鉴权」「重置桥接会话」与会话标题编辑控件。
2. **Given** 插件加载或用户打开 GUI，**When** 自动检测运行，**Then** 不需要任何配置开关即可执行。
3. **Given** 用户归档当前桥接会话，**When** 下一条符合条件的飞书消息到达，**Then** 插件按现有恢复规则创建新会话。
4. **Given** 插件创建或复用桥接会话，**When** 设置会话标题，**Then** 标题固定为「来自用户的飞书消息」，配置页不提供标题编辑入口。

### Edge Cases

- CLI 缺失时，bot 与 user 不显示误导性的已连接状态。
- bot 未连接时仍能独立检测 user，user 未连接时仍能独立检测 bot。
- 鉴权状态轮询期间发生命令失败时，界面只更新笼统状态。
- 已选工作区被删除、重命名或替换后，以当前注册列表判断有效性。
- 当前没有已注册工作区时，选择框展示空状态，弹窗不提供任意路径输入。
- 用户在弹窗打开期间删除候选工作区时，保存前再次验证选择。
- 旧配置含有 `authCheckOnStartup` 或 `sessionTitle` 时接受并忽略，界面与运行逻辑均不读取它们。
- 用户归档桥接会话后，不需要插件提供的重置操作即可开始新会话。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件 MUST 先检测本机 `lark-cli` 是否可用，再展示两种身份的检测状态。
- **FR-002**: CLI 不可用时，界面 MUST 展示笼统的未连接状态与 `npm install -g @larksuite/cli@latest`，MUST NOT 展示鉴权 URL 或原始报错。
- **FR-003**: CLI 可用时，插件 MUST 独立检测并展示 bot 与 user 的连接状态；任一身份的结果 MUST NOT 代替或隐藏另一身份的结果。
- **FR-004**: bot 区域 MUST 展示 `lark-cli config init`，user 区域 MUST 展示 `lark-cli auth login --scope auth:user.id:read`。
- **FR-005**: 插件界面 MUST NOT 提供插件内启动授权、展示授权链接或取消授权的交互；用户自行在终端执行命令。
- **FR-006**: 连接状态区域 MUST 只展示笼统状态、对应命令与检测入口，MUST NOT 展示鉴权 URL、原始报错、App ID、用户名、open_id、token 或 scope。
- **FR-007**: 每次加载插件与打开 GUI 时，插件 MUST 使用 `--verify` 自动完整检测；CLI、bot、user 区域 MUST 分别提供检测按钮，每个按钮执行完整检测并更新全部状态；定时刷新 MUST 只读取已有状态。
- **FR-008**: 「启动时检测鉴权」配置控件 MUST 删除，必要检测 MUST 始终执行。
- **FR-009**: 工作区设置 MUST 使用选择组件，选项 MUST 仅来自当前 DSH 已注册工作区，MUST NOT 接受任意路径输入。
- **FR-010**: 未选择工作区或已选工作区不在当前注册列表时，插件 MUST 在共用设置弹窗中提示用户选择；弹窗 MUST 允许暂时关闭，并在下次打开 GUI 或选择再次失效时重新提示。
- **FR-011**: 工作区选择无效时，插件 MUST 暂停飞书事件监听与消息注入，MUST NOT 将消息投递到其他工作区。
- **FR-012**: 用户完成有效工作区选择后，插件 MUST 保存选择并将后续消息投递到该工作区。
- **FR-013**: 「重置桥接会话」控件 MUST 删除；会话生命周期 MUST 使用 DSH 的归档能力与现有恢复规则。
- **FR-014**: 桥接会话标题 MUST 固定为「来自用户的飞书消息」，配置页 MUST NOT 提供标题编辑入口。
- **FR-015**: 旧配置中的 `authCheckOnStartup` 与 `sessionTitle` MUST 被接受并忽略，界面与运行逻辑 MUST NOT 读取它们。
- **FR-016**: 除本规格明确的流程与界面调整外，现有私聊过滤、消息去重、会话注入和 `lark_notify` 行为 MUST 保持不变。
- **FR-017**: 用户文档 MUST 同步说明终端鉴权、工作区选择、必检测与归档会话的使用方式。
- **FR-018**: CLI、bot、user 任一未连接或工作区无效时 MUST 显示共用设置弹窗；三者均连接且工作区有效时 MUST 隐藏弹窗。弹窗沿用现有鉴权提示的可关闭行为，新的失效状态 MUST 能再次触发提示。

### Key Entities *(include if feature involves data)*

- **CLI 连接状态**: 本机 `lark-cli` 是否可用，以及对应的终端恢复命令。
- **bot 连接状态**: 机器人身份是否可用，与用户身份状态相互独立。
- **user 连接状态**: 用户身份是否可用，并提供消息归属所需的 open_id。
- **工作区选择**: 用户从当前已注册工作区中选定的消息目标；注册关系变化会影响其有效性。
- **桥接会话**: 与有效工作区关联的 DSH 会话，由用户通过归档结束复用。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CLI 缺失、bot 未连接、user 未连接、两者均就绪四类环境中，界面状态与对应命令的测试全部通过，鉴权 URL 与原始报错出现次数均为 0。
- **SC-002**: bot 与 user 的四种就绪组合分别测试时，两个身份的状态均独立且准确。
- **SC-003**: 初次未选择、正常选择和注册删除三种场景中，工作区选项 100% 来自当前注册列表，无效选择导致的消息误投递次数为 0。
- **SC-004**: 配置页中「启动时检测鉴权」「重置桥接会话」与会话标题编辑控件数量均为 0，插件加载与打开 GUI 的必检测测试全部通过。
- **SC-005**: 归档桥接会话后的下一条消息能够按现有规则创建新会话，所有新建与复用会话的标题均为「来自用户的飞书消息」。
- **SC-006**: 现有私聊接收、去重、会话注入和通知回归测试全部通过。

## Assumptions

- 「当前注册的 workspace」指运行该插件的 DSH profile 当前可解析的工作区集合。
- 工作区是否有效由注册关系决定，磁盘目录是否存在不能替代注册校验。
- 用户有权在自己的终端安装 `lark-cli`、配置 bot 并登录 user。
- 飞书私聊权限、事件订阅和消息过滤规则不在本次变更范围内。
- 用户通过 DSH 已有的会话归档功能结束桥接会话复用。