# Contract: 行配置字段 `presenceAlarms`

配置位置：`lark-super-agent` 行，命名空间 `lark-super-agent`，前端配置页槽位键 `dsh-plugin-lark-bridge#lark-super-agent`。

## Schema

```ts
Schema.object({
  guiInputSetsLocal: Schema.boolean().default(true).volatile(),
  larkInputSetsRemote: Schema.boolean().default(true).volatile(),
  presenceAlarms: Schema.array(
    Schema.object({
      id: Schema.string(),
      time: Schema.string(),
      action: Schema.union(['local', 'remote']),
      enabled: Schema.boolean().default(true),
      skipWeekends: Schema.boolean().default(true),
      skipHolidays: Schema.boolean().default(true),
    }),
  ).default([]).volatile(),
})
```

## 取值示例

```json
{
  "presenceAlarms": [
    {
      "id": "alarm-1",
      "time": "09:00",
      "action": "local",
      "enabled": true,
      "skipWeekends": true,
      "skipHolidays": true
    },
    {
      "id": "alarm-2",
      "time": "18:30",
      "action": "remote",
      "enabled": true,
      "skipWeekends": true,
      "skipHolidays": true
    }
  ]
}
```

## 校验

- 缺字段的条目按默认值补齐；`time` 非法或 `action` 非法的条目被丢弃。
- 同一 `action` 内重复 `time` 保留先出现的一条。
- 读取配置时展开 volatile 引用；非数组值按空列表处理。
- 保存走 `{ op: 'set', path: ['presenceAlarms'], value: [...] }`；删除全部条目走 `{ op: 'unset', path: ['presenceAlarms'] }`。

## 配置页暂存

- 暂存文本为规范化 JSON：键顺序固定为 `id`、`time`、`action`、`enabled`、`skipWeekends`、`skipHolidays`；条目按 `time` 升序、同时间 `remote` 在前。
- 文本为空表示清空字段；解析失败视为无效并阻止保存。
