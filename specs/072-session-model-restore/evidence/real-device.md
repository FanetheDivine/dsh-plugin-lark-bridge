# 实机验证记录：切换会话模型与恢复已归档会话

**日期**: 2026-11-27

**宿主**: 0.2.2-rc.5（全局 `dsh`）

**环境**: profile `rdt-072`，链接安装当前 worktree，mock provider 取代真实模型，`DSH_HOME` 指向 profile 内的隔离目录。

**脚本**: [scripts/mock-provider-072.mjs](./scripts/mock-provider-072.mjs)、[scripts/run-072.mjs](./scripts/run-072.mjs)

**结果**: [results.json](./results.json)（8/8 通过）

## 结果

| 用例 | 断言 | 结果 |
| --- | --- | --- |
| A1 插件装载 | 插件激活，加载产物与仓库 `dist` 哈希一致 | 通过 |
| A2 工具表 | `sa-dispatch` 会话的请求工具表含 `session_model`、`session_restore`、`session_manage` | 通过 |
| B1 切换任务会话模型 | 目标会话下一次请求模型为 `mock-model-b`，记录 `model/selection`，全局默认模型仍为 `mock-model` | 通过 |
| B2 effort 校验 | 不支持的 effort 返回 `Invalid model selection`，选择保持不变 | 通过 |
| B3 恢复归档会话 | 会话离开归档集合、任务回到台账、pin 恢复 | 通过 |
| B4 恢复后可上报 | `send_report` 返回 `delivered: true`，台账记录报告 | 通过 |
| B5 未归档会话恢复 | 返回 `session ... is not archived` | 通过 |
| B6 切换自身模型 | 省略 `session_id` 时调度会话下一次请求模型为 `mock-model-b` | 通过 |

## 复现

```sh
bash .dsh/skills/real-device-test/scripts/setup-env.sh <worktree 绝对路径> rdt-072
```

1. 把 profile 的插件配置改为本插件的键：`workspaceRoot`。
2. 把 `mock-provider-072.mjs` 与 `run-072.mjs` 复制到 profile 目录。
3. 在 profile 目录运行：

   ```sh
   RDT_PROFILE=rdt-072 RDT_PROFILE_DIR=<profile 目录> RDT_REPO=<worktree 绝对路径> node run-072.mjs
   ```

## 发现

- 新路由的上下文容量由宿主在下一步检查。适配器未声明 `context.contextWindow` 时会报 `no context capacity`，原模型保持；mock provider 因此显式声明 200000。
- 调度会话的 `model/selection` 事件在切换当步写入，下一步请求使用新路由；当前步的请求保持原模型。
- 恢复后 `send_report` 正常投递，说明归档门禁与任务台账都已恢复可用。
- 恢复的置顶用宿主 `workspaceRegistry.pinSession`；归档同时清 pin 的行为与插件假设一致。