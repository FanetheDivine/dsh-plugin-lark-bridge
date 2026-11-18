# Quickstart: main 合并门禁

## 1. 创建规则集

```bash
gh api -X POST repos/FanetheDivine/dsh-plugin-lark-bridge/rulesets --input - <<'JSON'
{
  "name": "main-merge-gate",
  "target": "branch",
  "enforcement": "active",
  "conditions": { "ref_name": { "include": ["~DEFAULT_BRANCH"], "exclude": [] } },
  "bypass_actors": [],
  "rules": [
    { "type": "deletion" },
    { "type": "non_fast_forward" },
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "do_not_enforce_on_create": false,
        "required_status_checks": [
          { "context": "Check (typecheck + lint + test:code + build + test:dist)", "integration_id": 15368 },
          { "context": "Publish to npm (trusted publishing)", "integration_id": 15368 }
        ]
      }
    }
  ]
}
JSON
```

## 2. 查看生效规则

```bash
gh api repos/FanetheDivine/dsh-plugin-lark-bridge/rulesets --jq '.[] | {id, name, enforcement}'
gh api repos/FanetheDivine/dsh-plugin-lark-bridge/rules/branches/main \
  --jq '.[] | {type, parameters}'
```

预期：返回 `deletion`、`non_fast_forward`、`required_status_checks` 三条规则，`strict_required_status_checks_policy` 为 `true`，两个 context 都在列表里。

## 3. 验证检查阻断合并

1. 从 `main` 建探测分支，提交一处类型错误。
2. 推送分支并用 `gh pr create --draft` 开 PR。
3. 等 CI 变红后执行 `gh pr merge <编号> --squash`。

预期：合并被拒，提示必需检查未通过。完成后执行 `gh pr close <编号>` 并删除分支。

## 4. 验证直推

```bash
git push origin HEAD:main
```

预期：提交没有通过的 check 时被拒，提示 `required status checks are expected`；`main` 拒绝的原因来自检查规则。

## 5. 验证强推与删除被拒

```bash
git push -f origin HEAD:main
git push origin --delete main
```

预期：两者都被拒，提示受规则集保护。

## 6. 紧急恢复

规则集 `PUT` 需要完整规则体。先取回当前配置，改 `enforcement` 后再提交：

```bash
id=$(gh api repos/FanetheDivine/dsh-plugin-lark-bridge/rulesets --jq '.[0].id')
gh api "repos/FanetheDivine/dsh-plugin-lark-bridge/rulesets/$id" > /tmp/ruleset.json
node -e "const f='/tmp/ruleset.json';const j=require(f);j.enforcement='disabled';require('fs').writeFileSync(f,JSON.stringify(j))"
gh api -X PUT "repos/FanetheDivine/dsh-plugin-lark-bridge/rulesets/$id" --input /tmp/ruleset.json
```

修复后把 `enforcement` 改回 `active` 重复一次。
