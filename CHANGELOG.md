# Changelog

## Unreleased

### Changed

- `main` 启用规则集 `main-merge-gate`：合并与直推都要求全部 check 通过，禁止强推与删除。
- CI 在推送到分支时运行 `check` job，直推前可先在分支上拿到通过结果。
- `docs/development.md` 记录合并门禁的规则、查看命令与临时关闭方式。
