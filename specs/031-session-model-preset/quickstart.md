# 快速验证：桥接会话的模型与预设

## 准备

在 worktree 根目录安装依赖并构建：

```sh
pnpm install
pnpm build
```

依赖升级到 `0.2.2-rc.5` 后需要重新生成 `pnpm-lock.yaml`。后续命令都在 worktree 根目录执行。

## 自动化检查

```sh
pnpm check
```

覆盖类型、lint、`test:code` 与构建后的 `test:dist`。

```sh
pnpm build
```

确认 `dist/client.js` 内联官方选择器样式，且不残留 `dist/client.css`：

```sh
ls dist/client.css 2>/dev/null || echo "css inlined"
grep -c "data-dsh-lark-bridge-model-selection" dist/client.js
```

## 场景 1：配置页渲染

打开插件管理器中的本插件配置页。预期自上而下为鉴权面板、工作区、模型、预设、保存栏。

- 模型行显示 provider/模型触发器与推理等级控制。
- 预设行显示「跟随宿主默认」或已保存预设，点击弹出宿主 Menu。

对应测试：`tests/client.test.ts`、`tests/config-form.test.ts`。

## 场景 2：新建会话应用配置

1. 在配置页选择模型与预设并保存。
2. 删除状态文件 `~/.dsh/lark-bridge/state.json`。
3. 向机器人发一条飞书消息。

预期：新会话日志首条出现 `model/selection` 事件，值与配置一致；会话头 `agentPreset` 为配置值；消息被注入。

对应测试：`tests/sessions.test.ts` 中断言 `sessionController.create` 收到 `agentPreset`、`agent.model.select` 收到选择。

## 场景 3：降级

1. 在配置中写入宿主名册不存在的预设与不可用模型。
2. 删除状态文件后发一条飞书消息。

预期：会话按宿主默认创建，消息注入成功，日志出现两条 warn；配置页显示预设不可用、模型未选择。

对应测试：`tests/sessions.test.ts` 与 `tests/preset-defaults.test.ts`。

## 场景 4：已存在会话保持

1. 保留状态文件，配置新的模型与预设并保存。
2. 再发一条飞书消息。

预期：复用原会话，不产生新的 `model/selection` 事件。

## 文档核对

```sh
grep -n "sessionPreset\|模型\|预设" docs/how-it-works.md docs/known-risks.md
git status --porcelain
```

预期：机制文档记录配置字段与解析顺序；`README.md` 与 `locale/*.json` 无改动。

## 实机验证

本轮不做实机验证（D-008）。配置页渲染、宿主 Menu 与真实预设挂载保持未验证。
