# Data Model

## AuthStage

| 值 | 判定 | 用户下一步 |
| --- | --- | --- |
| `cli-missing` | `lark-cli --version` 无法启动 | 安装 lark-cli |
| `bot-unavailable` | `auth status` 失败，或 `identities.bot.status` 不是 `ready` | 终端执行 `lark-cli config init` 后重新检测 |
| `user-missing` | bot 就绪，`identities.user.openId` 缺失 | 配置页开始授权 |
| `ready` | bot 就绪且 `identities.user.openId` 存在 | 无 |

## AuthSnapshot

`stage`、`ready`、`appId`（只读展示）、`botStatus`、`userName`、`ownerOpenId`（授权用户）、`checkedAt`、`detail`。

删除字段：`profile`。

## PluginConfig

`workspaceRoot`、`sessionTitle`、`larkCli`、`authCheckOnStartup`。

删除字段：`profile`、`ownerOpenId`。旧输入中的这两个键被接受并丢弃。
