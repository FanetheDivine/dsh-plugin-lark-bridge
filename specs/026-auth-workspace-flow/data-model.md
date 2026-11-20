# 数据模型

## 插件配置

| 字段 | 类型 | 默认值 | 规则 |
| --- | --- | --- | --- |
| `workspaceRoot` | `string` | `''` | 空值表示未选择；非空值统一为 Linux 风格 `/c/work/demo`，转换为 Host 原生路径后必须解析到当前已注册工作区 |

`sessionTitle` 与 `authCheckOnStartup` 从 schema、运行时配置和前端表单删除。严格配置读取把这两个键与既有 `profile`、`ownerOpenId`、`larkCli` 一样接受并忽略，其他未知键仍然报错。

## 固定会话标题

| 属性 | 值 |
| --- | --- |
| 常量 | `SESSION_TITLE` |
| 中文与英文界面共用值 | `来自用户的飞书消息` |
| 使用位置 | 新建会话、复用会话的 `syncMeta`、状态文件中的 `title` |

标题不参与国际化，不提供用户编辑入口。

## 连接状态

```ts
type ConnectionState = 'checking' | 'connected' | 'disconnected'

interface AuthSnapshot {
  cli: ConnectionState
  bot: ConnectionState
  user: ConnectionState
  ready: boolean
  checkedAt: number
  appId?: string
  userName?: string
  ownerOpenId?: string
  detail?: string
}
```

- `appId`、`userName`、`detail` 只用于 Host 内部日志。
- `ownerOpenId` 用于私聊过滤和通知，只在整体就绪时提供。
- `checking` 用于首次检测；检测过程中保留上一份已检测状态，按钮单独呈现忙碌状态。
- 每次完整检测更新 `checkedAt`，并发调用共享结果。

## 浏览器安全状态

```ts
interface BridgeStatus {
  cli: ConnectionState
  bot: ConnectionState
  user: ConnectionState
  ready: boolean
  checkedAt: number
}
```

该投影不包含 URL、原始错误、App ID、用户名、open_id、token、scope、会话标识或会话错误。

## 工作区选择

### 浏览器选项

| 字段 | 来源 | 用途 |
| --- | --- | --- |
| `workspaceId` | `WorkspaceView.workspaceId` | React key 与当前列表行标识 |
| `title` | `WorkspaceView.title` | 选项显示名 |
| `path` | `WorkspaceView.path` 经统一归一化 | select 值、路径标签与保存到 `workspaceRoot` 的 Linux 风格路径 |

选择有效性的最终依据是 Host `workspaceRegistry.resolveByPath(toHostPath(workspaceRoot))` 返回当前工作区。浏览器比较归一化路径，Windows 路径忽略大小写，POSIX 路径保持大小写敏感。浏览器不创建注册项。

### 状态转换

| 当前状态 | 事件 | 下一状态与动作 |
| --- | --- | --- |
| 未选择 | GUI 打开 | 显示共用设置弹窗，事件桥停止 |
| 未选择 | 保存有效选项 | 配置热重载，校验为有效；鉴权就绪时启动事件桥 |
| 有效 | 注册项删除 | 校验为无效，停止事件桥并提示重新选择 |
| 有效 | 配置路径变化 | 重新解析；按解析结果控制事件桥 |
| 无效 | 弹窗暂时关闭 | 保持无效与事件桥停止，当前失效签名不重复弹窗 |
| 无效 | 出现新的失效或下次 GUI 加载 | 再次显示弹窗 |

保存与注册删除并发时，注入前再次执行注册校验；校验失败不创建会话、不自动补注册。

## 桥接会话持久化

`$DSH_HOME/lark-bridge/state.json` 的字段与去重窗口保持不变：

- `sessionId`
- `workspaceRoot`：Linux 风格归一化路径。
- `title`
- `seen`
- `updatedAt`

删除公开的 `resetSession` 操作。归档会话恢复失败后沿用现有逻辑创建新会话并覆盖当前会话字段。