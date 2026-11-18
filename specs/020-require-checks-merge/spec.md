# Feature Specification: main 合并门禁

**Feature Branch**: `chore/020-require-checks-merge`

**Created**: 2026-11-18

**Status**: Draft

**Input**: User description: "当前仓库配置 pr合并必须所有check都过"

## Clarifications

### Session 2026-11-18

- Q: 保护方式？ → A: 仓库规则集，作用于 `main`。
- Q: 直推与 check 冲突如何取舍？ → A: 允许直推；不放 `require pull request` 规则，但落地的提交仍须通过全部 check。
- Q: 合并前是否要求分支与 main 同步？ → A: 要求 strict。
- Q: 直推前如何拿到通过的 check？ → A: CI 在分支推送时运行 check，直推同一提交时检查已存在。

## User Scenarios & Testing *(mandatory)*

### User Story 1 - check 未通过时无法合并 (Priority: P1)

维护者打开 PR 后，CI 未通过时 GitHub 拒绝合并。

**Why priority**: 这是需求核心，其他规则都围绕它成立。

**Independent Test**: 用一个故意改坏类型检查的探测 PR 验证合并被拒绝。

**Acceptance Scenarios**:

1. **Given** PR 的 CI 失败，**When** 维护者点击合并或执行 `gh pr merge`，**Then** GitHub 拒绝并提示必需检查未通过。
2. **Given** PR 的 CI 通过，**When** 维护者合并，**Then** PR 以 squash 方式合入 `main`。

---

### User Story 2 - 保留直推 (Priority: P1)

维护者不需要 PR 就能把提交推进 `main`；提交必须已经通过全部 check。

**Why priority**: 单人仓库的小改动直接推送比开 PR 快。

**Independent Test**: 把已通过 CI 的提交直接 `git push` 到 `main`，推送成功；推送未跑过 CI 的提交被拒并提示必需检查。

**Acceptance Scenarios**:

1. **Given** 提交在 PR 或分支上已通过全部 check，**When** 执行 `git push origin <sha>:main` 且 `main` 可快进，**Then** 推送成功。
2. **Given** 新提交尚未跑过 CI，**When** 直接推送到 `main`，**Then** GitHub 拒绝并提示必需检查缺失。

---

### User Story 3 - 合并前必须与 main 同步 (Priority: P2)

PR 分支落后于 `main` 时，必须先合入最新 `main` 并重跑 CI，才能合并。

**Why priority**: 两个单独通过的 PR 合在一起可能失败。

**Independent Test**: 让 `main` 前进后，旧分支上的 PR 合并被拒，按提示更新后合并成功。

**Acceptance Scenarios**:

1. **Given** PR 分支落后于 `main`，**When** 尝试合并，**Then** GitHub 要求先更新分支。
2. **Given** 分支已同步且 CI 通过，**When** 合并，**Then** 合并成功。

---

### User Story 4 - main 历史不可破坏 (Priority: P3)

`main` 不能被强推或删除。

**Why priority**: 强推与删除会抹掉已通过的检查结果和发布历史。

**Independent Test**: 对 `main` 执行强推与删除，两者都被拒绝。

**Acceptance Scenarios**:

1. **Given** 本地重写了 `main` 历史，**When** 执行 `git push -f origin main`，**Then** GitHub 拒绝。
2. **Given** 尝试删除远端 `main`，**When** 执行 `git push origin --delete main`，**Then** GitHub 拒绝。

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: 仓库必须有作用于 `main` 的规则集，`enforcement` 为 `active`。
- **FR-002**: 规则集必须包含 `deletion` 与 `non_fast_forward` 规则。
- **FR-003**: 规则集不包含 `pull_request` 规则，直推保持可用。
- **FR-004**: 规则集必须要求全部 check 通过，context 与 `.github/workflows/ci.yml` 的 job 名一致，且限定 GitHub Actions 应用为来源。
- **FR-005**: 规则集必须要求 PR 分支与 `main` 同步后才能合并。
- **FR-006**: 规则集不设 bypass，管理员同样受限。
- **FR-007**: 维护者用一条命令查看当前生效的规则。
- **FR-008**: `docs/development.md` 记录规则、直推前提、查看命令与临时关闭方式。
- **FR-009**: CI 在推送到任意分支时运行 `check` job，直推前可先在分支上拿到通过结果。

### Key Entities

- **规则集**：绑定 `main` 的仓库级规则。
- **check context**：CI job 在提交上产生的状态检查名称。
- **CI workflow**：`.github/workflows/ci.yml`，定义 `check` 与 `publish` 两个 job。

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: CI 失败的 PR 合并被拒，拒绝信息包含未通过的 check 名。
- **SC-002**: CI 通过的 PR 合并成功，`main` 增加一个 commit。
- **SC-003**: 未通过 check 的提交直推 `main` 被拒，拒绝信息指明必需检查。
- **SC-004**: 强推与删除 `main` 均被拒。
- **SC-005**: 查看规则的命令输出包含三条规则、`strict_required_status_checks_policy: true` 与两个 check context。
- **SC-006**: 分支推送跑完 CI 后，同一提交可直接 `git push` 到 `main`，不需要 PR。

## Assumptions

- PR 上出现两个 check：`Check (...)` 实际运行，`Publish to npm (...)` 因 `if` 被跳过；`skipped` 按成功计。
- 直推可用范围由平台决定：只有带上已通过检查的提交才能落地，新提交必须先在某处跑过 CI。
- 仓库为 public，规则集对当前账号可用。
