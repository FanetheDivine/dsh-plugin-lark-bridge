# 验证指南: 修复桥接会话创建请求

## 前置

- 仓库依赖已安装：`pnpm i`
- 实机章节需要本机 `lark-cli` 已用 bot 身份鉴权；本次只执行单元与门禁验证
- DSH 桌面版 `0.2.2-rc.5`，桥接工作区已注册

## 单元验证

```sh
pnpm run test:code -- sessions
```

预期：

- 新增用例断言创建请求只有 `workspaceId` 与可选 `agentPreset`。
- 首次注入创建会话、标题、挂载、置顶与状态写入的用例继续通过。

## 全量门禁

```sh
pnpm format && pnpm check && pnpm build
```

## 实机复现与验证（本次豁免，未执行）

1. 记录当前桥接会话，并在宿主中归档。
2. 确认 `~/.dsh/lark-bridge/state.json` 的 `sessionId` 仍指向已归档会话。
3. 在飞书私聊机器人发送一条文本消息。
4. 15 秒静默窗口后检查：
   - 桥接工作区出现标题为「飞书桥接会话」的新会话。
   - 新会话置顶，且包含来源为 `lark-bridge` 的用户消息。
   - `state.json` 的 `sessionId` 更新为新会话。
5. 宿主日志不含 `session.create accepts workspaceId or cwd, not both`。

## 回归检查

- 已有会话可恢复时，重复注入不新建会话。
- 配置不可用预设时，新会话按宿主默认创建，消息照常注入。
- 创建失败时日志含批次消息标识，监听继续运行。