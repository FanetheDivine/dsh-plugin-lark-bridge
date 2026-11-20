# Feature Specification: 桥接会话呈现

**Feature Branch**: `feat/030-bridge-presentation`

**Created**: 2026-11-21

**Status**: Approved

**Input**: User description: "1. 来自用户的飞书消息 改为 飞书桥接会话 2. lark-message外面不要套一层system-reminder 3. icon改为飞书的icon 4. 改readme：README.md:5 改为「借助lark-cli，让DSH以bot身份和你交互」；README.md:16 前置 原样保留，其余全部删除"

## Open Decisions

探索结论（来自代码与宿主包）：

- 桥接会话标题由 `src/constants.ts` 的 `SESSION_TITLE` 固定。复用会话时 `SessionManager.syncMeta` 发现标题变化会追加 `session/title` 并写回状态文件。
- 飞书消息以 `createUserMessage` 注入，`source.kind` 为 `lark-bridge`。宿主 Chat 把 `source.kind !== 'user'` 的消息呈现为 context injection 行。经用户确认，该项是误读，消息呈现无需改动。
- 提醒是一条独立的 `<system-reminder>` 用户消息，`source.reminder` 为 true；`agent/pre-step` 在表层缺失时补回。
- 插件包没有导出图标。同 profile 的其他插件用 `./icon.svg` 与 `files` 声明图标；Plugin Manager 只读包内资源，缺失时显示默认图。
- 飞书官方站点提供 16×16 的三色标志 SVG，可直接作为图标来源。
- README 是插件详情页的回退内容。`docs/how-it-works.md` 链接到 `README.md#前置`；`AGENTS.md` 的文档索引把 README 描述为「功能、安装、配置、工具」。
- 宪章 III 规定 README 归属「功能、安装、配置、工具」。按用户要求删除这些章节属于用户要求优先的偏离，需在 plan 的 Complexity Tracking 记录。

待确认决策：无，全部决策见 `## Clarifications`。

## Clarifications

### Session 2026-11-21

- [D-001] Q: 「lark-message 外面不要套一层 system-reminder」指聊天界面呈现，还是模型请求文本？ -> A: 用户看错，无需改动。
- [D-002] Q: 已存在的桥接会话如何处理新标题？ -> A: 只影响新建会话，已有会话保留旧标题。
- [D-003] Q: README 的保留与删除边界？ -> A: 保留 npm 徽章，删除功能、安装、配置、工具、数据、限制、开发。
- [D-004] Q: 飞书图标用哪种资产？ -> A: 联网搜索 SVG。
- [D-005] Q: 这次行为变化要同步哪些文档与元数据？ -> A: 全部同步：`docs/how-it-works.md` 标题行、`CHANGELOG.md`、`AGENTS.md` 的 README 条目与 `locale/*.json` 的 `meta.description`。
- [D-006] Q: README 删除安装、配置、工具章节与宪章 III 冲突时如何执行？ -> A: 按用户要求执行，并在 plan 的 Complexity Tracking 记录偏离。
- [D-007] Q: 精简后的 README 是否继续作为插件详情页内容？ -> A: 继续使用 README，不新增详情文档。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: README 删除安装/配置/工具章节与宪章 III 冲突；飞书标志为商标资产

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 桥接会话使用新标题 (Priority: P1)

用户在 DSH 侧边栏找到机器人创建的会话，标题显示「飞书桥接会话」。

**Why this priority**: 标题是识别桥接会话的入口，旧标题会被误认为一条用户消息。

**Independent Test**: 新建桥接会话后查看侧边栏标题；对已有桥接会话再发一条飞书消息后复查标题。

**Acceptance Scenarios**:

1. **Given** 尚未创建桥接会话，**When** 收到第一条飞书消息，**Then** 新会话标题为「飞书桥接会话」。
2. **Given** 已有桥接会话且标题为旧文案，**When** 收到下一条飞书消息，**Then** 该会话标题保持旧文案。
3. **Given** 桥接会话已归档，**When** 收到下一条飞书消息，**Then** 新会话标题为「飞书桥接会话」。

---

### User Story 2 - 插件显示飞书图标 (Priority: P2)

用户在插件管理器和插件详情页看到该插件使用飞书图标。

**Why this priority**: 图标帮助用户在插件列表中快速识别。

**Independent Test**: 安装后查看插件列表该插件行与详情页的图标。

**Acceptance Scenarios**:

1. **Given** 插件已安装，**When** 打开插件管理器，**Then** 该插件的行与详情页显示飞书图标。
2. **Given** 图标资源缺失或无法解码，**When** 打开插件管理器，**Then** 显示默认图标，不出现其他插件的图标。

---

### User Story 3 - README 只保留简介与前置 (Priority: P3)

插件用户打开 README，只看到标题、npm 徽章、一句简介和「前置」章节。

**Why this priority**: 用户要求 README 收敛为最短内容。

**Independent Test**: 阅读 README，核对章节与第 5 行文案。

**Acceptance Scenarios**:

1. **Given** 仓库 README，**When** 打开它，**Then** 只包含标题、npm 徽章、一句话简介与「前置」章节。
2. **Given** 简介行，**When** 核对文本，**Then** 内容为「借助lark-cli，让DSH以bot身份和你交互」。
3. **Given** 「前置」章节，**When** 与改动前对比，**Then** 标题、正文、命令与列表内容不变。

---

### Edge Cases

- 桥接会话的表层被压缩后提醒丢失：下一次 `agent/pre-step` 仍要把提醒插到本批第一条飞书消息之前。
- 同一条飞书消息重复到达：去重窗口继续阻止第二次注入。
- 图标文件超过大小上限或格式不支持：Plugin Manager 回落到默认图标，插件仍可加载。
- `docs/how-it-works.md` 指向 `README.md#前置`：删除其他章节后该锚点仍有效。
- 历史会话日志保留旧标题事件：只影响新建会话，不改写历史事件。
- 本地用户在同一桥接会话发消息：按普通用户消息回复，不调用 `lark_notify`。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 新建桥接会话的固定标题 MUST 为「飞书桥接会话」。
- **FR-002**: 已存在的桥接会话 MUST 保留旧标题，复用路径 MUST NOT 改写标题。
- **FR-003**: 飞书消息的呈现与回复提醒行为 MUST 保持现状。
- **FR-004**: 插件包 MUST 包含一个飞书图标资源，并在 manifest 中声明导出与打包。
- **FR-005**: 图标 MUST 在插件管理器的插件行与详情页显示；资源不可用时 MUST 回落默认图标。
- **FR-006**: README MUST 只包含标题、npm 徽章、「借助lark-cli，让DSH以bot身份和你交互」与「前置」章节；「前置」章节内容 MUST 保持改动前原样。
- **FR-007**: 仓库内引用 MUST 不再出现过期标题或与实际行为不符的注入描述。
- **FR-008**: 除本规格列出的变化外，去重、工作区校验、通知工具与提醒补注行为 MUST 保持不变。

### Key Entities

- **桥接会话**：由状态文件记录，含 `sessionId`、归一化工作区路径与固定标题；归档后新建。
- **飞书消息**：一条私聊文本消息，含消息标识、时间与正文；以 `<lark-message>` 块进入会话。
- **桥接提醒**：一条固定中文 `<system-reminder>` 用户消息，说明 `lark_notify` 回复规则。
- **插件图标**：包内单文件 SVG，Plugin Manager 读取并渲染。
- **README**：插件用户文档，同时作为插件详情页的回退内容。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 新建桥接会话的标题显示「飞书桥接会话」；已有桥接会话保持旧标题。
- **SC-002**: 插件管理器的插件行与详情页显示飞书图标，无默认占位图。
- **SC-003**: README 只有标题、npm 徽章、一句话简介与「前置」四部分，简介文本与用户给出一致。
- **SC-004**: `pnpm check` 与 `pnpm build` 通过，打包产物包含图标资源。

## Assumptions

- 图标使用联网获取的飞书官方标志 SVG，商标使用风险由用户承担。
- 标题继续固定，不新增配置项。
- 只影响新建桥接会话的标题，不改写历史事件。
- README 继续作为插件详情页内容，不新增详情文档。