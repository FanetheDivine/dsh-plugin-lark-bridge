# Implementation Plan: 在场状态自动切换

**Branch**: `feat/043-auto-presence-schedule` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/043-auto-presence-schedule/spec.md`

**Status**: Draft

**Note**: This template is filled in by the `/speckit-plan` command; its definition describes the execution workflow.

## Open Decisions

- [ ] [P-001] 节假日缓存的过期时长与刷新时机 | Depends on: none | Status: answered（24 小时，详见 research.md，待用户审查）
- [ ] [P-002] 闹钟条目在配置页的展示密度（tag 是否同时显示跳过项与启用状态） | Depends on: none | Status: answered（tag 内显示时间与两个跳过项标记，见 data-model.md）
- [ ] [P-003] 节假日数据状态的展示位置 | Depends on: none | Status: answered（`/lark-bridge/presence` 响应扩展 `holidays` 字段，配置页读同一路由）

## Clarifications

### Session 2026-11-24

- [D-001] 到点只执行一次，手动切换保持到下一个到点。
- [D-002] 启动补执行当天最近一个已过且未跳过的到点。
- [D-003] 调休上班日按工作日处理。
- [D-004] 节假日数据运行时联网获取，带缓存与降级。
- [D-005] `HH:mm` 24 小时制。
- [D-006] 同一分钟两种动作并存时以「离开」为准。
- [D-007] 新条目默认启用、跳过周末、跳过节假日。
- [D-008] 宿主本地时间。
- [D-009] 第三方表盘式时间选择器。
- [D-010] 每条闹钟是一条记录，配置页按动作分两个分区。

## Review Record

（待填写）

## Summary

在 `lark-super-agent` 行新增「闹钟条目」配置 `presenceAlarms`：每条含时间、动作、启用、跳过周末与跳过节假日。宿主侧定时器在到点执行一次状态切换，启动时按当天最近一个已过的到点补执行，手动切换后到点若已过则跳过。节假日数据运行时从 `NateScarlet/holiday-cn` 获取（jsDelivr 主源、raw.githubusercontent 备源），缓存到 DSH home 下的状态目录，24 小时过期；获取失败用缓存，无缓存时只按周末跳过并在配置页提示。配置页用 DSH 组件加 `react-time-picker` 的表盘式时间选择器编辑条目。

## Technical Context

**Language/Version**: TypeScript 6.0.3，ESM，strict；React 18.3.1（前端）

**Primary Dependencies**:
- 宿主：`@deepseek-ai/cordis` 4.1、`@deepseek-ai/schemastery` 3.19（配置 schema）、Node 24 内置 `fetch` 与 `node:fs`
- 前端：`@deepseek-ai/dsh-client-ui-primitives`（平台模块，external）、新增 `react-time-picker` 8.1.0 与 `react-clock`（内联进 `dist/client.js`）

**Storage**: 插件行配置（宿主设置文档，含 volatile 热重载）；节假日缓存文件 `<DSH_HOME>/lark-bridge/holiday-cache.json`

**Testing**: vitest 4，`tests/` 下源码测试 + jsdom 前端测试 + `test:dist` 产物测试

**Target Platform**: DSH 宿主进程（Node 24，Windows/macOS/Linux）与 DSH Web GUI（浏览器）

**Performance Goals**: 定时器每 15 秒判定一次；节假日联网获取每天最多 1 次；前端新增依赖打包后 `dist/client.js` 增量约 100 KB

**Constraints**: 不引入新的 `@deepseek-ai/*` 依赖版本；不修改用户运行中的 GUI 服务；新增前端依赖内联，不加入平台模块表

**Scale/Scope**: 闹钟条目数量不设上限，典型为个位数

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- I. 宿主依赖版本：新增依赖为 `react-time-picker` 与 `react-clock`，属 `devDependencies`，版本确切锁定；不新增 `@deepseek-ai/*` 依赖，`pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 不需要变更。PASS
- II. 测试同步：新增 `tests/presence-schedule.test.ts`、`tests/presence-holidays.test.ts`、`tests/presence-alarms-client.test.ts`，并更新 `tests/presence.test.ts`、`tests/presence-client.test.ts`、`tests/presence-routes.test.ts`、`tests/lark-super-agent-index.test.ts`、`tests/package-metadata.test.ts`（依赖锁定）。PASS
- III. 文档结构：更新 `README.md` 在场状态一节、`docs/how-it-works.md` 在场状态一节与文件地图、`CHANGELOG.md`。PASS
- IV. 质量门禁：实现完成后运行 `pnpm format && pnpm check`，合并前通过 `pnpm build`。PASS
- V. 公开引用：spec 与 plan 只引用公网 URL 与仓库内相对路径；节假日缓存路径以 `<DSH_HOME>` 占位符描述。PASS

## Project Structure

### Documentation (this feature)

```text
specs/043-auto-presence-schedule/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
│   ├── presence-config.md
│   └── presence-route.md
├── checklists/requirements.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── constants.ts                         # 新增节假日缓存文件名
├── config.ts                            # 导出状态根目录解析，供缓存复用
├── lark-super-agent/
│   ├── config.ts                        # 新增 presenceAlarms schema 与读取
│   ├── presence.ts                      # 记录手动切换时间，支持来源标记
│   ├── alarms.ts                        # 闹钟条目解析、排序、归一化（宿主与前端共用）
│   ├── schedule.ts                      # 到点判定与执行调度器
│   ├── holidays.ts                      # 联网获取、缓存、降级与跳过判定
│   ├── routes.ts                        # presence 路由响应扩展节假日数据状态
│   └── index.ts                         # 装配调度器、日历与路由
└── client/
    ├── locales.ts                       # 新增闹钟分区、弹窗与提示文案
    ├── api.ts                           # 读取节假日数据状态
    ├── presence-config.tsx              # 分区、tag、弹窗、开关渲染
    ├── presence-alarm-editor.tsx        # 添加/编辑弹窗与时间选择器
    ├── presence-alarms.css              # 时间选择器按 DSH 令牌覆盖
    └── presence-controller.ts           # 快照携带节假日数据状态

tests/
├── presence-schedule.test.ts
├── presence-holidays.test.ts
├── presence-alarms-client.test.ts
└── （更新既有在场状态与配置测试）
```

## Phase 0: Research

见 [research.md](./research.md)。结论：

- 节假日数据用 `NateScarlet/holiday-cn` 年度 JSON，主源 jsDelivr，备源 raw.githubusercontent；`timor.tech` 有 Cloudflare 拦截，弃用。
- 时间选择用 `react-time-picker` 8.1.0（表盘弹层，支持 `portalContainer`），配 `react-clock/dist/Clock.css`；DSH 组件库无时间选择控件，shadcn/ui 不提供时间选择器。
- 配置暂存沿用 `SettingsFormModel` 的文本字段：`presenceAlarms` 以规范化 JSON 文本暂存，保存时整列写入。
- 手动切换优先级用「手动切换时间戳 ≥ 到点时刻则跳过该到点」实现。

## Phase 1: Design

### 数据与配置

见 [data-model.md](./data-model.md)。

- `presenceAlarms`：`{ id, time, action, enabled, skipWeekends, skipHolidays }[]`，schema 默认 `[]`，字段 volatile。
- 节假日缓存：`{ fetchedAt, years: { "2026": { "2026-01-01": true } } }`，`true` 表示放假，`false` 表示调休上班。
- 状态新增 `lastManualAt`，手动切换写入，自动执行与输入更新不写入。

### 执行流程

1. 宿主装配：`apply` 创建 `PresenceStore`、`HolidayCalendar`、`PresenceScheduler`；`ctx.effect` 注册定时器与清理。
2. 每 15 秒判定一次：跳过非法条目与停用条目；按条目逐项判定当天是否跳过；同一分钟只执行一次；多种动作并存时以离开为准。
3. 启动与唤醒补执行：取当天已过且未跳过的最后一个到点。
4. 日历保证：`HolidayCalendar` 在需要某年数据时按需加载缓存、按需联网，单飞请求、超时 8 秒、失败降级。
5. 前端：`PresenceController` 轮询路由，配置页读取节假日数据状态显示提示；条目编辑在 DSH `Modal` 内用 `react-time-picker` 完成。

### 契约

见 [contracts/](./contracts/)。

### 验证

- 单元测试覆盖到点执行、去重、跨零点、补执行、手动优先级、跳过判定、缓存与降级。
- 前端测试覆盖分区渲染、添加/编辑/删除、保存写入、节假日提示。
- `pnpm format && pnpm check && pnpm build`。
- 实机验证留待用户选择时机，见 quickstart.md。

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --- | --- | --- |
| 节假日数据运行时联网获取 | 用户要求总是取最新数据 | 打包离线日历不会随年度公告更新 |
| 引入第三方时间选择器 | 用户要求成熟组件 | 原生时间输入与自绘选择器都被用户排除 |
