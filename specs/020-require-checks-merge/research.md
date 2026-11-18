# Research: main 合并门禁

## R1. 用仓库规则集实现门禁

- Decision: 用 Repository rulesets API 建一条作用于默认分支的规则集。
- Rationale: PR 要求、状态检查、同步、强推与删除限制都是规则集的原生规则；GitHub 已把规则集作为分支保护的主推方式。
- Alternatives considered: 经典 branch protection。能力接近，但 GitHub 后续只在规则集上扩展（如 status check 来源限定），迁移一次成本更高。

## R2. 要求 PR 上全部 check 通过

- Decision: `required_status_checks` 规则列出两个 context，并绑定 GitHub Actions app（`integration_id` 15368）。
- Rationale: PR 头提交上会出现 `Check (typecheck + lint + test:code + build + test:dist)` 与 `Publish to npm (trusted publishing)` 两个 check run。后者因 `if: startsWith(github.ref, 'refs/tags/')` 在 PR 上被跳过；GitHub 把 `skipped`、`neutral`、`success` 都视为成功状态，因此两个 context 都能在 PR 上通过。绑定 app 防止其他集成伪造同名 check。
- Alternatives considered: 只列 `Check`。会放过未来的新 job，不符合「全部 check 通过」。

## R3. 合并前要求分支同步

- Decision: `strict_required_status_checks_policy: true`。
- Rationale: 两个各自通过的 PR 合在一起可能破坏 `main`；strict 让人在最新 `main` 上重跑 CI。这是规则集的默认行为。
- Alternatives considered: merge queue。对单人仓库是额外基础设施，收益低于成本。

## R4. 保留直推，不放 PR 规则

- Decision: 不添加 `pull_request` 规则，PR 合并不作强制要求。
- Rationale: `pull_request` 规则让 `main` 只接受 PR 合并，直推一律被禁；用户要求保留直推。
- Alternatives considered: 加 `pull_request` 规则。与直推要求冲突。

## R5. 直推的边界

- Decision: 接受平台行为：`required_status_checks` 对 ref 更新生效，直推的提交必须带有通过的全部检查。CI 同时在分支推送时运行，先推分支拿到 check，再把同一提交推到 `main`。
- Rationale: 用户同时要求「允许直推」与「全部 check 必须过」。GitHub 对 PR 合并与直推使用同一套检查规则；去掉检查规则会同时失去两者。
- Alternatives considered: 给维护者加 bypass。能随时直推，但同一账号合并 PR 时也绕过检查，门禁形同虚设。

## R6. 不设 bypass

- Decision: `bypass_actors` 为空，管理员同样受限。
- Rationale: 用户要求全部 check 通过；保留 bypass 会让「必须通过」变成可绕过。
- Alternatives considered: 给 admin 留 bypass。恢复通道改为临时 `enforcement: disabled`。

## R7. 验证方式

- Decision: 真机验证：失败的探测 PR 合并被拒、无检查提交直推被拒、强推被拒、规则集读取结果符合预期。
- Rationale: 门禁无本地测面，社区常用做法是让真实 GitHub 拒绝一次操作。
- Alternatives considered: 只读规则配置。无法证明门禁实际生效。
