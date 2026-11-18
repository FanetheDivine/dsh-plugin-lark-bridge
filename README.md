# dsh-plugin-lark-bridge

DSH 插件：通过 lark-cli 的 bot 身份接收飞书私聊消息，注入指定工作区的 DSH 会话；AI 可以调用工具以 bot 身份回复用户。

## 功能

- 飞书私聊消息以 `<system-reminder>` 注入桥接会话，标明发送者与时间。
- 首次消息在工作区创建会话、设置标题并置顶；之后复用同一会话。
- `lark_notify` 工具让 AI 以 bot 身份给已绑定用户发送消息。
- 每次安装与启动检查 lark-cli、应用凭据、bot 身份与用户授权；失败时显示弹窗。
- 配置页完成全部鉴权：填写 App ID/Secret、绑定应用、设备码授权、重新检测。

## 前置

在飞书开放平台创建自建应用，并完成：

1. 启用机器人能力，把机器人添加为可用范围。
2. 订阅 `im.message.receive_v1` 事件，选择“接收单聊消息”。
3. 授予读取单聊消息与以机器人身份发消息的权限，例如：
   - `im:message.p2p_msg:readonly`
   - `im:message:send_as_bot`
4. 记录 App ID 与 App Secret。

插件使用独立的 lark-cli 配置档案，不需要终端里已登录 lark-cli。

## 安装

```sh
dsh plugin add dsh-plugin-lark-bridge
```

安装后插件依赖 `@larksuite/cli`。首次使用会确保 CLI 二进制可用，网络受限时需要能访问 npm 或 GitHub Releases。

## 配置

打开“设置 → 插件 → dsh-plugin-lark-bridge”：

1. 在鉴权面板填写 App ID 与 App Secret，点击“绑定应用”。
2. 点击“开始授权”，在浏览器完成飞书登录。
3. 填写工作区绝对路径，保存。

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `workspaceRoot` | 空 | 桥接会话所属工作区，必须是已存在的绝对路径 |
| `sessionTitle` | `飞书` | 桥接会话标题 |
| `profile` | `dsh-lark-bridge` | 插件专用 lark-cli 配置档案 |
| `larkCli` | 空 | 覆盖 lark-cli 可执行文件；空值使用插件依赖 |
| `ownerOpenId` | 空 | 覆盖授权得到的用户 open_id |
| `authCheckOnStartup` | `true` | 每次加载检查鉴权 |

App Secret 只写入 lark-cli 的专用配置，不进入插件配置。

## 工具

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `lark_notify` | `text` | 以 bot 身份向已绑定用户发送私聊消息；过长文本按顺序拆分 |

工具只接受已绑定用户，不能指定其他接收目标。

## 数据

- 桥接会话标识与去重窗口保存在 `$DSH_HOME/lark-bridge/state.json`。
- 点击配置页的“重置桥接会话”会清除会话标识，下一条消息新建会话。
- 插件不读取或保存 App Secret。

## 限制

- 只处理已绑定用户与机器人的单聊；群聊消息被忽略。
- 一个插件实例服务一个用户与一个工作区。
- 飞书开放平台的事件订阅与权限需要手动配置。

## 开发

见 [docs/development.md](./docs/development.md)。