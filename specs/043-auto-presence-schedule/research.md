# Research: 在场状态自动切换

## 1. 节假日数据源

| 候选 | 结论 | 理由 |
| --- | --- | --- |
| `NateScarlet/holiday-cn` 年度 JSON | 采用 | 含 `days: [{ name, date, isOffDay }]`，同时给出放假日期与调休上班日期；每年按国务院公告更新；实测 jsDelivr 与 raw.githubusercontent 均返回 200 |
| `timor.tech` 节假日 API | 弃用 | 实测返回 403 与 Cloudflare 拦截页，不适合运行时依赖 |
| `chinese-days` npm 包 | 弃用 | 离线数据，不满足「总是取最新」 |
| `date.nager.at` | 弃用 | 只有法定节假日，没有调休上班日期 |

取值方式：

- 主源 `https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/<year>.json`，备源 `https://raw.githubusercontent.com/NateScarlet/holiday-cn/master/<year>.json`。
- 请求超时 8 秒；单飞，同一年的并发请求合并为一次。
- 解析只读取 `days`，转成 `{ "YYYY-MM-DD": boolean }`，`isOffDay` 为 `true` 表示放假。
- 2026 年实测 39 条，含 6 个调休上班日。

## 2. 缓存与降级

- 缓存文件：`<DSH_HOME>/lark-bridge/holiday-cache.json`，`<DSH_HOME>` 与 `statePath()` 同源解析。
- 结构：`{ fetchedAt, years: { "2026": { "2026-01-01": true } } }`。
- 过期：`fetchedAt` 超过 24 小时后刷新；跨年或当前年份缺失时立即刷新。
- 刷新触发点：插件启动、调度器判定到点前需要某年数据时；一天内最多一次成功刷新，失败按 1 小时退避。
- 降级顺序：缓存 → 无缓存时只按周末跳过，`logger.warn` 记一条，并把状态经 `/lark-bridge/presence` 的 `holidays` 字段给到配置页。
- 判定语义：日期在数据中且为 `true` → 法定节假日（含调休放假）；日期在数据中且为 `false` → 调休上班日，按工作日处理；日期不在数据中 → 普通日期，周末按星期判断。

## 3. 时间选择控件

| 候选 | 结论 | 理由 |
| --- | --- | --- |
| `react-time-picker` 8.1.0 + `react-clock` | 采用 | 表盘式选择，交互接近闹钟；支持 `portalContainer` 把表盘挂到弹层，避免配置页滚动容器裁切；样式为普通 CSS 类，可按 DSH 令牌覆盖 |
| antd `TimePicker` | 弃用 | 依赖 dayjs 与 CSS-in-JS 运行时，样式体系与 DSH 冲突，打包体积大 |
| `@mui/x-date-pickers` | 弃用 | 依赖 emotion 主题，与 DSH 令牌难以协调 |
| shadcn/ui | 弃用 | 不提供时间选择器，其时间输入示例基于原生 `<input type="time">`，已被用户排除 |
| 原生 `<input type="time">` | 弃用 | 用户明确排除 |

落地方式：

- 添加与编辑条目用 DSH `Modal`；弹窗内放 `react-time-picker`（`disableClock={false}`、`clockIcon={null}`、`clearIcon={null}`），`portalContainer` 指向弹窗根节点。
- 引入 `react-time-picker/dist/TimePicker.css` 与 `react-clock/dist/Clock.css`，再由 `src/client/presence-alarms.css` 覆盖颜色、圆角与字号到 `--dsw-alias-*` 令牌。
- 两个依赖放 `devDependencies`，由浏览器构建内联进 `dist/client.js`，不需要改动平台模块表。

## 4. 配置暂存

- 行配置页的 `SettingsFormModel` 以文本暂存字段，保存时写入 `{ op: 'set', path: [field], value }`。
- `presenceAlarms` 以一个字段承载：暂存文本是规范化 JSON（键顺序固定、按时间与动作排序），解析失败视为无效并阻止保存。
- 删除全部条目时写入 `unset`，回到 schema 默认 `[]`。

## 5. 手动切换优先级

- `PresenceStore` 记录 `lastManualAt`，仅手动切换写入。
- 到点执行前比较：`lastManualAt >= 到点时刻` 时跳过该次执行。
- 效果：到点后同一分钟内用户先手动切换，自动执行不再覆盖；下一个到点照常执行。

## 6. 定时判定

- 定时器周期 15 秒，判定当前 `HH:mm` 是否命中启用条目。
- 执行记录按「日期 + 条目 id」去重，跨零点自动失效。
- 启动时先补执行一次，再启动定时器；`ctx.effect` 负责清理定时器与订阅。

## 7. 打包与依赖影响

- `react-time-picker` 及其依赖内联进浏览器产物，`dist/client.js` 增量约 100 KB。
- 宿主侧不新增运行时依赖：节假日数据用 Node 内置 `fetch`。
- `tests/package-metadata.test.ts` 需要同步新增依赖断言。
