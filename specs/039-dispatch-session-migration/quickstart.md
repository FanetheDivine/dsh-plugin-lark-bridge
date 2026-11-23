# Quickstart：验证迁入的调度功能

## 前置

- 在 worktree 运行 `pnpm install`。
- 本机安装 git，并配置 `user.name` 与 `user.email`。

## 自动化

```sh
pnpm format && pnpm check
pnpm build
```

预期：

- `test:code` 全部通过，包含迁入的 `lark-super-agent-*`、`sa-dispatch`、`sa-worker`、`presets-patch` 测试。
- `test:dist` 全部通过；`dist` 含 `index.mjs`、`lark-super-agent.mjs`、`sa-dispatch.mjs`、`sa-worker.mjs`、`client.js`。
- `npm pack --dry-run --json` 列出 `rows/` 下三行的 `locale/*.json` 与 `icon.svg`。

## 实机验证

按 `.dsh/skills/real-device-test/SKILL.md` 搭建 profile，以链接方式安装当前检出。

| 编号 | 步骤 | 预期 |
| --- | --- | --- |
| RD-1 | 打开 Plugins 页 | 本插件显示主行与 `lark-super-agent`、`preset-sa-dispatch`、`preset-sa-worker` 三行；标题为「用飞书和DSH对话」 |
| RD-2 | 打开本插件配置页的预设选择器 | 列表含 `SA-调度会话` 与 `SA-工作会话` |
| RD-3 | 手写 `state.json` 指向一个 `SA-调度会话` 会话与调度工作区；用 mock 模型调用 `workspace_note_set` 与 `task_create` | 调度工作区出现两份 JSON 与 git 提交 |
| RD-4 | 在 `SA-工作会话` 会话用 mock 模型调用 `send_report` | 调度会话收到 `<work_session_message>`；`reports/<taskId>/` 写入记录并提交 git |
| RD-5 | 停用 `lark-super-agent` 行后重启 | 工作会话不再有 `send_report`；主行配置页与 `lark_notify` 照常 |

结果写入 `specs/039-dispatch-session-migration/real-device-report.md`。
