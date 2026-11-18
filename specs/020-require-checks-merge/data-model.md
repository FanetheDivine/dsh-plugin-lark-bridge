# Data Model: main 合并门禁

## 规则集

| 字段 | 值 | 说明 |
| --- | --- | --- |
| `name` | `main-merge-gate` | 仓库内唯一 |
| `target` | `branch` | 作用于分支 |
| `enforcement` | `active` | 立即生效 |
| `conditions.ref_name.include` | `["~DEFAULT_BRANCH"]` | 跟随默认分支，改默认分支后规则跟着走 |
| `rules` | 见下表 | 三条规则 |
| `bypass_actors` | `[]` | 无豁免 |

## 规则

| 规则 | 参数 | 满足的需求 |
| --- | --- | --- |
| `deletion` | — | 禁止删除 `main` |
| `non_fast_forward` | — | 禁止强推 |
| `required_status_checks` | `strict_required_status_checks_policy: true`、两个 context、`integration_id: 15368` | 全部 check 通过、分支同步；直推按同一规则校验 |

## check context

| context | 来源 workflow | PR 上的状态 |
| --- | --- | --- |
| `Check (typecheck + lint + test:code + build + test:dist)` | `.github/workflows/ci.yml` 的 `check` job | 实际运行 |
| `Publish to npm (trusted publishing)` | 同文件的 `publish` job | 跳过，按成功计 |

## 状态转换

| 当前 | 事件 | 结果 |
| --- | --- | --- |
| `active` | 维护者需要紧急恢复 | 改用 `disabled` 后恢复直推 |
| `disabled` | 故障排除完成 | 改回 `active` |
