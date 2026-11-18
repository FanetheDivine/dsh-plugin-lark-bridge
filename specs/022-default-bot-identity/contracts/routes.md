# 浏览器路由契约

前缀 `/lark-bridge`，规则见 [how-it-works.md](../../../docs/how-it-works.md#浏览器通信)。

| 方法 | 路径 | 变化 |
| --- | --- | --- |
| GET | `/status` | 响应删除 `profile`；`stage` 取值收敛为四项 |
| POST | `/check` | 不变 |
| POST | `/app` | 删除，返回 `not-found` |
| POST | `/auth/start` | 不变 |
| POST | `/auth/cancel` | 不变 |
| POST | `/session/reset` | 不变 |
