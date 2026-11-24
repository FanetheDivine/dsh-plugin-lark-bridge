# dsh-plugin-lark-bridge

[![npm](https://img.shields.io/npm/v/dsh-plugin-lark-bridge?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-plugin-lark-bridge)

借助 lark-cli，让 DSH 以飞书机器人身份和你私聊对话。

## 使用

1. 安装或升级 lark-cli：

   ```sh
   npm install -g @larksuite/cli@latest
   ```

2. 配置机器人身份：

   ```sh
   lark-cli config init
   ```

3. 登录授权用户：

   ```sh
   lark-cli auth login --scope auth:user.id:read
   ```

4. 在「用飞书和DSH对话」的配置页选择工作区。
5. 在飞书私聊机器人，与 DSH 对话。
