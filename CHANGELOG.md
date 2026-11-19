# Changelog

## Unreleased

### Added

- `/speckit-worktree-create` 创建 spec 时同步远程全部分支并推送占号分支，同号时按分支名自动改号。
- `/speckit-worktree-finish` 在推送与 PR 前校验编号唯一。
- `.specify/extensions/worktree/scripts/bash/spec-number-lib.sh`：spec 编号解析与同号分支匹配。
- `.specify/extensions/worktree/scripts/bash/check-spec-number.sh`：交付前的编号唯一性校验。
- `tests/worktree-extension.test.ts`：占号、自动改号、远程分支同步与交付前校验用例。

### Changed

- `.specify/extensions/worktree/scripts/bash/create-worktree.sh`：创建前推送占号分支，失败时回滚；编号来自远程最新状态。
- 所有 lark-cli 调用使用 lark-cli 当前生效的配置，不再指定 `--profile`。
- 鉴权阶段收敛为 `cli-missing`、`bot-unavailable`、`user-missing`、`ready`；`bot-unavailable` 提示运行 `lark-cli config init`。
- 用户 open_id 只来自 lark-cli 的 OAuth 授权结果。

### Removed

- 配置页的 App ID、App Secret 与绑定应用，路由 `POST /lark-bridge/app`。
- 配置 `profile` 与 `ownerOpenId`；旧配置中的这两个键在加载时被忽略。

### Fixed

- 插件要求配置机器人 ID，与「桥接 lark-cli 自带 bot 身份」的目标不符。
