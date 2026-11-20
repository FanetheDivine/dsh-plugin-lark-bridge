# dsh-plugin-lark-bridge

[![npm](https://img.shields.io/npm/v/dsh-plugin-lark-bridge?logo=npm&label=npm)](https://www.npmjs.com/package/dsh-plugin-lark-bridge)

DSH 插件：通过 lark-cli 的 bot 身份接收飞书私聊消息，注入所选工作区的 DSH 会话；AI 可以调用工具以 bot 身份回复用户。

## 功能

- 飞书私聊消息以 `<system-reminder>` 注入桥接会话，标明发送者与时间。
- 桥接会话标题固定为「来自用户的飞书消息」；首次消息创建并置顶会话，之后复用。
- CLI、bot、user 分别显示连接状态、终端命令和检测按钮。
- 工作区只能从当前 DSH 注册列表中选择；未选择或注册失效时显示共用设置弹窗。
- `lark_notify` 工具让 AI 以 bot 身份给已绑定用户发送消息。

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

## 安装

```sh
dsh plugin add dsh-plugin-lark-bridge
```

npm 包：[dsh-plugin-lark-bridge](https://www.npmjs.com/package/dsh-plugin-lark-bridge)。

插件包不包含 lark-cli。

## 配置

打开“设置 → 插件 → dsh-plugin-lark-bridge”：

1. 查看 CLI、bot、user 的连接状态。状态未连接时，复制对应命令到终端执行，再点击该区域的检测按钮。
2. 从“工作区”选择框中选择当前已注册的工作区并保存。

插件每次加载和打开 GUI 时都会完整检测。定时刷新只读取已有状态。

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `workspaceRoot` | 空 | 已注册工作区的 Linux 风格路径，例如 `/d/Git` |

工作区未选择或已从注册列表删除时，插件停止监听飞书事件并显示选择弹窗。弹窗可以暂时关闭；下次打开 GUI 或出现新的失效时会再次提示。监听停止期间不补投历史消息。

## 工具

| 工具 | 参数 | 行为 |
| --- | --- | --- |
| `lark_notify` | `text` | 以 bot 身份向已绑定用户发送私聊消息；过长文本按顺序拆分 |

工具只接受已绑定用户，不能指定其他接收目标。

## 数据

- 桥接会话标识、归一化工作区路径与去重窗口保存在 `$DSH_HOME/lark-bridge/state.json`。
- 归档当前桥接会话后，下一条消息自动创建新会话。
- 插件不读取或保存机器人凭据。

## 限制

- 只处理已绑定用户与机器人的单聊；群聊消息被忽略。
- 一个插件实例服务一个用户与一个工作区。
- 飞书开放平台的事件订阅与权限需要手动配置。
- lark-cli 需要手动安装与升级，插件不检查最低版本。
- 插件只通过 `lark-cli` 命令名调用本机程序。
- 完整检测使用 `--verify`，需要网络；界面只显示笼统连接状态，诊断信息查看后端日志。
- 工作区路径在插件内部统一为 Linux 风格，调用宿主 API 时转换为原生路径。

## 开发

见 [docs/development.md](./docs/development.md)。
