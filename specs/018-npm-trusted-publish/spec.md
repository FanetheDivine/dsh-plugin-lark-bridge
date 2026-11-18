# Feature Specification: 发布到 npm 并配置 Trusted Publishing

**Feature Branch**: `chore/018-npm-trusted-publish`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "在npm上发这个包 并配置trusted publishing"

## Clarifications

### Session 2026-11-18

- Q: 首次发布与绑定 Trusted Publisher 需要 npm 凭据，选择哪种方式？ → A: 用户在本机终端运行 `npm login --auth-type=web`，Agent 后续步骤使用会话凭据。
- Q: `0.1.0` 是否需要再发一次？ → A: 只手工发布一次 `0.1.0` 建立包，tag 触发的发布检测到同版本已存在时跳过。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - 首次发布到 npm (Priority: P1)

维护者把 `dsh-plugin-lark-bridge@0.1.0` 发布到 npm 公共注册表，任何用户都能按包名安装。

**Why this priority**: 包名在 npm 上可查到是全部后续工作的前提，Trusted Publisher 只能绑定已存在的包。

**Independent Test**: 在任意机器执行 `npm view dsh-plugin-lark-bridge version` 返回 `0.1.0`，并用 `npm pack` 结果核对包内容。

**Acceptance Scenarios**:

1. **Given** 包名尚未被占用，**When** 维护者发布 `0.1.0`，**Then** `npm view dsh-plugin-lark-bridge version` 返回 `0.1.0`。
2. **Given** 发布完成，**When** 用户安装该包，**Then** 得到 `dist/index.mjs`、`dist/client.js`、类型声明、`cordis.patch.yml`、`locale/*.json` 与 `README.md`。
3. **Given** 发布完成，**When** 查看 npm 包页，**Then** 仓库、主页与问题跟踪链接指向 GitHub 仓库。

---

### User Story 2 - CI 使用 Trusted Publishing 发布 (Priority: P1)

维护者推送版本 tag，CI 使用 OIDC 换取发布凭据完成发布，仓库不再保存长期 npm 令牌。

**Why this priority**: 长期令牌是最容易被泄露的发布凭据；OIDC 发布同时生成 provenance，让用户能核对产物来源。

**Independent Test**: 打一个版本 tag 并推送，观察 CI 的 `publish` job 在无 `NPM_TOKEN` 的情况下成功，且 npm 包页出现 provenance 记录。

**Acceptance Scenarios**:

1. **Given** Trusted Publisher 已绑定仓库与 workflow 且目标版本尚未发布，**When** 推送 `v*` tag，**Then** `publish` job 成功发布对应版本。
2. **Given** 该次发布完成，**When** 查看 npm 包页的 provenance，**Then** 来源指向本仓库与触发发布的 commit。
3. **Given** 仓库没有任何 npm 令牌 secret，**When** 执行发布，**Then** 发布仍然成功。

---

### User Story 3 - 重复发布不阻塞 CD (Priority: P2)

首次手工发布与 tag 发布可能指向同一版本；重复发布时 CI 跳过并保持成功。

**Why this priority**: 首次发布必须手工完成，之后打 tag 会再触发一次同版本发布；失败记录会掩盖真实问题。

**Independent Test**: 对已存在于 registry 的版本推送 tag，`publish` job 跳过发布并以成功状态结束。

**Acceptance Scenarios**:

1. **Given** registry 已有 `0.1.0`，**When** 推送 `v0.1.0` tag，**Then** `publish` job 检测到版本已存在并跳过发布。
2. **Given** registry 没有目标版本，**When** 推送 tag，**Then** `publish` job 执行发布。

---

### User Story 4 - 发布流程可查阅 (Priority: P3)

维护者按文档完成绑定与发布，用户按文档完成安装。

**Why this priority**: Trusted Publisher 的绑定参数必须与仓库中的 workflow 一致，文档是唯一能核对两者的地方。

**Independent Test**: 只按文档操作，能完成一次绑定与一次 tag 发布。

**Acceptance Scenarios**:

1. **Given** 仓库文档，**When** 维护者按步骤绑定 Trusted Publisher，**Then** 使用的仓库名、workflow 路径与环境值与 CI 配置一致。
2. **Given** README 的安装说明，**When** 用户执行安装命令，**Then** 无需额外步骤即可加载插件。

### Edge Cases

- 包名已被他人占用时，发布失败并提示改名，不改动 CI。
- npm 账号开启双因子认证时，手工发布需要一次性口令或网页授权。
- 首次手工发布后未绑定 Trusted Publisher，tag 发布失败并提示绑定缺失。
- 仓库或 workflow 文件改名后，已有绑定失效，发布失败并提示重新绑定。
- 网络受限时打 tag 的发布失败，重跑同一 tag 的 job 即可重试。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: npm 公共注册表 MUST 提供 `dsh-plugin-lark-bridge`，初始版本 `0.1.0`。
- **FR-002**: 发布内容 MUST 由 `npm pack` 决定，包含 `dist`、`cordis.patch.yml`、`locale/*.json` 与 `README.md`。
- **FR-003**: `package.json` MUST 声明 `repository`、`homepage`、`bugs` 与 `license`，指向 `https://github.com/FanetheDivine/dsh-plugin-lark-bridge`。
- **FR-004**: npm 包的 Trusted Publisher MUST 绑定 GitHub 仓库 `FanetheDivine/dsh-plugin-lark-bridge` 与 workflow `.github/workflows/ci.yml`，环境留空。
- **FR-005**: 推送 `v*` tag MUST 触发 CI 的 `publish` job，用 OIDC 换取一次性凭据，仓库不保存 npm 令牌。
- **FR-006**: `publish` job 在 registry 已存在目标版本时 MUST 跳过发布并保持 job 成功。
- **FR-007**: 由 CI 完成的发布 MUST 生成 provenance，来源指向本仓库与触发 commit。
- **FR-008**: `pnpm run release` MUST 在检查与格式化后递增版本、归档 CHANGELOG、推送 commit 与 tag。
- **FR-009**: README 的安装节 MUST 给出基于 npm 包名的安装命令。
- **FR-010**: `docs/development.md` MUST 记录 Trusted Publisher 的绑定参数与 tag 发布步骤。
- **FR-011**: 首次发布 MUST 由维护者使用本人 npm 凭据执行，之后的版本由 CI 发布。
- **FR-012**: 发布 `0.1.0` 后 MUST 创建并推送 `v0.1.0` 标签；该 tag 触发的 `publish` job MUST 在版本已存在时跳过，不重复发布同一版本。
- **FR-013**: 包元数据 MUST 保留 `engines.node` 的 `>=24.9.0` 约束。

### Key Entities

- **npm 包**：名称 `dsh-plugin-lark-bridge`，版本、tarball 内容、README、元数据链接。
- **Trusted Publisher 绑定**：提供方 GitHub Actions、仓库、workflow 文件路径、环境、允许的动作（publish）。
- **发布 job**：触发条件（`v*` tag）、所需权限（`id-token: write`、`contents: read`）、跳过条件。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 发布后任意机器执行 `npm view dsh-plugin-lark-bridge version` 返回 `0.1.0`。
- **SC-002**: `npm trust list dsh-plugin-lark-bridge` 返回 1 条 GitHub Actions 绑定，仓库与 workflow 与 FR-004 一致。
- **SC-003**: 推送 `v0.1.0` tag 后，`publish` job 在没有 npm 令牌 secret 的情况下跳过发布并以成功状态结束。
- **SC-004**: 新用户按 README 的一条安装命令安装后，能在插件列表中看到并启用本插件。
- **SC-005**: 从下一个由 CI 发布的版本开始，npm 包页显示 provenance；tarball 只含 FR-002 列出的内容。

## Assumptions

- npm 账号拥有 `dsh-plugin-lark-bridge` 名称的发布权；当前 registry 对该名称返回未找到。
- GitHub 仓库 `FanetheDivine/dsh-plugin-lark-bridge` 保持公开，默认分支为 `main`。
- CI 使用 Node 24 与 pnpm 11.7.0，与现有 workflow 一致。
- 发布权限由维护者本人持有，Agent 不保存用户凭据。
- `0.1.0` 是引导版本，手工发布不带 provenance；provenance 从 CI 发布的版本开始生成。
