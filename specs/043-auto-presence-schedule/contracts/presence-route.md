# Contract: `/lark-bridge/presence`

## GET

返回当前在场状态与节假日数据状态。

```json
{
  "ok": true,
  "data": {
    "presence": "local",
    "updatedAt": 1793980000000,
    "holidays": { "state": "fresh", "fetchedAt": 1793970000000 }
  }
}
```

- `presence`：`local` 或 `remote`。
- `updatedAt`：最近一次状态变化的时间戳。
- `holidays.state`：`fresh`、`stale` 或 `missing`。
- `holidays.fetchedAt`：最近一次成功获取的时间戳，没有时为 `null`。
- 前端只依赖 `presence` 与 `updatedAt`；`holidays` 缺失时按 `missing` 处理。

## POST

请求体 `{ "presence": "local" | "remote" }`，写入状态并返回与 GET 相同的结构。

- 该写入记为手动切换，更新 `lastManualAt`。
- 请求体非法时返回 400 与 `{ ok: false, error: { code: 'invalid-presence' } }`。

## 兼容

- 响应只新增字段，不修改既有字段含义；042 的前端校验逻辑不受影响。
- 路由注销后该路径的响应不是 JSON，前端据此判定行已停用。
