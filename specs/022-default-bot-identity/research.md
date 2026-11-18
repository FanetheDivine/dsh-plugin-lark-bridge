# Research: 使用 lark-cli 自带的 bot 身份

## 1. 不指定 `--profile` 时 lark-cli 使用哪个配置

- Decision: 所有调用省略 `--profile`，由 lark-cli 解析当前生效配置。
- Rationale: 实测 `lark-cli auth status` 在不带 `--profile` 时返回当前配置的 `appId` 与 `identities.bot`。`profile list` 的 `effective` 字段标出生效档案。
- Alternatives considered: 保留可选档案名配置。用户已明确插件只用 lark-cli 自带的 bot，选项多余。

## 2. 未配置机器人时的表现

- Decision: `auth status` 失败或 `identities.bot.status` 不是 `ready` 一律归为 `bot-unavailable`，错误输出写入 `detail`。
- Rationale: 阶段只需回答「用户下一步做什么」，两种情况的答案相同：在终端用 lark-cli 配置机器人。
- Alternatives considered: 保留 `app-missing`。它依赖 `profile list` 与档案名，随专用档案一并删除。

## 3. 配置指引内容

- Decision: `bot-unavailable` 的提示文案包含 `lark-cli config init`，并说明完成后点击重新检测。
- Rationale: `lark-cli config init` 是 lark-cli 官方的应用初始化命令，在终端交互完成，凭据只进入 lark-cli。
- Alternatives considered: 在页面内代为执行 `config init`。这会重新引入凭据录入，违背需求。

## 4. 用户授权对默认配置的影响

- Decision: 授权流程保持 `auth login --no-wait --json --scope auth:user.id:read`，仅在阶段为 `user-missing` 时可用。
- Rationale: 已有用户登录时 `auth status` 已提供 open_id，阶段直接为 `ready`，不触发授权。
- Risk: 默认配置中用户令牌被丢弃或过期后，重新授权的令牌只含最小 scope，会替换终端里原有授权范围。记入 [known-risks.md](../../docs/known-risks.md)。
- Alternatives considered: 沿用手填 open_id 绕过授权。用户明确要求始终走 OAuth。

## 5. 旧配置兼容

- Decision: `resolveConfig` 接受并丢弃 `profile` 与 `ownerOpenId`，其他未知键仍报错。
- Rationale: 旧版 `cordis.patch.yml` 与已保存的 profile 可能含这两个键。严格拒绝会让升级后的插件加载失败。
- Alternatives considered: 全部未知键放宽。会掩盖用户的拼写错误，已知风险文档明确要求严格校验。

## 6. 旧专用档案

- Decision: 插件不清理 `dsh-lark-bridge` 档案。
- Rationale: 插件不再管理档案。删除会触碰用户的 lark-cli 数据。
