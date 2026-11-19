# Feature Specification: 使用 lark-cli 自带的 bot 身份

**Feature Branch**: `fix/022-default-bot-identity`

**Created**: 2026-11-19

**Status**: Draft

**Input**: 用户描述：实现和需求有偏差。插件的目的是为「lark-cli 的 bot 身份」与用户交互搭桥，却要求配置机器人 ID。

**变更类别**: 缺陷修复

## Clarifications

### Session 2026-11-19

- Q: 插件使用哪个 lark-cli 配置档案的 bot 身份？ → A: lark-cli 自带的 bot 身份，即 lark-cli 当前生效的配置。插件不创建、不指定、不删除配置档案，也不接收 App ID 与 App Secret。
- Q: 用户 open_id 从哪里得到？ → A: 始终通过 lark-cli 的 OAuth 授权得到。取消手填 open_id 的覆盖入口。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 无需填写机器人信息即可就绪 (Priority: P1)

用户已在 lark-cli 中配置好机器人。安装插件后，配置页不出现 App ID、App Secret 或档案名输入框，插件直接使用该机器人。

**Why this priority**: 插件的目的是桥接 lark-cli 已有的 bot 身份。要求重复配置机器人偏离需求，并让用户多维护一份凭据。

**Independent Test**: 在 lark-cli 已配置机器人的机器上安装插件，打开配置页，只完成用户授权和工作区即可就绪。

**Acceptance Scenarios**:

1. **Given** lark-cli 已配置机器人且 bot 身份可用，**When** 用户打开配置页，**Then** 页面没有 App ID、App Secret、绑定应用与档案名入口。
2. **Given** lark-cli 的 bot 身份可用，**When** 插件执行鉴权检查，**Then** 鉴权阶段越过 bot 检查，直接进入用户授权检查。
3. **Given** 插件收发消息，**When** 调用 lark-cli，**Then** 使用 lark-cli 当前生效的配置，命令不指定档案。

---

### User Story 2 - lark-cli 未配置机器人时给出指引 (Priority: P1)

lark-cli 没有可用的机器人配置时，插件说明这是 lark-cli 自身的前置条件，并指引用户在终端完成配置。

**Why this priority**: 插件不再代为录入凭据，缺失时用户需要明确的下一步。

**Independent Test**: 在 lark-cli 未配置机器人的机器上打开 GUI，确认弹窗与配置页显示 lark-cli 配置指引。

**Acceptance Scenarios**:

1. **Given** lark-cli 未配置机器人，**When** 插件加载，**Then** 状态为「bot 身份不可用」，弹窗与配置页提示先用 lark-cli 配置机器人，并给出命令。
2. **Given** 用户在终端完成 lark-cli 配置，**When** 点击重新检测，**Then** 状态推进到下一阶段。
3. **Given** lark-cli 未安装，**When** 插件加载，**Then** 状态为「缺少 lark-cli」，行为与现状一致。

---

### User Story 3 - 用户身份只走 lark-cli OAuth (Priority: P1)

用户 open_id 只来自 lark-cli 的 OAuth 授权结果。配置页保留授权入口，不提供手填 open_id。

**Why this priority**: 授权是确定「已绑定用户」的唯一可信来源，避免手填错误或越权绑定。

**Independent Test**: 清空授权后配置页处于「待授权」，完成设备码授权后就绪；配置里不再有 open_id 字段。

**Acceptance Scenarios**:

1. **Given** bot 可用但用户未授权，**When** 点击开始授权，**Then** 显示授权链接，授权完成后就绪并显示授权用户。
2. **Given** 旧版本保存的配置含 `profile` 或 `ownerOpenId`，**When** 插件加载，**Then** 插件正常启动，忽略这些字段，不影响鉴权结果。
3. **Given** 鉴权就绪，**When** 收到私聊消息或调用通知工具，**Then** 只与授权用户交互，行为与现状一致。

---

### Edge Cases

- lark-cli 存在多个档案：使用 lark-cli 当前生效的那一个，插件不切换。
- lark-cli 的当前档案缺少 bot 身份：状态为「bot 身份不可用」，并提示检查 lark-cli 配置。
- 旧版本插件创建的专用档案 `dsh-lark-bridge` 仍存在：插件忽略它，不删除。
- 用户授权令牌失效：沿用现有行为，状态回到待授权。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件 MUST 使用 lark-cli 当前生效配置的 bot 身份，调用 lark-cli 时不指定配置档案。
- **FR-002**: 插件 MUST NOT 接收、保存或转发 App ID 与 App Secret，MUST NOT 创建、修改或删除 lark-cli 配置档案。
- **FR-003**: 配置页与弹窗 MUST NOT 出现 App ID、App Secret、绑定应用与档案名入口。
- **FR-004**: 鉴权阶段 MUST 为 lark-cli 可用性、bot 身份可用性、用户授权三项；bot 身份不可用时 MUST 提示用户在终端用 lark-cli 配置机器人。
- **FR-005**: 用户 open_id MUST 只来自 lark-cli 的 OAuth 授权结果；插件 MUST NOT 提供手填 open_id 的配置。
- **FR-006**: 配置页 MUST 保留开始授权、取消授权、重新检测与授权链接显示。
- **FR-007**: 旧配置中的 `profile` 与 `ownerOpenId` MUST 被容忍并忽略，MUST NOT 导致插件加载失败。
- **FR-008**: 消息监听、过滤、去重、会话注入与通知工具的行为 MUST 保持不变，仅切换到 lark-cli 当前生效配置。
- **FR-009**: README 与 docs MUST 描述新的前置条件：先用 lark-cli 配置好机器人并使其 bot 身份可用。
- **FR-010**: 中英文文案 MUST 同步更新，移除已废弃的文案。

### Key Entities

- **鉴权状态**: 当前阶段、失败原因、bot 身份状态、授权用户与最后检测时间。
- **桥接设置**: 工作区路径、会话标题、lark-cli 可执行文件覆盖、启动检查开关。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: lark-cli 已配置机器人的用户，只需完成用户授权与工作区，2 分钟内达到就绪。
- **SC-002**: 配置页与弹窗中机器人凭据输入项的数量为 0。
- **SC-003**: 升级前保存过 `profile` 或 `ownerOpenId` 的用户，升级后插件 100% 正常加载。
- **SC-004**: lark-cli 未配置机器人时，用户在弹窗或配置页中一步内看到配置命令。

## Assumptions

- 用户已按 lark-cli 文档在终端完成机器人配置，bot 身份来自 lark-cli 的远程配置。
- 飞书开放平台的事件订阅与权限仍需用户手动配置。
- 插件仍服务一个已授权用户与一个工作区。
- `lark-cli` 可执行文件覆盖与启动检查开关保留。
