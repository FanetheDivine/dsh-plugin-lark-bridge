# Feature Specification: 完全使用本机 lark-cli

**Feature Branch**: `025-local-lark-cli`

**Created**: 2026-11-20

**Status**: Approved

**Input**: User description: "lark-cli改为完全使用用户本地电脑的 包不放到插件里面了"

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

- [D-001] Q: 是否保留 `larkCli` 配置、`LARK_CLI` 环境变量和自定义 `PATH` 搜索？ -> A: 全部移除。插件只以 `lark-cli` 命令名启动程序，选择结果与用户从命令行调用一致，不提供插件专用配置。
- [D-004] Exploration: 现有实现保留鉴权面板、诊断路由和通知工具注册。程序缺失或无法启动时沿用 `cli-missing`，提示用户按文档安装 `lark-cli`。
- [D-005] Exploration: 用户要求与依赖声明明确排除 `@larksuite/cli` 运行时依赖、相关构建许可与锁文件条目，以及包目录解析和按需下载入口。发布检查同时验证依赖声明和实际产物。
- [D-002] Q: 插件是否承担本机 `lark-cli` 的安装或升级？ -> A: 用户手动安装与升级。插件只检测并调用本机程序，提供安装说明，不执行下载、安装或升级。
- [D-003] Q: 是否新增最低兼容版本的强制检查？ -> A: 不强制最低版本。保持现有 `--version` 可执行性探测，命令不兼容时展示实际错误。
- [D-006] Exploration: 按现有旧配置兼容规则，升级后接受并丢弃 `larkCli`，不展示或读取该值；其他未知配置键仍然报错。
- [D-003] Q: 本机 `lark-cli` 的最低兼容版本应是多少？ -> A: 不做限制。后续另加连通性测试，本次不增加版本检查。
- [D-007] Q: 在哪些界面提供安装并初始化命令？ -> A: `cli-missing` 弹窗和配置页鉴权面板均显示 `npm install -g @larksuite/cli@latest && lark-cli config init`。

## Review Record

- 2026-11-20 | Decision: Changes requested | Scope: current full document | Open items: none | Risks: none
  - 移除 `larkCli` 配置、`LARK_CLI` 环境变量和自定义 `PATH` 搜索，只保留与终端一致的 `lark-cli` 命令调用。
  - 在 `cli-missing` 弹窗和配置页鉴权面板显示安装并初始化命令。
- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: 不检查版本，命令兼容问题通过实际错误暴露。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 使用本机安装运行消息链路 (Priority: P1)

用户已在电脑安装兼容的 `lark-cli`。插件通过该安装接收飞书私聊消息、注入 DSH 会话并发送通知。

**Why this priority**: 本机安装是消息链路唯一的 `lark-cli` 来源，也是本次变更的核心价值。

**Independent Test**: 在发布包不含 `lark-cli` 的环境中，仅提供兼容的本机安装，验证私聊接收、会话注入和通知发送。

**Acceptance Scenarios**:

1. **Given** 用户本机存在兼容的 `lark-cli`，**When** 插件启动并建立连接，**Then** 插件使用该本机安装完成连接。
2. **Given** 插件已通过本机 `lark-cli` 建立连接，**When** 收到飞书私聊消息或调用通知工具，**Then** 现有消息与会话行为保持可用。
3. **Given** 插件目录不存在任何 `lark-cli` 副本，**When** 用户执行上述操作，**Then** 功能仍可完整运行。

---

### User Story 2 - 识别并修复本机程序问题 (Priority: P2)

用户未安装 `lark-cli`，或本机程序无法启动、命令执行失败。用户获得与现有诊断阶段一致的提示或实际错误。

**Why this priority**: 发布包不再提供后备副本，环境诊断直接影响用户能否恢复功能。

**Independent Test**: 分别构造程序缺失、无法启动和命令执行失败的本机环境，检查每个诊断结果与提示。

**Acceptance Scenarios**:

1. **Given** 本机没有可用的 `lark-cli`，**When** 用户启用插件或重新检测，**Then** 界面显示 `cli-missing`，弹窗和配置页鉴权面板均显示 `npm install -g @larksuite/cli@latest && lark-cli config init`。
2. **Given** 本机 `lark-cli` 无法启动，**When** 插件执行可执行性探测，**Then** 界面显示 `cli-missing` 与同一条命令，鉴权面板与重新检测入口保持可用。
3. **Given** 本机程序可以启动但命令执行失败，**When** 插件执行鉴权或通知操作，**Then** 结果保留命令返回的实际错误。
4. **Given** 用户修正本机环境，**When** 重新检测或调用相关功能，**Then** 插件能够使用修正后的安装。

---

### User Story 3 - 获取精简的插件发布包 (Priority: P2)

用户下载或安装插件时，发布包不携带 `lark-cli` 程序或其安装缓存。

**Why this priority**: 发布内容直接兑现「包不放到插件里面」的要求，并可独立检查。

**Independent Test**: 构建并检查实际发布包，确认不存在 `lark-cli` 程序包、独立可执行文件和下载缓存。

**Acceptance Scenarios**:

1. **Given** 插件完成发布构建，**When** 检查发布包内容，**Then** 不存在任何随插件分发的 `lark-cli` 副本。
2. **Given** 发布包已排除 `lark-cli`，**When** 检查插件自身文件，**Then** 插件运行与诊断所需内容仍然完整。

### Edge Cases

- 用户电脑存在多个 `lark-cli` 版本时，插件选择与用户终端调用 `lark-cli` 的结果一致。
- 插件只使用 `lark-cli` 命令名，不提供路径配置、环境变量覆盖或自定义目录搜索。
- 本机程序无法启动时，显示 `cli-missing`、安装并初始化命令、鉴权面板与重新检测入口。
- 插件不判断版本高低；命令失败时展示实际错误，连通性测试由后续功能处理。
- 用户在插件运行期间升级或移除 `lark-cli` 时，后续操作应反映当前环境状态。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 插件 MUST 将用户电脑上的 `lark-cli` 作为消息接收、会话注入与通知发送的唯一程序来源。
- **FR-002**: 插件发布包 MUST NOT 携带 `lark-cli` 程序包、独立可执行文件、下载缓存或后备副本。
- **FR-003**: 插件 MUST 只以 `lark-cli` 命令名启动程序，选择结果 MUST 与用户从命令行调用一致。
- **FR-004**: 用户负责安装和升级本机 `lark-cli`；插件 MUST 提供说明与检测结果，MUST NOT 下载、安装或升级该程序。
- **FR-005**: 插件 MUST 保持现有 `--version` 可执行性探测，不设置最低版本门禁；命令执行失败时 MUST 保留实际错误。
- **FR-006**: 本机程序缺失或无法启动时，插件 MUST 保留鉴权面板与诊断入口，显示 `cli-missing`，并在弹窗和配置页鉴权面板显示 `npm install -g @larksuite/cli@latest && lark-cli config init`。
- **FR-007**: 本机安装可用时，插件 MUST 保持现有飞书私聊接收、DSH 会话注入和用户通知能力。
- **FR-008**: 插件 MUST NOT 在本机安装失效时使用插件自带的 `lark-cli` 作为后备。
- **FR-009**: 用户文档 MUST 说明手动安装与升级、与终端一致的调用方式、不强制最低版本的策略和常见环境问题的处理方法。
- **FR-010**: 发布检查 MUST 能验证实际发布包满足 FR-002。
- **FR-011**: 插件 MUST 移除 `larkCli` 配置项、`LARK_CLI` 环境变量覆盖和自定义 `PATH` 目录搜索。
- **FR-012**: 升级后出现的旧 `larkCli` 配置值 MUST 被接受并忽略，插件不得展示或读取该值。

### Key Entities *(include if feature involves data)*

- **本机 lark-cli 安装**: 用户电脑中的可执行程序，具有实际路径、可用状态和版本信息。
- **插件发布包**: 分发给用户的插件内容，包含插件运行文件，排除本机 `lark-cli` 安装及其缓存。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 对实际发布包进行内容检查时，`lark-cli` 程序包、独立可执行文件、下载缓存和后备副本的数量均为 0。
- **SC-002**: 在仅提供本机兼容安装的环境中，私聊接收、会话注入和通知发送的相关行为测试全部通过。
- **SC-003**: 对程序缺失、无法启动和命令执行失败三类环境分别测试时，前两类均在弹窗和配置页鉴权面板显示 `cli-missing` 与指定安装命令，命令失败均保留实际错误。
- **SC-004**: 在插件目录没有任何 `lark-cli` 副本的全新安装环境中，用户可按文档安装本机程序并建立连接，无需插件专用 `lark-cli` 配置。

## Assumptions

- 插件当前支持的操作系统范围保持不变。
- 用户有权在自己的电脑安装或配置 `lark-cli`。
- 飞书鉴权、消息格式和 DSH 会话语义不属于本次变更范围。
- 连通性测试由后续功能提供。
