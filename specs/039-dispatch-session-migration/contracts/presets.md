# 契约：补丁中的行与预设

本插件 `cordis.patch.yml` 在主行 `dsh-plugin-lark-bridge` 之后插入三行。内容取自组合包 [`cordis.patch.yml@cc3c25d`](https://github.com/FanetheDivine/dsh-plugin-practical-tool-bundle/blob/cc3c25d/cordis.patch.yml)，只改下表标出的值。

## 行

| 行 id | `name` | 作用 |
| --- | --- | --- |
| `lark-super-agent` | `dsh-plugin-lark-bridge/lark-super-agent` | 提供 `larkSuperAgent` 服务 |
| `preset-sa-dispatch` | `@deepseek-ai/dsh-agent-preset` | 声明 `SA-调度会话` |
| `preset-sa-worker` | `@deepseek-ai/dsh-agent-preset` | 声明 `SA-工作会话` |

## 与组合包的差异

| 位置 | 组合包 | 本插件 |
| --- | --- | --- |
| `lark-super-agent.name` | `dsh-plugin-practical-tool-bundle/lark-super-agent` | `dsh-plugin-lark-bridge/lark-super-agent` |
| `preset-sa-dispatch` 内 `sa-dispatch.name` | `dsh-plugin-practical-tool-bundle/sa-dispatch` | `dsh-plugin-lark-bridge/sa-dispatch` |
| `preset-sa-worker.config.name` | `SA-任务会话` | `SA-工作会话` |
| `preset-sa-worker` 内 `sa-worker.name` | `dsh-plugin-practical-tool-bundle/sa-worker` | `dsh-plugin-lark-bridge/sa-worker` |

其余字段逐字相同：

- `preset-sa-dispatch`：`id: sa-dispatch`、`name: SA-调度会话`、描述、11 个基础子行、压缩组 `thresholdRatio: 0.3`、`meta-tools` 十一项全开且 `session_preset: sa-worker`。
- `preset-sa-worker`：`id: sa-worker`、描述、宿主 `0.2.2-rc.5` 标准预设去掉 `tool-ask-user`。

## 结构测试

`tests/presets-patch.test.ts` MUST 断言：

- 两个预设都不含 `@deepseek-ai/dsh-tool-ask-user`。
- `sa-dispatch` 的子行集合与组合包相同。
- `sa-dispatch` 的 `compaction-basic` 带 `thresholdRatio: 0.3`。
- `sa-worker` 与标准预设快照相比，只差 `tool-ask-user` 与 `sa-worker`。
- 两个预设的 `name` 分别为 `SA-调度会话` 与 `SA-工作会话`。
- 补丁不改动 `agent-preset-registry`，两个预设都不是默认预设。
