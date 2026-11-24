# Feature Specification: README 面向使用者

**Feature Branch**: `docs/041-readme-user-focus`

**Created**: 2026-11-24

**Status**: Approved

**Input**: User description: "优化readme 当前版本内容太多 技术细节太多 没有面向使用者"

## Open Decisions

无。

### 探索结论

- README 只写中文，与当前 README 和插件中文元数据一致。
- DSH 的 Plugin Manager 把 README 作为插件详情页展示，并把相对链接渲染为纯文本。
- 测试只校验 `README.md` 进包，不依赖其内容。
- 主行「用飞书和DSH对话」的配置页字段为工作区、模型、预设，并显示 lark-cli、机器人身份、用户身份三项连接状态。
- Plugins 页的两个预设行标题为 `SA-调度会话` 与 `SA-工作会话`。
- `docs/` 已覆盖预设组成、注入格式、存储结构、git 提交、权限缺失后果、meta-tools 重复与登录替换授权范围。
- `docs/` 未覆盖的 README 信息：
  - 飞书开放平台的配置步骤：启用机器人、订阅 `im.message.receive_v1` 并选择接收单聊消息、授予 `im:message.p2p_msg:readonly` 与 `im:message:send_as_bot`。
  - 远程调度需要本机安装 git，并配置 `user.name` 与 `user.email`。
  - `send_report` 的 `text` 与 `files` 至少提供一项。
  - 只有已登记的工作区可接收任务；无匹配时先请用户新增或补充工作区，多个匹配时先问清目标。
  - 派发后回执目标工作区与执行会话。
  - 停用「飞书任务与调度会话」行后，飞书对话与 `lark_notify` 照常工作。

## Clarifications

### Session 2026-11-24

- [D-001] Q: README 采用什么章节结构，各节写什么？ -> A: 三节：简介 → 使用 → 关于两个预设。简介为一句话用途与 npm 徽章。使用为前置三条命令 → 配置页选择工作区 → 飞书私聊机器人对话。关于两个预设主要说明两点：在 Plugins 页保持 `SA-调度会话` 与 `SA-工作会话` 两行启用；主行配置页的「预设」设为 `SA-调度会话`。
- [D-002] Q: 从 README 移除的技术细节如何处置？ -> A: `docs/` 已覆盖的删除，未覆盖的迁入 `docs/how-it-works.md`。
- [D-003] Q: 是否新增「安装插件」步骤？ -> A: 不新增。
- [D-004] Q: 前置写到什么粒度？ -> A: 只保留三条命令：安装 CLI、`lark-cli config init`、`lark-cli auth login --scope auth:user.id:read`。飞书开放平台步骤与授权范围说明移出 README。
- [D-005] Q: 远程派发的用法保留多少？ -> A: 不保留。
- [D-006] Q: 是否增加常见问题或链接 `docs/`？ -> A: 都不增加。
- [D-007] Q: 工具如何介绍？ -> A: 不介绍。
- [IMPL-001] Q: 简介写在一级标题下，SC-002 的二级标题数按几个计？ -> A: 两个，README 草稿保持不变。

## Review Record

- 2026-11-24 | Decision: Approved | Scope: current full document | Open items: none | Risks: 不介绍工具与宪章 III 的内容归属不一致，按用户要求执行；README 不含飞书开放平台步骤与 docs 链接，新用户可能遗漏平台配置；README 未提示停用「飞书任务与调度会话」行的影响

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 新用户按 README 开始在飞书对话 (Priority: P1)

一位 DSH 用户在 npm、GitHub 或 DSH 插件详情页看到本插件。他从 README 得知插件用途，执行三条命令、在配置页选择工作区，然后在飞书私聊机器人与 DSH 对话。

**Why this priority**: 上手是使用者读 README 的首要目的。

**Independent Test**: 读者只看 README 完成配置，统计其间查阅 `docs/` 或代码的次数。

**Acceptance Scenarios**:

1. **Given** 读者打开 README，**When** 读完简介，**Then** 他能说出插件用途：用飞书私聊与 DSH 对话。
2. **Given** 读者从未配置过 lark-cli，**When** 依次执行 README 的三条命令，**Then** 配置页的 lark-cli、机器人身份、用户身份三项都显示已连接。
3. **Given** 连接就绪，**When** 读者按 README 在配置页选择工作区并在飞书私聊机器人，**Then** 消息进入 DSH 会话。

---

### User Story 2 - 用户保持预设可用 (Priority: P2)

用户想用飞书远程派发任务。他从 README 得知需要保持两个预设行启用，并把主行配置的预设设为 `SA-调度会话`。

**Why this priority**: 预设被停用或改选后，远程派发失效且插件不提示。

**Independent Test**: 读者只看「关于两个预设」一节，能在 Plugins 页找到两行并核对主行预设。

**Acceptance Scenarios**:

1. **Given** 读者在 Plugins 页，**When** 按 README 检查，**Then** 他确认 `SA-调度会话` 与 `SA-工作会话` 两行处于启用状态。
2. **Given** 读者打开主行配置页，**When** 按 README 检查「预设」，**Then** 其值为 `SA-调度会话`。

### Edge Cases

- README 同时在 npm、GitHub 与 DSH Plugin Manager 详情页展示，因此正文不含相对链接。
- 飞书开放平台配置、git 前置与远程调度规则移出 README 后，仍可在 `docs/how-it-works.md` 查到。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: README MUST 只包含三节，依次为简介、使用、关于两个预设。
- **FR-002**: 简介 MUST 用一句话说明插件用途，并保留 npm 徽章。
- **FR-003**: 使用 MUST 依次给出三条前置命令、在主行配置页选择工作区、在飞书私聊机器人对话。
- **FR-004**: 关于两个预设 MUST 说明两点：
  - 在 Plugins 页保持 `SA-调度会话` 与 `SA-工作会话` 两行启用。
  - 主行配置页的「预设」设为 `SA-调度会话`。
- **FR-005**: README MUST 省略以下内容：飞书开放平台步骤、授权范围说明、远程调度用法、工具介绍、预设组成、注入格式、存储结构、git 规则、常见问题与指向 `docs/` 的链接。
- **FR-006**: 从 README 移除且 `docs/` 未覆盖的信息 MUST 迁入 `docs/how-it-works.md`，范围见探索结论。
- **FR-007**: README 与 `docs/` MUST 无相互复述，符合宪章 III。
- **FR-008**: README MUST 遵循 `AGENTS.md` 写作规范。
- **FR-009**: README 中的命令、预设名、行名与配置项名 MUST 与插件当前界面一致。

### Key Entities

- **README.md**：面向插件使用者的入口文档，在 npm、GitHub 与 DSH 插件详情页展示。
- **docs/how-it-works.md**：承接从 README 移出且未被覆盖的信息。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: README 不超过 40 行。
- **SC-002**: README 的二级标题恰好两个：使用、关于两个预设。简介紧跟一级标题。
- **SC-003**: README 不含工具签名、XML 示例、存储文件表与相对链接，数量为 0。
- **SC-004**: 当前 README 的每条信息都能在新 README 或 `docs/` 找到唯一归属，遗漏数为 0。
- **SC-005**: `pnpm format && pnpm check` 通过，package-pack 测试仍确认 `README.md` 进包。

## Assumptions

- 范围限于 `README.md` 与 `docs/how-it-works.md`。`package.json` 的 `description` 与插件元数据文案保持不变。
- 插件功能不变，本次只调整文档。
- README 不加入截图。
- CHANGELOG 按宪章 III 在 push 或 merge 时补充条目。
