# 数据模型

## 插件配置

| 字段 | 类型 | 默认值 | 规则 |
| --- | --- | --- | --- |
| `workspaceRoot` | `string` | `''` | 保持现有工作区校验与热重载行为 |
| `sessionTitle` | `string` | `飞书` | 非空，保持现有行为 |
| `authCheckOnStartup` | `boolean` | `true` | 保持现有启动检测行为 |

`larkCli` 从运行时配置、默认值、schema 和前端表单模型中移除。严格配置读取把旧 `larkCli` 与现有 `profile`、`ownerOpenId` 一样接受并丢弃，其他未知键仍然报错。

## CLI 调用

| 项目 | 值 | 说明 |
| --- | --- | --- |
| 命令 | `lark-cli` | 唯一程序来源，由操作系统按普通命令解析 |
| 参数 | `readonly string[]` | 保持参数数组抽象；Windows 仅拼接通过安全字符白名单的参数 |
| 通知正文 | stdin | 使用 `--text -`，正文不进入 Windows shell 命令 |
| 版本策略 | 无最低版本 | `--version` 只用于可执行性探测 |
| 安装与升级 | 用户手动 | 插件不执行安装、升级或下载 |

`LARK_CLI`、包目录解析、入口脚本回退和自定义 `PATH` 目录扫描不再参与调用。macOS/Linux 使用 `shell: false`；Windows 通过受约束 shell 执行 npm 的 `.cmd` shim，动态参数必须匹配 `^[A-Za-z0-9._:+-]+$`，否则返回 `unsafe-arg`。同步启动异常统一映射为 `spawn-failed`。

## 鉴权状态

现有 `cli-missing`、`bot-unavailable`、`user-missing`、`ready` 四阶段保持不变。

- 程序无法启动时进入 `cli-missing`。
- 程序可以启动但鉴权命令失败时保持现有 `bot-unavailable` 与错误详情。
- 不新增版本状态或连通性状态。

## 安装命令展示

| 属性 | 值 |
| --- | --- |
| 文案键 | `auth.installCommand` |
| 内容 | `npm install -g @larksuite/cli@latest && lark-cli config init` |
| 展示条件 | `stage === 'cli-missing'` |
| 展示位置 | 全局鉴权弹窗、配置页鉴权面板 |
| 语言 | 中文与英文字典均提供相同命令 |

命令是只读文本。本次不增加复制按钮、自动执行或安装状态。

## 持久化数据

`$DSH_HOME/lark-bridge/state.json` 的结构与读写规则不变。
