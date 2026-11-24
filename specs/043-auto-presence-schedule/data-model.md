# Data Model: 在场状态自动切换

## 闹钟条目 `PresenceAlarm`

| 字段 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `id` | string | 生成 | 条目标识，前端生成，用于编辑与去重 |
| `time` | string | 无 | `HH:mm`，24 小时制 |
| `action` | `'local' \| 'remote'` | 无 | `local` 表示切换为在电脑旁，`remote` 表示切换为离开 |
| `enabled` | boolean | `true` | 停用时该条不执行 |
| `skipWeekends` | boolean | `true` | 周末不执行该条；调休上班日按工作日处理 |
| `skipHolidays` | boolean | `true` | 中国法定节假日与调休放假日期不执行该条 |

规范化规则：

- `time` 匹配 `^([01]\d|2[0-3]):[0-5]\d$`，其他值视为非法。
- 同一 `action` 内 `time` 唯一；重复时保留先出现的一条。
- 展示与暂存按 `time` 升序排序；同一时间按 `action` 排序，`remote` 在前。
- 非法条目在读取时被丢弃；配置页暂存非法文本时阻止保存。

配置字段：`presenceAlarms`，类型 `PresenceAlarm[]`，schema 默认 `[]`，声明为 volatile。

## 在场状态 `PresenceSnapshot`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `presence` | `'local' \| 'remote'` | 当前状态 |
| `updatedAt` | number | 最近一次变化的时间戳 |

新增进程内字段（不进入路由响应）：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `lastManualAt` | number | 最近一次手动切换的时间戳；输入更新与自动执行不写入 |

## 执行记录

- 结构：进程内 `Set<string>`，键为 `<YYYY-MM-DD>#<alarm id>`。
- 跨零点清理：保留当天与前一天，避免无界增长。

## 节假日日历 `HolidayCalendar`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `fetchedAt` | number \| null | 最近一次成功联网获取的时间戳 |
| `years` | `Record<string, Record<string, boolean>>` | 年份 → 日期 → 是否放假 |

- `true` 表示法定节假日或调休放假；`false` 表示调休上班日。
- 缓存文件：`<DSH_HOME>/lark-bridge/holiday-cache.json`。
- 状态：`fresh`（24 小时内获取成功）、`stale`（使用过期缓存）、`missing`（无可用数据）。

## 跳过判定

对日期 `d` 与条目 `a`：

1. `a.enabled` 为 false → 不执行。
2. 日历有 `d` 的数据：
   - `years[year][d] === true` 且 `a.skipHolidays` → 不执行。
   - `years[year][d] === false`（调休上班）→ 不按周末跳过。
3. 日历无 `d` 的数据：
   - `d` 是周六或周日且 `a.skipWeekends` → 不执行。
4. 其他情况 → 执行。

## 到点执行

- 到点时刻 = 当天日期 + 条目 `time`。
- 同一分钟命中多条：`remote` 优先；同动作只执行一次。
- `lastManualAt >= 到点时刻` → 跳过本次。
- 目标状态等于当前状态 → 不改状态与 `updatedAt`。
