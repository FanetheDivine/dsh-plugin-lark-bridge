# Implementation Plan: 修复 send_report 卡片不显示报告内容

**Branch**: `fix/061-send-report-card` | **Spec**: [spec.md](./spec.md) | **Status**: Waived

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current full document | Open items: none | Risks: 卡片依赖宿主 `conversation.chat.node` 与 Conversation Definition 扩展点，宿主升级需回归。

## Summary

1. 取消 `tool.call.toolview` 的 `send_report` 接管，`send_report` 工具行回到宿主默认行，覆盖进行中、失败、中断。
2. 新增 Conversation Definition：匹配 `send_report` 的 `tool/call` 与成功 `tool/result`，成功时产出一个 `lark-report` Chat 节点，`groupTree` 为 `turn`，不走过程分组、不受轮次折叠。
3. 新增 `conversation.chat.node` 的 `lark-report` 渲染器：类型标签、任务简介、Markdown 正文、可点击文件列表、报告编号，使用宿主主题变量。
4. 测试、文档与实机验证。

## Constitution Check

- I 宿主依赖版本：新增 `@deepseek-ai/dsh-client-ui-chat@0.2.2-rc.5`（与 `dsh-agent` 同版本），并登记 `minimumReleaseAgeExclude`。PASS
- II 测试同步：单元测试覆盖参数提取、成功/失败判定、注册与产物；实机端到端验证。PASS
- III 文档结构：机制写入 `docs/how-it-works.md`，风险写入 `docs/known-risks.md`，用户可见行为写入 `README.md`，`CHANGELOG.md` 记 Unreleased。PASS
- IV 质量门禁：`pnpm format && pnpm check` 与 `pnpm build`。PASS
- V 公开引用：只引用公网 URL 或仓库内路径。PASS

## Technical Context

宿主 0.2.2-rc.5 源码事实：

- `tool.call.toolview` 是键控槽位，命中即替换整个工具行，拿不到默认行（`scoped-slots.tsx` 的 keyed 分支）。
- `ToolResultNode` 的调用参数在 `call.argsRaw`；`argsRaw` 顶层字段只存在于 `StartedToolCall`。
- `conversation.chat.node` 是按 kind 键控的节点槽位，`ChatNodeDataMap` 可被声明合并扩展；`groupTree: 'turn'` 的节点不进入过程分组（`group-tree.ts` 的 `isAtOrOutside`）。
- Conversation Definition 通过 `ctx.uiConversation.events.register()` 注册，`match` 返回 `{id, role}`；只声明 `target` 与 `buildViewNode` 即可产出节点。

设计：Definition 以结果块为 start、以对应调用块为 update，参数从调用块读取，`buildViewNode` 在成功结果时产出节点，否则返回隐藏节点。

## Changes

| 文件 | 变更 |
| --- | --- |
| `src/client/report-node.ts` | 上报参数解析、成功判定与 Conversation Definition |
| `src/client/report-card.tsx` | 改为 `conversation.chat.node` 的 `lark-report` 渲染器 |
| `src/client/report-card.css` | 卡片样式，全部走 `--dsw-*` 令牌 |
| `src/client/index.ts` | 去掉工具视图注册，改为注入 `uiConversation` 并注册 Definition 与节点渲染器 |
| `src/client/locales.ts` | 上报卡片文案键 |
| `src/client/types.d.ts` | 宿主 Chat 的类型扩展声明合并 |
| `package.json`、`pnpm-workspace.yaml` | 新增 `@deepseek-ai/dsh-client-ui-chat` 开发依赖与客户端 inject |
| `tests/report-card.test.ts` | 卡片渲染与参数提取 |
| `tests/report-node.test.ts` | Definition 匹配与节点产出 |
| `tests/client.test.ts`、`tests/client-bundle.test.ts` | 注册接线 |
| `docs/how-it-works.md`、`docs/known-risks.md`、`README.md`、`CHANGELOG.md` | 机制、风险、行为、条目 |

## Verification

1. `pnpm test:code -- tests/report-card.test.ts tests/report-node.test.ts`。
2. `pnpm format && pnpm check && pnpm build`。
3. 实机：`real-device-test` 起隔离 profile 的 `dsh web`，在被管理会话成功上报一次、在普通会话失败一次，Playwright 截图确认成功卡片默认展开可见、失败显示默认行。
