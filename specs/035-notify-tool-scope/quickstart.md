# Quickstart: 通知工具限定在桥接会话

**Branch**: `fix/035-notify-tool-scope` | **Date**: 2026-11-21

## 前置

- 仓库依赖已安装：`pnpm i`。
- 插件对接宿主 `0.2.2-rc.5`。

## 命令

```sh
pnpm run test:code -- tools plugin   # 单元测试
pnpm format                          # 格式化
pnpm check                           # typecheck + lint + 单元测试
pnpm build                           # 构建并跑 dist 测试
```

## 场景

### 1. 非桥接会话看不到工具

1. 让状态文件的 `sessionId` 指向会话 A。
2. 以会话 B 的 agent 求值工具的 `when` 条件。
3. 期望结果为 false。

### 2. 桥接会话可见

1. 让状态文件的 `sessionId` 指向会话 A。
2. 以会话 A 的 agent 求值同一条件。
3. 期望结果为 true。

### 3. 无桥接会话

1. 删除状态文件，或让 `sessionId` 为 null。
2. 以任意会话求值条件。
3. 期望结果为 false。

### 4. 切换会话后跟随

1. 状态文件从 A 改为 B。
2. 分别求值 A 与 B。
3. 期望 A 为 false、B 为 true。

### 5. 执行守卫

1. 用非桥接会话的 agent 执行工具，参数为合法 `text`。
2. 期望结果为 `{ ok: false, error: { code: 'not-bridge-session' } }`。
3. 期望 CLI 没有被调用。

### 6. 桥接会话发送不变

1. 用桥接会话的 agent 执行工具。
2. 期望仍按现有规则调用 `lark-cli im +messages-send`，参数、拆分与错误码不变。

## 期望

- 单元测试覆盖场景 1 至 6。
- `pnpm check` 与 `pnpm build` 通过。
- 真实宿主不验证，风险由规格记录。
