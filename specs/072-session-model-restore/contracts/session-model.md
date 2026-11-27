# Contract: `session_model`

切换一个会话的模型。工具注册在 `sa-dispatch` 子行。

## 参数

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| session_id | string | 否 | 目标会话 id，省略时用调用方会话 |
| provider | string | 是 | provider id |
| model | string | 是 | model id |
| effort | string | 否 | reasoning effort id；省略或空串使用路由默认值 |

## 成功结果

```json
{
  "sessionId": "session-abc",
  "provider": "deepseek-account",
  "model": "deepseek-v4",
  "effort": "high",
  "previous": { "provider": "deepseek-account", "model": "deepseek-v3" },
  "archived": false
}
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| sessionId | string | 实际目标会话 |
| provider | string | 生效的 provider |
| model | string | 生效的 model |
| effort | string，可选 | 仅在显式指定时出现 |
| previous | object，可选 | 切换前的选择；没有记录时省略 |
| archived | boolean | 目标会话是否仍在归档集合中 |

## 失败语义

| 场景 | 行为 |
| --- | --- |
| provider 或 model 为空 | 参数错误，不改动任何会话 |
| 目标会话不存在 | 透传宿主 `session/not-found` 错误 |
| 目标会话是子代理会话 | 透传宿主 subagent 归属错误 |
| provider 未注册、model 不存在、effort 不支持 | 返回 `Invalid model selection: <宿主错误>` |
| `llm` 服务不可用 | 返回 `Model selection is unavailable: the llm service is not mounted.` |
| 目标会话已归档 | 成功记录选择，结果为 `archived: true` |
| 新路由上下文容量不足 | 工具成功；宿主在下一步报错并保留原模型，选择事件保留 |

## 生效时机

- 当前已发出的模型请求不变。
- 下一步起使用新路由，宿主在下一步插入模型变更提示。
- 已归档会话要等 `session_restore` 之后才能进入模型步。
- 宿主在下一步按新路由的 `contextWindow` 做压缩检查；适配器未声明容量或容量不足时该步报错，原模型继续生效。