# Contract: `/lark-bridge/presence`

由 `lark-super-agent` 行注册，行停用时注销。来源校验与 `/lark-bridge/status` 相同：只接受回环地址，`Origin` 须与 `webServer.getOrigin()` 一致，存在 `connection` 时再调用 `requestRejection`。

## GET

响应：

```json
{ "ok": true, "data": { "presence": "local", "updatedAt": 1764000000000 } }
```

## POST

请求体：

```json
{ "presence": "remote" }
```

响应与 GET 相同，返回写入后的状态。

| 情形 | 状态码 | `error.code` |
| --- | --- | --- |
| `presence` 不是 `local` 或 `remote` | 400 | `invalid-presence` |
| 来源校验失败 | 403 | `forbidden` |
| 其他方法 | 400 | `method-not-allowed` |

## 前端解读

| 回答 | 含义 |
| --- | --- |
| `ok: true` | 行启用，按 `data` 显示 |
| `invalid-response` | 路由未注册，行已停用，隐藏按钮 |
| `network` | 本轮无结论，保持现状 |
| 其他错误 | 保持现状；POST 时视为切换失败 |
