# 浏览器路由契约

前缀 `/lark-bridge`，传输与来源校验规则见 [how-it-works.md](../../../docs/how-it-works.md#浏览器通信)。

## 保留路由

| 方法 | 路径 | 行为 |
| --- | --- | --- |
| GET | `/status` | 返回最近一次完整检测的安全状态，不执行 CLI |
| POST | `/check` | 执行一次带 `--verify` 的完整检测，返回同一安全状态 |

成功响应：

```json
{
  "ok": true,
  "data": {
    "cli": "connected",
    "bot": "disconnected",
    "user": "connected",
    "ready": false,
    "checkedAt": 1795155075818
  }
}
```

`cli`、`bot`、`user` 的取值均为 `checking | connected | disconnected`。

响应禁止包含：

- `verificationUrl`、`deviceCode`、`login`
- `detail`、`error` 或 CLI 原始输出
- `appId`、`userName`、`ownerOpenId`
- token、scope、会话标识或会话错误

路由错误沿用宿主 `{ ok: false, error }` 外壳；连接面板只显示笼统状态，不渲染错误消息。

## 删除路由

| 方法 | 路径 | 结果 |
| --- | --- | --- |
| POST | `/auth/start` | 不再注册 |
| POST | `/auth/cancel` | 不再注册 |
| POST | `/session/reset` | 不再注册 |

## 检测并发

多个 `POST /check` 同时到达时共享同一次完整检测。三个连接区域的检测按钮都调用该路由，返回后分别展示同一份快照中的三个字段。