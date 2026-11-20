# 快速验证：飞书消息块与回复提醒

## 前置条件

- Node.js ≥ 24.9，pnpm 可用。
- 插件已按 [README](../../../README.md) 配置工作区，并完成 lark-cli 与 bot 鉴权。
- 真实宿主验收需要一个已绑定的飞书用户。

## 命令

在 worktree 根目录执行：

```sh
pnpm format
pnpm check
pnpm build
```

worktree 没有 `node_modules` 时，先执行 `pnpm install --offline`；或直接用仓库根的 `node_modules/.bin/vitest` 运行同一组测试。

## 单元场景

1. 注入块：一条文本消息的事件经格式化后，文本匹配 `^<lark-message message_id="[^"]+" time="[^"]+">`，不含 `<system-reminder>`。
2. 块内容：正文为空时块内是类型占位；正文含 `</lark-message>` 时块边界仍唯一。
3. 提醒补注：桥接会话的表层没有提醒时，`agent/pre-step` 把提醒插到块之前。
4. 不重复：表层已有提醒，或本批已含提醒时，不插入第二条。
5. 非桥接会话：状态文件指向其他会话时，不插入提醒。
6. 压缩：把表层替换为一条摘要后触发 `agent/pre-step`，表层提醒条数从零变为一。

## 人工场景

1. 给机器人连续发两条飞书消息。
2. 确认用户收到一次 `lark_notify` 消息，内容覆盖两条消息。
3. 确认会话里的正文输出只用于说明，主要回复内容在飞书侧。
4. 在会话中执行 `/compact`，再发一条飞书消息，确认回复仍走 `lark_notify`。
5. 在 GUI 里直接发一条消息，确认回复留在会话中，没有调用 `lark_notify`。

## 预期结果

- 会话中每条飞书消息是一个 `<lark-message>` 块。
- 桥接会话表层始终至少有一条说明性 `<system-reminder>`。
- `lark_notify` 的行为与参数保持不变。
