# Implementation Plan: 飞书消息队列与批量注入

**Branch**: `fix/032-drop-stale-messages` | **Date**: 2026-11-21 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/032-drop-stale-messages/spec.md`

**Status**: Approved

## Open Decisions

无。技术选择见「技术决策」，均由规格、代码现状或宿主约束决定。

## Clarifications

### Session 2026-11-21

- 规格已确认 9 项决策（D-001 至 D-009），无遗留待定项。

## Review Record

- 2026-11-21 | Decision: Approved | Scope: current full document | Open items: none | Risks: 每条消息固定延后 15 秒；启动前消息永久丢弃；重推节奏依赖飞书服务端

## Summary

把事件桥从「逐条立即注入」改为「队列 + 15 秒静默 + 批量注入」：

- 监听仍要求 CLI、bot、user、工作区全部就绪后启动。
- 事件先按 `message_id` 去重，再按监听启动时刻过滤重推的旧消息。
- 通过过滤的消息进入队列；每次入队重置 15 秒静默计时。
- 计时到点后一次取走队列全部消息，按 `create_time` 升序拼成一个用户消息，每条一个 `<lark-message>` 块。
- 注入失败整批丢弃；监听停止时清空队列与计时器。
- 配置保存、工作区增删不再重启监听；只有鉴权身份变化时停止或重启。

## Technical Context

**Language/Version**: TypeScript 6、Node.js >= 24.9、ESM

**Primary Dependencies**: `@deepseek-ai/dsh-agent`、`@deepseek-ai/dsh-session`、`@deepseek-ai/dsh-llm`（宿主注入，保持 external）；本机 `lark-cli` 1.0.98

**Storage**: DSH home 下的 `lark-bridge/state.json`，保存 `sessionId`、`workspaceRoot`、`title`、`seen` 与 `updatedAt`

**Testing**: vitest 4，`test:code` 与 `test:dist` 两个 project；质量门禁 `pnpm format && pnpm check`

**Target Platform**: DSH 宿主（Windows、macOS、Linux），事件消费者为子进程

**Project Type**: DSH 插件（单包，`src/` + `tests/`）

**Performance Goals**: 单批注入在静默窗口到点后立即发起；事件读取不因注入阻塞

**Constraints**: 事件消费者只允许一个实例；ACK 由 lark-cli 完成；插件不额外响应远程

**Scale/Scope**: 单用户私聊桥接，队列长度为个位数到几十条

## 技术决策

- PD-001 队列位置：放在 `EventBridge`。事件过滤、去重与监听生命周期都在该类内，队列与它们共享同一份状态。
- PD-002 监听启动时刻：沿用 `spawn()` 写入的 `startedAt`。消费者以 `--quiet` 启动，没有 ready 标记可读；`spawn` 时刻早于连接建立，判定只会放宽几秒，符合 10 秒时钟偏差假设。
- PD-003 批次格式：块之间用一个空行连接，作为单个文本注入。`createUserMessage` 只接收一条消息，提醒补注仍按 `isLarkMessage` 命中该消息。
- PD-004 工作区检查：`handleEvent` 不再检查工作区，改由 `SessionManager.inject` 抛出 `BridgeError`，`drain` 捕获后按失败丢弃并记录。
- PD-005 生命周期：`reconcile` 只在鉴权未就绪时停止监听；`loader/volatile-update` 与 `domain/changed` 不再调用 `bridge.stop()`。
- PD-006 静默计时：`setTimeout` 保存句柄，每次入队先 `clearTimeout` 再重建；回调先清空句柄再调用 `drain`；`timer.unref()`。
- PD-007 注入期间到达：`drain` 用 `draining` 标记串行化；结束后若队列非空且没有计时器，重新安排 15 秒计时。
- PD-008 停止清理：`stop()` 清空计时器与队列，并记录丢弃条数。
- PD-009 测试：更新 `tests/bridge.test.ts` 的工作区用例；新增静默窗口、批量顺序、过滤、失败丢弃与清理用例。
- PD-010 文档：更新 `docs/how-it-works.md` 的消息与生命周期、`docs/known-risks.md` 的事件流、`README.md` 的功能说明。

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| 原则 | 结论 | 依据 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 不改 `package.json` 与 `pnpm-workspace.yaml` 的宿主依赖 |
| II. 测试同步 | PASS | `tests/bridge.test.ts` 覆盖新行为；涉及宿主装载的链路在 quickstart 中列入实机验证 |
| III. 文档结构 | PASS | 机制写 `docs/how-it-works.md`，风险写 `docs/known-risks.md`，用户功能写 `README.md` |
| IV. 质量门禁 | PASS | 实施后运行 `pnpm format && pnpm check` |
| V. 公开引用 | PASS | 计划与规格只使用仓库内相对路径 |

Phase 1 设计完成后复查：结论不变。

## Project Structure

### Documentation (this feature)

```text
specs/032-drop-stale-messages/
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
├── spec.md
├── checklists/requirements.md
└── tasks.md            # /speckit-tasks 生成
```

### Source Code (repository root)

```text
src/
├── bridge.ts           # 事件过滤、队列、静默计时、批量注入
├── constants.ts        # 新增 INJECT_SILENCE_MS
├── index.ts            # 监听生命周期：配置/工作区变化不重启
├── sessions.ts         # inject 保持不变
└── state.ts            # 去重窗口保持不变

tests/
├── bridge.test.ts      # 队列、计时、过滤、失败用例
└── plugin.test.ts      # 接线与卸载用例

docs/
├── how-it-works.md
└── known-risks.md
README.md
```

**Structure Decision**: 单包插件，改动集中在 `src/bridge.ts` 与 `src/index.ts`，测试集中在 `tests/bridge.test.ts`。

## Complexity Tracking

无宪章偏离。

## 实施顺序

1. `src/constants.ts` 增加 `INJECT_SILENCE_MS = 15_000`。
2. `src/bridge.ts` 增加队列、计时器、`drain` 与过滤日志；调整 `sync` 与 `handleEvent`。
3. `src/index.ts` 移除配置与工作区变化时的 `bridge.stop()`。
4. `tests/bridge.test.ts` 更新并新增用例。
5. 更新 `docs/how-it-works.md`、`docs/known-risks.md`、`README.md`。
6. 运行 `pnpm format && pnpm check`。
