# Quickstart: 移除用户在场机制

## 前置条件

- Node 24.9 及以上，pnpm 11.7。
- 本机已安装可运行 `lark-cli` 的 DSH 宿主 0.2.2-rc.5；实机验收用 `real-device-test` 的 mock provider，不需要飞书凭据。
- 在 `worktrees/067-presence-removal` 内执行命令。

## 依赖与构建

```sh
pnpm install          # 移除九项 devDependencies 后更新 lockfile
pnpm build            # 构建 host 与 client 产物
pnpm format && pnpm check
```

预期：

- `pnpm install` 不报缺失包。
- `pnpm build` 不再打印 Tailwind 生成步骤，`dist/client.js` 仍带 `report-card` 与官方选择器样式。
- `pnpm check` 通过类型、lint 与测试。

## 单元与静态验证

```sh
pnpm vitest run tests/managed-ask-guard.test.ts tests/sa-dispatch.test.ts tests/client.test.ts tests/lark-super-agent-index.test.ts
pnpm vitest run tests/model-defaults.test.ts tests/preset-defaults.test.ts tests/tool-schema.test.ts
```

| 场景 | 断言 |
| --- | --- |
| 被管理会话提问 | `beforeExecute` 返回 `deny`，`takeRules` 为真；继续提问仍只排一条 S |
| 未被管理会话提问 | 原决策不变 |
| 任务建立时取消 | 收到 `cancel(sessionId)` 后控制器内的调用被中止，网关里该会话的请求被取消 |
| 加载扫描 | `sweep()` 只为被管理会话取消请求并排队 S |
| 调度会话 | `agent/pre-step` 不插入 `sa-presence` 消息；提示词不含 `Track where the user is` |
| 桥接提醒 | 含统一 `lark_notify` 规则与正文一句话规则，不含「其他来源按普通方式回复」 |
| 配置页 | 槽位注册 `TaskConfigPage`；渲染结果不含两个开关、时间编辑与节假日提示 |
| 侧栏 | 不再注册 `sidebar.footer.action` 在场动作 |

静态检查：

```sh
grep -rn "presence\|Presence\|在场" src scripts tests cordis.patch.yml
grep -rn "build-client-css\|tailwind" package.json tsdown.config.ts src
```

预期：第一条只匹配规格与文档中说明移除的句子，代码与测试无残留；第二条无匹配。

## 真实宿主验收（A、B、C）

按 `.dsh/skills/real-device-test` 的流程搭建：

```sh
bash .dsh/skills/real-device-test/scripts/setup-env.sh "$(pwd)" rdt-067
cd <profile 目录> && node run-test.mjs
```

在 `run-test.mjs` 中补三个用例：

| 用例 | 操作 | 断言 |
| --- | --- | --- |
| B6 提问拦截 | mock 模型在被管理会话里调用 `ask_user_question` | 工具结果是被拒绝的反馈；下一次请求含 `lark-task-rules` 消息 |
| B7 无在场提醒 | 在同一会话继续一轮 | 请求里没有 `sa-presence` 消息，系统提示词不含 `Track where the user is` |
| B8 通道文案 | 读取桥接会话请求中的提醒 | 含统一 `lark_notify` 与正文一句话规则 |

浏览器验收：

```sh
eval $(bash .dsh/skills/real-device-test/scripts/gui-up.sh rdt-067)
node .dsh/skills/real-device-test/scripts/browser-test.mjs
```

| 用例 | 操作 | 断言 |
| --- | --- | --- |
| C6 侧栏无在场按钮 | 打开插件页与任意会话 | 页脚没有显示器或手机图标 |
| C7 任务配置页 | 插件页 → 包详情 → 行「调度会话」 | 只有普通任务模型、复杂任务模型、默认任务类型、任务会话预设 |
| C8 主配置页 | 插件页 → 包详情 → 行「用飞书和DSH对话」 | 工作区、模型与预设保持原样 |

## 完成标准

- 规格 SC-001 至 SC-008 全部满足。
- `pnpm check` 与 `pnpm build` 通过。
- 实机用例 A1、B6 至 B8、C6 至 C8 通过。
- 清理：结束 GUI 进程，删除 profile 与临时工作区。
