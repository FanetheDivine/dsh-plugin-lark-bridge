# Implementation Plan: 移除用户在场机制

**Branch**: `refactor/067-presence-removal` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/067-presence-removal/spec.md`

**Status**: Approved

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [D-101] Q: 配置页文件、导出与字典键是否同步去掉 presence 命名？ -> A: 同步改名，文件改 `task-config.tsx`，导出与字典前缀改 `TaskConfig*`、`taskConfig.`。
- [D-102] Q: 真实宿主验收覆盖到哪一步？ -> A: 装载与行为，用 mock 模型驱动拦截与 S，不发送真实飞书消息。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current complete plan | Open items: none | Risks: 渠道与正文句子规则只在提示词层，模型忽略时程序不强制；加载扫描与任务建立取消依赖宿主网关私有字段 `pendingRemoteEvents`、`cancelRemoteEvent`，字段漂移时只记日志；实机验收按 D-102 使用 mock 模型，不发送真实飞书消息。

## Summary

规格要求删除用户在场机制，同时把桥接会话的回复渠道固定为 `lark_notify`。实现分四块：

1. 删除在场核心：`presence.ts`、`schedule.ts`、`alarms.ts`、`holidays.ts`、`routes.ts`，以及行配置里的两个开关与 `presenceAlarms`（`cordis.patch.yml` 同步删除）。
2. 重写提问拦截：被管理会话的 `ask_user_question` 无条件拒绝并排队 S；创建任务时取消该会话已在等待的提问；插件加载时扫描网关残留请求。
3. 固定回复渠道：`src/reminder.ts` 改为所有桥接会话一律经 `lark_notify` 回复、正文最多一句；`sa-dispatch` 删除「Track where the user is」段落与提醒插入，`Handle reports` 不再按在场选择渠道。
4. 清理前端与构建：删除页脚按钮、在场控制器、闹钟编辑、`src/client/ui/`、Tailwind 与专属依赖；配置页改名为任务配置页，只保留任务模型、默认任务类型与任务预设。

## Technical Context

**Language/Version**: TypeScript 6.0（Node ESM，DSH 插件）

**Primary Dependencies**: 宿主 `@deepseek-ai/dsh-*@0.2.2-rc.5`；`dsh-plugin-meta-tools@0.1.7`；无新增依赖。移除 `@radix-ui/react-popover`、`@radix-ui/react-slot`、`@radix-ui/react-tooltip`、`@tailwindcss/cli`、`class-variance-authority`、`tailwind-merge`、`tailwindcss`、`tw-animate-css` 八项 devDependencies；保留 `clsx`（宿主 `ModelSelect` 源码直接 import，类型检查与打包需要）与 `@tsdown/css`。

**Storage**: 任务台账、上报与归档不变；不再读取或写入 `<DSH_HOME>/lark-bridge/holiday-cache.json`。

**Testing**: vitest `code` 项目；删除 6 个在场测试文件，更新 `managed-ask-guard.test.ts`、`client.test.ts`、`lark-super-agent-index.test.ts`、`sa-dispatch.test.ts`、`model-defaults.test.ts`、`preset-defaults.test.ts`、`tool-schema.test.ts`、`session-create.test.ts`、`list-models.test.ts`。

**Target Platform**: DSH 宿主 0.2.2-rc.5（Windows、macOS、Linux）

**Performance Goals**: 不适用；拦截判定只读任务台账，节假日抓取与 3 秒轮询随本次删除消失。

**Constraints**: 不改宿主代码；schemastery 的 `object` 不剥离未知键（已用本地脚本验证），旧配置键不会导致加载失败；`@tsdown/css` 继续把上报卡片与官方选择器的 CSS 内联进 `dist/client.js`。

**Scale/Scope**: 删除 5 个后端源文件、4 个前端源文件、7 个 UI 移植件、1 个构建脚本、6 个测试文件；新增 1 个改名后的配置页；修改约 20 个源文件、9 个测试、4 份文档与 `cordis.patch.yml`、`package.json`。

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级 `@deepseek-ai/*`；只移除本插件专属的前端构建依赖 |
| II. 测试同步 | 通过。删除在场测试，替代覆盖写在 `managed-ask-guard.test.ts`、`client.test.ts`、`sa-dispatch.test.ts`；实机验收按 D-102 覆盖装载、配置页与拦截 |
| III. 文档结构 | 通过。`README.md` 删除「在场状态」并写明渠道规则；`how-it-works.md` 删除在场机制、更新路由表与被管理会话表；`known-risks.md` 删除在场风险；`development.md` 更新文件地图与测试表；字典保持 zh/en 键集一致；CHANGELOG 在推送前加条目 |
| IV. 质量门禁 | 通过。实现后运行 `pnpm format && pnpm check`，并运行 `pnpm build` |
| V. 公开引用 | 通过。新增内容只引用仓内路径；随 `holidays.ts` 删除的公网数据源 URL 不再出现在仓库中 |

## Project Structure

### Documentation (this feature)

```text
specs/067-presence-removal/
├── spec.md              # 需求规格
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── data-model.md        # Phase 1 输出
├── quickstart.md        # Phase 1 输出
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/
├── config.ts                            # 删除 holidayCachePath
├── constants.ts                         # 删除 HOLIDAY_* 与 PRESENCE_TICK_MS
├── reminder.ts                          # 桥接会话统一经 lark_notify，正文最多一句
├── lark-super-agent/
│   ├── index.ts                         # 删除状态、调度、路由与观察
│   ├── config.ts                        # 只保留任务模型与任务预设
│   ├── api.ts                           # 删除 presence 字段
│   ├── service.ts                       # 删除 presence；任务建立时通知被管理会话
│   ├── managed/
│   │   ├── index.ts                     # 接线取消回调与加载时扫描
│   │   ├── ask-guard.ts                 # 无条件拒绝、取消、S 排队
│   │   └── task-rules.ts                # 新 S 正文；本地会话结构
│   ├── presence.ts                      # 删除
│   ├── routes.ts                        # 删除
│   ├── schedule.ts                      # 删除
│   ├── alarms.ts                        # 删除
│   └── holidays.ts                      # 删除
├── sa-dispatch/
│   ├── index.ts                         # 删除提醒插入
│   └── prompt.ts                        # 删除在场段落，修正上报转达
└── client/
    ├── index.ts                         # 删除按钮与控制器；挂任务配置页
    ├── api.ts                           # 删除在场与节假日接口
    ├── locales.ts                       # 删除在场文案，presenceConfig.* 改 taskConfig.*
    ├── task-config.tsx                  # 由 presence-config.tsx 改名并精简
    ├── presence-config.tsx              # 删除
    ├── presence-controller.ts           # 删除
    ├── presence-button.tsx              # 删除
    ├── presence-alarms-editor.tsx       # 删除
    ├── presence-alarms.css              # 删除
    ├── tailwind.css                     # 删除
    └── ui/                              # 删除（button、cn、input、input-group、popover、time-picker、tooltip）

scripts/
└── build-client-css.mjs                 # 删除

tests/
├── presence.test.ts                     # 删除
├── presence-routes.test.ts              # 删除
├── presence-schedule.test.ts            # 删除
├── presence-client.test.ts              # 删除
├── presence-alarms.test.ts              # 删除
├── presence-alarms-client.test.ts       # 删除
├── managed-ask-guard.test.ts            # 无条件拒绝、取消、S
├── client.test.ts                       # 任务配置页与槽位注册
├── lark-super-agent-index.test.ts       # 行不再注册在场
├── sa-dispatch.test.ts                  # 不插提醒、提示词无在场段落
├── model-defaults.test.ts               # 改用 TaskConfigForm
├── preset-defaults.test.ts              # 改用 TaskConfigForm
├── tool-schema.test.ts                  # 构造服务不再传 presence
├── session-create.test.ts               # 服务桩去掉 presence
└── list-models.test.ts                  # 服务桩去掉 presence

cordis.patch.yml                         # 删除两个开关默认值
package.json                             # 删除专属依赖与 css:build 脚本
pnpm-lock.yaml                           # pnpm install 后更新
README.md                                # 删除在场章节，写明渠道规则
docs/how-it-works.md                     # 删除在场机制，更新路由与能力表
docs/known-risks.md                      # 删除在场风险
docs/development.md                      # 更新文件地图与测试表
CHANGELOG.md                             # 推送前加条目
```

**Structure Decision**: 沿用现有单插件布局，删除机制对应的文件，不新增模块。配置页去掉在场内容后改名，测试支撑与发布结构不变。

## Complexity Tracking

无偏离。
