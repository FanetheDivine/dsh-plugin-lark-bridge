# Quickstart

## 自动化

```sh
pnpm format && pnpm check
```

## 实机

按 `real-device-test` skill 在真实 DSH 上验证。

1. lark-cli 已配置机器人且用户已授权：配置页无任何凭据输入，状态为就绪，只需填工作区。
2. 在没有 lark-cli 配置的机器上：弹窗与配置页显示 `lark-cli config init` 指引。
3. 在 profile 中保留 `profile: dsh-lark-bridge`、`ownerOpenId: ou_x`：插件正常加载，状态不受影响。
4. 私聊机器人，会话收到注入；`lark_notify` 能把消息发回给授权用户。
