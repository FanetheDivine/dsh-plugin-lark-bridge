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

## 关于两个预设

本插件提供 `SA-调度会话` 与 `SA-工作会话` 两个预设，用飞书远程派发任务。

- 在「插件」页保持这两行启用。
- 在「用飞书和DSH对话」的配置页，把「预设」设为 `SA-调度会话`。
