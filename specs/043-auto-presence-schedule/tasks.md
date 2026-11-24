# Tasks: 在场状态自动切换

**Input**: Design documents from `specs/043-auto-presence-schedule/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Organization**: 按用户故事分组；每个阶段对应一个 commit。

## Phase 1: Setup（依赖与常量）

- [x] T001 在 `package.json` 的 `devDependencies` 加入 `react-time-picker@8.1.0` 与 `react-clock@6.0.0`，运行 `pnpm install`
- [x] T002 `src/constants.ts` 新增 `HOLIDAY_CACHE_FILE` 与节假日数据源 URL 常量
- [x] T003 `src/config.ts` 抽出 `stateRoot()`，新增 `holidayCachePath()`

## Phase 2: Foundational（宿主数据模型，阻塞后续阶段）

- [x] T004 `src/lark-super-agent/alarms.ts`：闹钟条目类型、`normalizeAlarms`、`formatAlarmList`、`parseAlarmList`、`alarmId`
- [x] T005 `src/lark-super-agent/config.ts`：新增 `presenceAlarms` schema 与 `readPresenceAlarms`
- [x] T006 `src/lark-super-agent/presence.ts`：新增 `lastManualAt`、`setAuto`，区分手动与输入来源
- [x] T007 `src/lark-super-agent/holidays.ts`：联网获取、缓存读写、过期与退避、降级、`skipDay`
- [x] T008 `src/lark-super-agent/routes.ts`：presence 响应新增 `holidays` 字段
- [x] T009 `tests/presence-alarms.test.ts`、`tests/presence-holidays.test.ts`，更新 `tests/presence.test.ts`、`tests/presence-routes.test.ts`

## Phase 3: US1 + US4（到点切换与手动优先级）

- [x] T010 `src/lark-super-agent/schedule.ts`：`PresenceScheduler`（tick、去重、补执行、手动优先、多动作取离开）
- [x] T011 `src/lark-super-agent/index.ts`：装配日历、调度器与清理
- [x] T012 `tests/presence-schedule.test.ts`、`tests/lark-super-agent-index.test.ts`

## Phase 4: US2（配置页添加/编辑/删除条目）

- [x] T013 `src/client/locales.ts`：分区、弹窗、跳过项、提示文案（中英）
- [x] T014 `src/client/presence-alarms-editor.tsx`：DSH `Modal` + `react-time-picker` 编辑弹窗
- [x] T015 `src/client/presence-alarms.css`：时间选择器按 DSH 令牌覆盖样式
- [x] T016 `src/client/presence-config.tsx`：两个分区、条目 tag、添加/编辑/删除、启用开关
- [x] T017 `tests/presence-alarms-client.test.ts`，更新 `tests/presence-client.test.ts`

## Phase 5: US3 + US5（跳过项展示、节假日状态提示、持久化）

- [x] T018 `src/client/api.ts` 与 `src/client/presence-controller.ts`：读取 `holidays` 状态
- [x] T019 `src/client/index.ts`：配置页注入控制器
- [x] T020 配置页展示节假日数据状态提示；`tests/presence-alarms-client.test.ts` 补用例
- [x] T021 `tests/package-metadata.test.ts`、`tests/client-bundle.test.ts`：依赖与产物契约同步

## Phase 6: 文档与门禁

- [x] T022 更新 `README.md`、`docs/how-it-works.md`、`CHANGELOG.md`
- [x] T023 运行 `pnpm format && pnpm check && pnpm build`
- [x] T024 实机验证：配置页增删改、到点切换、跳过项、节假日数据获取与降级、重启补执行，留证据
