# dsh-plugin-lark-bridge

[![npm](https://img.shields.io/npm/v/dsh-plugin-lark-bridge?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-plugin-lark-bridge)

借助lark-cli，让DSH以bot身份和你交互

## 前置

插件使用本机 lark-cli 当前生效的配置，调用结果与在终端运行 `lark-cli` 一致。

1. 安装或升级 CLI：

   ```sh
   npm install -g @larksuite/cli@latest
   ```

2. 配置 bot 身份：

   ```sh
   lark-cli config init
   ```

3. 登录授权用户：

   ```sh
   lark-cli auth login --scope auth:user.id:read
   ```

4. 在飞书开放平台为该应用启用机器人能力，订阅 `im.message.receive_v1` 事件并选择“接收单聊消息”。
5. 授予读取单聊消息与以机器人身份发消息的权限，例如：
   - `im:message.p2p_msg:readonly`
   - `im:message:send_as_bot`

插件不执行安装、初始化或登录。用户登录只请求 `auth:user.id:read`，会替换同一 lark-cli 配置原有的用户授权范围。
