# Feature Specification: 迁移模板热更新与前端链接规则

**Feature Branch**: `027-template-sync`

**Created**: 2026-11-20

**Status**: Approved

**Input**: User description: "本项目基于 dsh-plugin-template 模板构建。查看模板最近的两个 commit，将相关变更迁移到本项目。"

## Open Decisions

无。

## Clarifications

### Session 2026-11-20

- [D-005] Exploration: 模板 `fe93cd0` 改动实机 skill、`setup-env.sh`、`run-test.mjs` 与 CHANGELOG；模板 `197480e` 只改动 `docs/development.md` 与 CHANGELOG。本项目对应文件与模板 `197480e` 的版本一致，开发文档缺少「前端 UI 链接」一节。
- [D-006] Exploration: 本项目 `specs/021` 已被 `021-spec-number-uniqueness` 占用，模板规格目录无法按原编号放入。
- [D-007] Exploration: 前端唯一 `href` 在 `src/client/auth-panel.tsx`，值来自 `lark-cli` 返回的 `verification_url`。
- [D-008] Exploration: 本项目实机 skill 的后端与浏览器用例沿用模板的 `demo_echo` 与 `prefix`，本插件没有这些对象，用例当前无法在本插件上运行。
- [D-001] Q: 是否复制模板的 `specs/020-hot-plugin-update` 与 `specs/021-frontend-absolute-links`？ -> A: 不复制，用本项目 `027` 规格记录迁移范围与决策。
- [D-002] Q: 实机 skill 中模板专属的对象如何处理？ -> A: 只改新增的热更新段：文件与触发方式改为 `src/tools.ts` 的 `lark_notify`，断言依据改为 `requests.jsonl` 的 `tools` 字段；其余 demo 用例保持原样。
- [D-004] Q: 是否同时审计并修正现有前端 `a` 标签？ -> A: 只增加文档规则。现有 `href` 由 `lark-cli` 返回完整地址，不做修改。
- [D-003] Q: 本次是否在真实宿主上执行热更新回归？ -> A: 不做完整实机回归。目标是热更新能力，前端文档顺带修改；验收用 `pnpm check` 与模板 diff 核对。

## Review Record

- 2026-11-20 | Decision: Approved | Scope: current full document | Open items: none | Risks: 实机 demo 用例保持模板原样，当前不能在本插件运行；本次不做完整实机回归。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 实机环境构建后热更新（优先级：P1）

维护者用链接方式安装被测插件并启用 HMR。修改插件代码后重新构建，运行中的 web profile 实例按新代码工作，前端页面同步更新，宿主进程与会话保持可用。

**Why it matters**：每次改动都重装插件并重启宿主，实机迭代成本高于编写代码，长会话也会中断。

**Independent Test**：搭建实机 profile 并启动 GUI，在会话中触发插件行为；修改代码并构建；再次触发同一行为，确认结果按新代码变化，进程号与会话不变。

**Acceptance Scenarios**:

1. **Given** 实机 profile 以链接方式安装插件，**When** 仓库构建成功，**Then** 运行中的实例在数秒内加载新代码，宿主不重启。
2. **Given** 实例中有进行中的会话，**When** 插件热更新完成，**Then** 会话历史、工作区与连接保持可用。
3. **Given** 前端产物重新构建，**When** 热更新完成，**Then** 已打开的页面显示新前端行为，无需刷新。
4. **Given** 构建失败，**When** 维护者再次触发插件行为，**Then** 旧代码继续工作，失败原因可观察。

---

### User Story 2 - 按 skill 在同一实例中迭代（优先级：P2）

Agent 按实机 skill 操作时，在已启动的实例上完成「改代码 → 构建 → 观察 → 重跑用例」，不重装插件，不重启宿主。一轮结束时删除 profile。

**Why it matters**：模型按 skill 执行；skill 保留重装与重启步骤时，热更新链路不会被使用。

**Independent Test**：按更新后的 skill 完成一次插件改动，检查步骤中是否出现重装命令或宿主重启，并确认改动在同一实例中可见。

**Acceptance Scenarios**:

1. **Given** 实机实例已启动，**When** Agent 修改插件代码并构建，**Then** Agent 在同一实例中观察新行为。
2. **Given** 一轮实机测试结束，**When** Agent 执行清理步骤，**Then** profile 被删除，下一轮重新搭建。
3. **Given** 热更新未生效，**When** Agent 查阅排错表，**Then** 能找到安装方式、HMR 配置与构建产物三类原因及处理方式。

---

### User Story 3 - 开发文档约束前端链接（优先级：P2）

模型开发插件前端 UI 时，按 `docs/development.md` 的规则把 `a` 标签写成完整 URL，读者在 Desktop 中点击即可打开目标。

**Why it matters**：Desktop 用应用内地址加载前端页面，相对链接指向应用地址，点击打不开目标。

**Independent Test**：打开 `docs/development.md` 前端章节，读到完整 URL 的要求、示例与原因。

**Acceptance Scenarios**:

1. **Given** 模型按文档编写前端 UI，**When** 添加指向外部页面的链接，**Then** `href` 是含协议与主机的完整 URL。
2. **Given** 维护者查阅 `docs/development.md`，**When** 阅读前端章节，**Then** 看到要求与原因，示例指向本仓库。

### Edge Cases

- 旧 profile 按打包副本安装：本轮不兼容，每轮实机结束后删除 profile，下一轮重新搭建。
- 构建产物损坏或导入失败：实例保留已加载代码，修正后再次构建可恢复。
- 仓库路径含 `.dsh` 等点目录：HMR 默认忽略 `**/.*`，需要在配置中调整。
- 只改 `src` 未构建：实例行为不变，skill 要求先构建再观察。
- 非 HTTP 链接：写完整协议，例如 `mailto:`。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 实机搭建脚本 MUST 以链接方式安装被测插件，让宿主加载仓库当前构建产物。
- **FR-002**: 实机 profile MUST 启用 HMR 并监听仓库 `dist`。
- **FR-003**: 仓库构建成功后，运行中的 web profile 实例 MUST 加载新插件代码，无需重启宿主或重装插件。
- **FR-004**: 热更新 MUST 保留宿主进程、会话、工作区与页面连接；前端产物 MUST 在已打开页面自动更新。
- **FR-005**: 装载用例 MUST 校验宿主加载的版本与产物和仓库一致。
- **FR-006**: 实机 skill MUST 说明「改代码 → 构建 → 观察 → 重跑用例」的迭代方式，明确不重装、不重启。
- **FR-007**: 实机 skill MUST 说明一轮结束时删除 profile，下一轮重新搭建。
- **FR-008**: 实机 skill MUST 提供热更新排错条目，覆盖安装方式、HMR 配置、构建产物与前端延迟。
- **FR-009**: 实机报告结构 MUST 包含热更新验证一节。
- **FR-010**: `docs/development.md` MUST 在前端章节后写明：前端 UI 里 `a` 标签的 `href` MUST 使用完整 URL。
- **FR-011**: 该规则 MUST 说明原因：Desktop 用应用内地址加载页面，相对链接打不开目标。
- **FR-012**: 该规则的示例 URL MUST 指向本项目仓库。
- **FR-013**: `CHANGELOG.md` MUST 记录实机热更新与前端链接规则两项变更。
- **FR-014**: 本次改动 MUST 只涉及 skill、开发文档与变更记录，插件运行代码与现有前端链接保持不变。
- **FR-015**: 新热更新验证段 MUST 以 `src/tools.ts` 中 `lark_notify` 的说明文本为改动对象，并以 profile 的 `requests.jsonl` 中 `tools` 字段为断言依据。
- **FR-016**: 其余模板 demo 用例 MUST 保持原样，本次不做适配。

### Key Entities

- **web profile 实例**：运行中的宿主进程，持有会话、工作区、插件加载图与热更新通道。
- **插件加载源**：宿主实际导入的产物位置；链接安装下即仓库 `dist`。
- **实机 profile**：搭建脚本生成的隔离配置、链接安装记录与测试驱动脚本集合。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: skill 的迭代步骤与 `setup-env.sh` 的输出中，「重装插件」与「重启宿主」出现在迭代流程的次数为 0。
- **SC-002**: 装载用例的断言比较 profile 链接安装的版本与仓库版本、加载产物哈希与仓库 `dist` 哈希，内容与模板 `fe93cd0` 一致。
- **SC-003**: 维护者打开 `docs/development.md` 一次即可读到链接要求、原因与本仓库示例。
- **SC-004**: `pnpm check` 通过，改动范围内不含插件运行代码与现有前端链接的修改。

## Assumptions

- 模板最近两个 commit 为 `fe93cd0`（实机热更新）与 `197480e`（前端链接规则）。
- 两个 commit 的可移植内容为实机 skill、`docs/development.md` 与 `CHANGELOG.md`。
- 模板规格目录不复制，迁移范围与决策由本项目 `027` 记录。
- 实机 demo 用例的适配另立变更；本次只保证新增热更新段与本插件一致。
- 本次不做完整实机回归；验收以 `pnpm check` 与模板 diff 核对为准。
- 宿主的 HMR 服务可在 web profile 上启用并监听仓库 `dist`。
- 构建由 `pnpm build` 或 `pnpm dev` 产生 `dist/`，实机搭建前仓库已构建完成。
- 实机测试只读插件代码；验证用的临时改动在报告中说明。
- CHANGELOG 按变更各记一条，写入 `Unreleased` 的 `Changed`。
