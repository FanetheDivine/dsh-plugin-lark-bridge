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

## 关于调度会话

本插件提供 `SA-调度会话` 预设，用于派发与统一管理任务会话。

- 桥接会话默认使用 `SA-调度会话` 预设，可在「用飞书和DSH对话」配置页查看或更改。
- 向调度会话发消息会在已登记的工作区新建任务会话；给出已有会话的 id 也可接管它或取消管理。
- 让调度会话列出当前可用的模型时，它会用 `list_models` 查询宿主模型目录，并可用结果指定任务会话的模型。
- 「调度会话」配置页可设置「普通任务模型」、「复杂任务模型」、默认任务类型与「任务会话预设」；未选择时跟随宿主默认。
- 任务会话成功上报后，对话里出现一张上报卡片，显示类型、任务简介、正文与附件，轮次折叠后仍可见。点击附件在右侧栏打开。

## 回复渠道

桥接会话的回复经飞书送达：完整内容在飞书通知里，正文最多一句概述。任务会话需要你决定时，经调度会话向你提问，不会停在等待回答的界面上。
