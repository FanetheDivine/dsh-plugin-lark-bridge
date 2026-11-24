# Implementation Plan: 侧栏在场状态按钮

**Branch**: `feat/042-presence-toggle` | **Date**: 2026-11-24 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/042-presence-toggle/spec.md`

**Status**: Approved

## Open Decisions

无。

## Clarifications

### Session 2026-11-24

- [P-003] Q: 调度提示词中「没有提醒时按远程处理」如何调整？ -> A: 调度与工作会话的提示词都删除无提醒时的默认，只说明各位置如何处理。该回答改变了规格，已回到澄清，见 spec D-009、D-014 至 D-018。
- [P-001] Q: 两个配置项的字段名与文案？ -> A: `guiInputSetsLocal`「网页输入时切换为在电脑旁」；`larkInputSetsRemote`「收到飞书消息时切换为离开」。
- [P-002] Q: 切换失败如何告知用户？ -> A: 图标恢复原状态，按钮改用错误色 3 秒，悬停提示改为「切换失败，点击重试」。
- [P-004] Q: 按钮显隐如何判定？ -> A: 按 [R-02](./research.md#r-02-按钮随飞书任务与调度会话行显示)，以 `/lark-bridge/presence` 是否回答 JSON 判断。
- [P-005] Q: 是否做实机验证？ -> A: 做，按 [quickstart](./quickstart.md) 的场景。
- [P-006] Q: 在场提醒的 `source.kind` 用什么？ -> A: 两个预设共用的 `sa-presence`。
- [P-007] Q: 共用提醒正文？ -> A: 按 [data-model 提醒正文](./data-model.md#提醒正文)。
- [P-008] Q: 两份系统提示词的在场章节？ -> A: 按 [research R-08](./research.md#r-08-系统提示词的在场章节)。

## Review Record

- 2026-11-24 | Decision: Approved | Scope: current full document | Open items: none | Risks: 见 [风险](#风险)

## Summary

`lark-super-agent` 行持有内存中的全局在场状态，提供两个配置开关与 `/lark-bridge/presence` 路由。前端在侧栏页脚注册按钮，每 3 秒同步状态，单击切换。`SA-调度会话` 与 `SA-工作会话` 每次模型请求前按提醒消息的 `source` 属性比较状态，不一致时插入共用正文的提醒。两份系统提示词只说明各位置的处理方式。

## Technical Context

**Language/Version**: TypeScript 6，Node `>=24.9.0`，React 18

**Primary Dependencies**: 宿主 `@deepseek-ai/*@0.2.2-rc.5`；新增 type-only devDependency `@deepseek-ai/dsh-client-ui-sidebar@0.2.2-rc.5`

**Storage**: 无。状态只在内存中

**Testing**: vitest `code` 与 `dist`；实机验证用 `real-device-test` skill

**Target Platform**: DSH Web GUI 与桌面版，Windows、macOS、Linux

**Project Type**: DSH 插件 npm 包

**Performance Goals**: 单击后 200 毫秒内换图标；状态 3 秒内同步

**Constraints**: 宿主依赖保持 external；页面隐藏时暂停轮询

**Scale/Scope**: 约 500 行源码与对应测试

## 设计

### 宿主侧

| 文件 | 变更 |
| --- | --- |
| `src/lark-super-agent/presence.ts` | 新增 `PresenceStore`：`get`、`set`、`observe`，见 [data-model](./data-model.md#presencestore)；新增 `presenceReminder(session, messages)` 与共用提醒正文，供两个子行调用 |
| `src/lark-super-agent/config.ts` | 新增行 `Config`：`guiInputSetsLocal`、`larkInputSetsRemote`，布尔、volatile、默认 true |
| `src/lark-super-agent/routes.ts` | 新增 `/lark-bridge/presence`，见 [contract](./contracts/presence-route.md) |
| `src/lark-super-agent/index.ts` | 导出 `Config`；创建 store 交给服务；注册路由与全局 `agent/pre-step` 观察 |
| `src/lark-super-agent/service.ts`、`api.ts` | 服务暴露 `presence` |
| `src/routes.ts` | 导出来源校验与 JSON 响应函数供新路由复用 |
| `src/sa-dispatch/presence.ts` | 删除，逻辑移入 `src/lark-super-agent/presence.ts` |
| `src/sa-dispatch/index.ts` | 去掉 `WeakMap`；调用服务的 `presenceReminder` 插入提醒 |
| `src/sa-dispatch/prompt.ts` | 在场章节按 R-08 重写 |
| `src/sa-worker/index.ts` | `agent/pre-step` 在包裹调度消息后调用 `presenceReminder` 插入提醒 |
| `src/sa-worker/prompt.ts` | 模式章节按 R-08 重写 |
| `cordis.patch.yml` | `lark-super-agent` 行写入两个默认配置 |

### 前端

| 文件 | 变更 |
| --- | --- |
| `src/client/presence-controller.ts` | 轮询 GET、POST 切换、乐观更新与回滚、可用性判断；订阅接口与 `StatusController` 一致 |
| `src/client/presence-button.tsx` | 页脚按钮：显示器与手机图标、悬停样式、`title` 与 `aria-label`、折叠栏 CSS |
| `src/client/presence-config.tsx` | `lark-super-agent` 行配置页：两个 `Switch` 与保存操作 |
| `src/client/index.ts` | 创建控制器；可用时注册 `sidebar.footer.action`，不可用时注销；注册行配置页 |
| `src/client/locales.ts` | 新增 `presence.*` 与行配置文案，中英文 |

### 文档

| 文件 | 变更 |
| --- | --- |
| `README.md` | 在场按钮与两个开关的用法 |
| `docs/how-it-works.md` | 在场状态、路由、提醒属性与观察点 |
| `docs/known-risks.md` | 手机浏览器输入被记为在电脑旁 |

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I 宿主依赖版本 | 通过。新增 `@deepseek-ai/dsh-client-ui-sidebar` 锁定 `0.2.2-rc.5` 并列入 `minimumReleaseAgeExclude` |
| II 测试同步 | 通过。新增 `tests/presence.test.ts`、`tests/presence-routes.test.ts`、`tests/presence-client.test.ts`，更新 `tests/sa-dispatch.test.ts`、`tests/sa-worker.test.ts`、`tests/lark-super-agent-index.test.ts`；按 P-005 实机验证 |
| III 文档结构 | 通过。用户可见行为写 README，机制写 `how-it-works.md`，风险写 `known-risks.md`；新文件写顶部注释 |
| IV 质量门禁 | 通过。每阶段执行 `pnpm format && pnpm check` |
| V 公开引用 | 通过。文档只引用仓库内路径与公网 URL |

## Project Structure

### Documentation (this feature)

```text
specs/042-presence-toggle/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/presence-route.md
├── icon-preview.png
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── lark-super-agent/{presence,config,routes}.ts   # 新增
├── lark-super-agent/{index,service,api}.ts        # 修改
├── sa-dispatch/presence.ts                        # 删除
├── sa-dispatch/{index,prompt}.ts                  # 修改
├── sa-worker/{index,prompt}.ts                    # 修改
├── routes.ts                                      # 导出复用函数
└── client/
    ├── presence-controller.ts                     # 新增
    ├── presence-button.tsx                        # 新增
    ├── presence-config.tsx                        # 新增
    └── {index,locales}.ts                         # 修改
tests/
├── presence.test.ts
├── presence-routes.test.ts
├── presence-client.test.ts
└── {sa-dispatch,sa-worker,lark-super-agent-index}.test.ts
```

**Structure Decision**: 状态、配置与提醒逻辑归 `lark-super-agent` 行，两个预设子行只负责调用与提示词，界面归主行前端 bundle。

## 风险

- 前端 bundle 随主行加载。主行停用时按钮与配置页都不显示，即使 `lark-super-agent` 行仍启用。
- 会话空闲时切换不会唤醒它；状态只在下一次模型请求前生效。
- 工作会话不再按消息来源切换模式。用户关闭 GUI 输入开关后，在工作会话直接对话不会切到本机模式。

## Complexity Tracking

无。
