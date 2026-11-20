# 验证指南

## 前置

- Node.js 24.9 及以上。
- pnpm 11。
- 本机 Chrome，用于真实 GUI 验证。
- 实机飞书链路验证前，由用户在终端完成 bot 配置和 user 登录。

## 自动验证

1. 运行 `pnpm i`。
   - 新增宿主依赖与其他 `@deepseek-ai/dsh-*` 均为 `0.2.2-rc.3`。
   - `pnpm-workspace.yaml` 包含对应 `minimumReleaseAgeExclude`。
2. 运行 `pnpm format && pnpm check`。
   - 类型检查、lint 和源码测试通过。
   - 鉴权测试覆盖 CLI 不可用、命令失败、bot/user 四种组合、`--verify` 和并发去重。
   - 配置测试证明旧 `sessionTitle` 与 `authCheckOnStartup` 被忽略，其他未知键仍被拒绝。
   - 会话测试证明固定标题、归档后新建和禁止自动注册工作区。
   - 客户端测试证明共用弹窗、select、三条命令、失效重开和无敏感状态展示。
3. 运行 `pnpm build`。
   - Host 与 Client 产物构建成功。
   - 产物新鲜度、Client 注册契约和 package-pack 测试通过。
4. 运行 `npm pack --dry-run --json`。
   - 包内包含最新 `dist`、`cordis.patch.yml`、README 与 locale 资源。
   - 包内不包含 `src`、`tests` 或测试 profile 文件。

## 真实宿主验证

使用隔离 profile，模型使用 mock，会话与存储指向 profile 内目录。测试命令中的路径使用 `<repo>`、`<profile>` 等占位符，实际值不写入仓库。

### A. 装载与配置

1. 构建并用 `pnpm pack` 安装插件。
2. 启动真实 DSH 0.2.2-rc.3 profile。
3. 检查插件激活、安装版本和 dist 哈希与仓库一致。
4. 配置中保留旧 `sessionTitle` 与 `authCheckOnStartup` 启动一次。
   - 插件仍激活。
   - 配置页没有标题、启动检测或重置会话控件。

### B. 连接状态与命令

1. 模拟 `lark-cli` 无法启动。
   - CLI 显示未连接并展示 `npm install -g @larksuite/cli@latest`。
   - bot 与 user 不显示已连接。
2. 模拟 CLI 可用、bot 未连接、user 已连接。
   - 两个身份分别显示状态。
   - bot 展示 `lark-cli config init`，user 展示登录命令。
3. 模拟 bot 已连接、user 未连接，再测试两者均连接。
   - 状态分别更新，整体就绪只在 CLI、bot、user 均可用且 owner open_id 存在时出现。
4. 点击三个区域各自的检测按钮。
   - 每次都执行带 `--verify` 的完整检测。
   - 并发点击只产生一次检查。
5. 检查共用弹窗、配置页和路由响应。
   - 不出现鉴权 URL、原始报错、App ID、用户名、open_id、token 或 scope。

### C. 工作区与弹窗

1. 注册至少两个工作区，其中一个使用重复标题。
   - select 只列出当前注册项，标题与归一化路径可区分选项。
   - Windows 的 `D:\Git` 与 `D:/Git` 均显示为 `/d/Git`。
2. 保持 `workspaceRoot` 为空并打开 GUI。
   - 共用弹窗出现，事件消费者未启动。
3. 从弹窗选择并保存。
   - profile 写入 `/d/Git` 形式的归一化路径，Host 调用收到原生路径。
   - 配置热重载后鉴权就绪时启动事件消费者。
4. 删除已选工作区的注册，保留磁盘目录。
   - 后端停止事件消费者。
   - 弹窗重新出现，注入不创建新注册项。
5. 暂时关闭弹窗。
   - 状态轮询不反复打开同一失效提示。
   - 下次 GUI 加载或出现新的失效时重新提示。
6. 清空注册列表。
   - select 显示空状态并禁用，不提供路径输入。

### D. 会话与飞书链路

1. 在鉴权与工作区均有效时注入一条私聊事件。
   - 会话标题为「来自用户的飞书消息」。
   - 消息来源仍为 `lark-bridge`，置顶与去重保持。
2. 再注入一条消息。
   - 复用同一桥接会话，标题保持固定值。
3. 归档桥接会话后注入下一条消息。
   - 创建新会话，不需要重置操作。
4. 调用 `lark_notify`。
   - 通知仍只发往已绑定用户。

### E. 界面审查

- 中文与英文均检查共用弹窗和配置页。
- 在宿主支持的浅色与深色主题中检查原生 select、只读命令和状态标识。
- 检查键盘选择、禁用状态、弹窗关闭和保存反馈。
- 由 UI/UX 子代理审查发现性、主流程、反馈和视觉一致性，修复本次范围内的问题。

## 边界

- `--verify` 需要网络；失败只呈现未连接状态，诊断查看后端日志。
- user 登录只请求 `auth:user.id:read`，会替换同一 lark-cli 配置原有的用户授权范围。
- 事件监听停止期间不补投历史消息。
- 不增加最低 lark-cli 版本检查、自动安装、自动登录或工作区注册功能。