# Implementation Plan: 调度会话响应策略与上报投递

**Branch**: `feat/069-dispatch-response-policy` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/069-dispatch-response-policy/spec.md`

**Status**: Approved

## Open Decisions

None.

## Clarifications

### Session 2026-11-26

- [P-001] Q: 是否新增 `task_send` 工具？ -> A: 不新增（spec D-012）。
- [P-002] Q: 报告归档路径回退由谁实现？ -> A: 只写进调度提示词，代码不改归档语义（spec D-033）。
- [P-003] Q: 计划与任务审查如何授权？ -> A: 用户 2026-11-26 指示「后续请自行推进：plan → tasks → 实现……无需中途向用户确认」。本条视为对完整 plan 与 tasks 的批准，记录于 Review Record。
- [P-004] Q: 任务日志里停止条目的来源？ -> A: `session/event` 中 `turn/end` 的 `reason` 为 `{ kind: 'aborted', reason: { kind: 'user' } }`，并排除已在 `workspaceRegistry.archivedSessionIds` 中的会话。宿主先写归档集合再请求停止，因此取消发生时该会话已在归档集合内（见 research.md R-007）。
- [P-005] Q: 卡片 30 KB 上限的口径？ -> A: 按 `JSON.stringify(card)` 的 UTF-8 字节数计算，与飞书接口口径一致；拆分阈值含卡片骨架开销，实现时用实际 JSON 体积判断。

## Review Record

- 2026-11-26 | Decision: Approved | Scope: current full document | Open items: none | Risks: 见下方 Constitution Check 与 Risks。授权依据：用户在 spec 批准后明确「后续请自行推进：plan → tasks → 实现」。

## Summary

按规格改四块：

1. 提示词：`src/sa-dispatch/prompt.ts` 新增「Respond to the user」段并重写报告处理、转发判断；`src/reminder.ts` 的桥接提醒同步改合并口径、任务名由插件补写、注入消息不回复。
2. 上报投递与注入：`src/lark-super-agent/blocks.ts` 的上报块去掉 `desc` 与正文、改带工作区相对路径；`src/lark-super-agent/service.ts` 的投递复用轮次结束兜底。
3. `lark_notify`：新增 `mode`、`summary`、`task_id`，卡片 JSON 生成与拆分，返回值收敛为消息 id，结果元数据供 GUI 解析任务会话。
4. 任务日志：新增 `task-logs/<taskId>.jsonl` 的写入与 pre-step 注入，归档随任务迁移。

## Technical Context

**Language/Version**: TypeScript（ES2024 风格，仓库现有配置）

**Primary Dependencies**: 宿主提供的 `@deepseek-ai/*`（全部 external）；`zod`（参数与存档校验）；`dsh-plugin-meta-tools`（运行依赖，不动）

**Storage**: 调度工作区文件：`message-task-status.json`、`workspaces.json`、`reports/`、`archive/`、新增 `task-logs/`

**Testing**: `vitest`（`tests/`，`test:code` 跑源码，`test:dist` 跑产物）；`pnpm check` 为合并门禁

**Target Platform**: DSH 宿主（Windows/macOS/Linux）；飞书 bot 经 `lark-cli`

**Project Type**: DSH 插件（Node 库 + 浏览器 client）

**Performance Goals**: 无新增吞吐目标；pre-step 注入允许按缓存的扫描位置增量读取，避免每次全量扫描

**Constraints**: 不引入新依赖；`@deepseek-ai/*` 版本锁定与 `minimumReleaseAgeExclude` 不变；文档、注释、提交说明遵循 AGENTS.md 写作规范

**Scale/Scope**: 规格 52 条 FR、14 条 SC；改动集中在 `src/sa-dispatch/`、`src/lark-super-agent/`、`src/tools.ts`、`src/reminder.ts`、`src/client/notify-*`、`src/client/locales.ts`、`docs/`、`README.md` 与 `tests/`

## Constitution Check

- I 宿主依赖版本：不新增、不升级 `@deepseek-ai/*` 依赖，`pnpm-workspace.yaml` 与 `package.json` 的版本不动。通过。
- II 测试同步：每个实现阶段同步更新 `tests/`；单元测试用 `tests/helpers.ts` 的模拟 ctx；发布内容由现有 `package-pack` 测试回归，本次不改打包清单；涉及真实对话链路，必须做真实宿主端到端验证（见 quickstart.md）；`dsh` 版本不变，无需版本提醒。通过。
- III 文档结构：`README.md` 写用户可见的卡片模式与回应规则；`docs/how-it-works.md` 写机制、`docs/known-risks.md` 写风险；不跨文档复述；`CHANGELOG.md` 在 push 前按分支规则补条目；新文件顶部与导出函数各写一句职责注释。通过。
- IV 质量门禁：文件变更后运行 `pnpm format && pnpm check`，合并前 `pnpm check` 通过。通过。
- V 公开引用：文档与规格只写仓库内相对路径与公网 URL，不写本机盘符路径。通过。

无违反项，Complexity Tracking 不需要填写。

## Phase 0 研究结论

详见 [research.md](./research.md)。关键点：

- R-001 卡片用 Card 2.0 的 `collapsible_panel`，`expanded: false`，面板内放 `markdown`；`lark-cli im +messages-send --as bot --user-id <owner> --msg-type interactive --content -`，回复时改 `+messages-reply --message-id <id>`。
- R-002 模型可见结果与 GUI 元数据分离：`render` 只给「已发送（om_xxx）」，`presentationMeta` 投影 `{ taskSessionId }`。
- R-003 任务日志条目 id = `<sessionId>:<seq>`，幂等由派生 id 与文件内查重保证。
- R-004 已注入判定扫调度会话完整事件日志；注入消息使用自定义来源 `lark-task-log`，条目 id 同时写进正文的 `<task_log_entry>` 块，判定以来源加正文为准，不依赖来源附加字段是否持久化。进程内缓存只保存已扫描的 seq 与已见 id，丢失后从 seq 0 重建。
- R-005 写入进 `runSerial(root)`，写前重新读台账确认任务未结束。
- R-006 归档迁移 `task-logs/<taskId>.jsonl` → `archive/<taskId>/task-log.jsonl`，提交两侧路径。
- R-007 停止条目只在 `turn/end` 为 `aborted` 且 `reason.kind === 'user'`、会话不在 `archivedSessionIds` 时写入；任务结束后再取消由 FR-040 的任务存在性检查兜底。
- R-008 上报投递兜底复用 `sessions.ts` 的 `settleSteering` 策略，抽到共享位置或按同逻辑实现。
- R-009 GUI 通知卡片匹配器同时识别新旧成功文案。
- R-010 `task_id` 查找由 `lark_notify` 直接读状态文件与台账，不依赖 `lark-super-agent` 行。

## Phase 1 设计

- [data-model.md](./data-model.md)：任务日志条目、注入消息、上报块、通知参数与结果、归档结构。
- [contracts/](./contracts/)：`lark_notify` 参数与结果契约、上报块契约、任务日志文件契约。
- [quickstart.md](./quickstart.md)：验证命令与真实宿主验收步骤。

### 实现拆分（对应 tasks.md 阶段）

1. **提示词与桥接提醒**：`prompt.ts` 重写相关段落；`reminder.ts` 同步。
2. **上报块与投递**：`blocks.ts`、`service.ts`、路径工具。
3. **lark_notify**：`tools.ts` 拆分出 `notify-card.ts`（卡片 JSON 构造与拆分）、`notify-tasks.ts`（task_id 解析）；`src/index.ts` 传入新的依赖。
4. **GUI 通知卡片**：`notify-node.ts`、`notify-card.tsx`、`locales.ts`、`notify-card.css`。
5. **任务日志**：`lark-super-agent/task-log.ts`（读写与归档）、`managed/` 的观察与 pre-step 注入、`notes.ts` 的归档迁移。
6. **文档与变更日志**。

## Project Structure

### Documentation (this feature)

```text
specs/069-dispatch-response-policy/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── contracts/
├── checklists/
├── spec.md
└── tasks.md
```

### Source Code (repository root)

```text
src/
├── sa-dispatch/prompt.ts            # 调度提示词
├── reminder.ts                      # 桥接提醒
├── tools.ts                         # lark_notify 参数与执行
├── notify-card.ts                   # 新增：飞书卡片 JSON 构造与拆分
├── notify-tasks.ts                  # 新增：task_id → 任务与会话
├── lark-super-agent/
│   ├── blocks.ts                    # 上报块与日志注入块
│   ├── service.ts                   # 投递兜底
│   ├── notes.ts                     # 归档时迁移日志
│   ├── task-log.ts                  # 新增：日志读写与归档辅助
│   └── managed/
│       ├── index.ts                 # 观察用户直接消息/取消 + pre-step 注入
│       └── task-log-injector.ts     # 新增：已注入判定与注入消息构造
├── client/
│   ├── notify-node.ts               # 新旧结果识别 + 卡片数据
│   ├── notify-card.tsx              # 总结/正文/task id/任务会话链接
│   └── locales.ts                   # 文案
docs/how-it-works.md
docs/known-risks.md
README.md
CHANGELOG.md
tests/                                # 对应新增与更新
```

**Structure Decision**: 单仓库插件，沿用现有目录划分；新增模块按职责就近放置。

## Risks

- 提示词行为靠模型遵守，实机验收必须覆盖下发即回应、按任务分开通知、不重发循环。
- 卡片 JSON 30 KB 与折叠面板在旧客户端的表现需要实机确认。
- 任务日志只记用户直接交互，其他事件仍靠报告与台账；归档后只作历史留存。
