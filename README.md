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

## 工具

`lark_notify` 以 bot 身份给已绑定用户发送飞书私聊消息，只在桥接会话可用。

## 飞书任务与调度会话

本插件提供 `SA-调度会话` 与 `SA-工作会话` 两个预设，用飞书远程派发任务。调度会话接收飞书消息，把任务派给工作会话，并维护任务笔记、上报记录与任务归档。新建的工作会话自动置顶，任务完成后随任务归档。用户在 Web GUI 直接发言时，两个会话都改为正文对话。

启用方式：

1. 完成[前置](#前置)的配置与授权。
2. 在本插件配置页选择调度工作区，并把桥接会话的预设选为 `SA-调度会话`。
3. 本机安装 git，并配置 `user.name` 与 `user.email`。

- `dsh-plugin-meta-tools` 随本插件安装，其能力由 `SA-调度会话` 预设提供。独立安装的 `dsh-plugin-meta-tools` 同时启用时，会重复注册同名工具，应停用其中一处。
- 在 Plugins 页停用「飞书任务与调度会话」行后，调度工具与 `send_report` 下线，飞书对话与 `lark_notify` 照常工作。

### 远程调度用法

1. 在飞书私聊或 Web GUI 的调度会话中说明工作区用途与关键词。调度会话把它写入工作区笔记；只有已登记的工作区可以接收任务。
2. 发送一项新任务。调度会话选择目标工作区，从候选会话中确认复用或新建 `SA-工作会话`；新建的会话立即置顶，再回执目标工作区与执行会话。
3. 工作会话通过 `send_report` 上报进展、提问与结果。调度会话转述给用户，并把用户的回答送回原工作会话。
4. 任务完成后，调度会话把状态改为完成，程序自动归档该任务，并归档该任务的工作会话。

- 调度会话始终把任务派给工作会话，查信息、读文件、改代码、跑构建都在工作会话里做。它自己只在调度工作区读写笔记与报告。
- 在 Web GUI 的调度会话直接发言后，回复与上报转述都写在正文，直到下一条飞书消息恢复飞书通知。
- 在 Web GUI 的工作会话直接发言时，工作会话在正文回答；需求变更、完成与放弃仍上报调度会话，并注明用户在电脑前。
- 没有匹配的工作区时，调度会话先请你新增工作区，或给现有工作区补充说明与关键词。
- 多个工作区都匹配时，调度会话问清目标再派发。

### 两个预设

| 预设 | id | 能力 |
| --- | --- | --- |
| `SA-调度会话` | `sa-dispatch` | 11 个基础工具、`dsh-plugin-meta-tools` 的十一项能力、任务与工作区笔记工具、候选会话查询；`lark_notify` 由本插件主行叠加 |
| `SA-工作会话` | `sa-worker` | 标准预设去掉 `ask_user_question`，增加 `send_report` |

两个预设都不含 `ask_user_question`，也都不是新会话的默认预设。`dsh-plugin-meta-tools` 新建会话时使用 `sa-worker`。其他插件的全局工具仍会叠加进会话。

### 上报与注入

```ts
send_report({ text?: string, files?: string[] })
```

- `text` 承载给用户的话或提问。
- `files` 承载已写好的 Markdown 文件路径，可以省略。
- `text` 与 `files` 至少提供一项。
- 远程模式下工作会话的正文输出对用户不可见，交互与提问通过 `send_report` 完成；用户直接在工作会话发言后改为正文对话。

每次上报以用户消息注入调度会话：

```xml
<work_session_message sessionid="<工作会话 id>" reportid="<上报 id>" taskid="<任务 id 或空>">
<text>
<上报原文>
</text>
<files>
<调度工作区内副本的绝对路径，每行一个>
</files>
</work_session_message>
```

`reportid` 由程序生成。`<text>` 与 `<files>` 始终保留；文件在上报时复制进调度工作区。

### 笔记、git 与归档

全部数据放在调度工作区：

| 路径 | 内容 |
| --- | --- |
| `message-task-status.json` | 未完成任务的笔记，保存状态、工作区、会话、上报与消息列表 |
| `workspaces.json` | 工作区说明、关键词与派发白名单 |
| `reports/<taskId>/` | 每份上报的 Markdown 记录与附件副本 |
| `archive/<taskId>/` | 已完成任务的快照、消息、会话、上报记录与附件 |
| `AGENTS.md` | 调度会话自行维护的工作区做法与长期记忆 |

- 首次写笔记时，程序按需初始化 git 仓库。
- 两份 JSON、上报与任务归档的每次变更由程序提交一次 git，只包含本次变更的文件。
- `AGENTS.md` 由调度会话用文件工具维护，并用 shell 自行提交。
- 任务改为完成时，程序把任务条目及其上报目录移入归档。
- 调度会话上下文由压缩机制控制。
