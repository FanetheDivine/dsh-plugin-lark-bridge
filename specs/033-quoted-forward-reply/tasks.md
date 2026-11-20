# Tasks: 引用与聊天记录呈现、精确回复

**Branch**: `feat/033-quoted-forward-reply` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

**约定**：每个阶段对应一个 commit；提交前运行 `pnpm format && pnpm check`。

## Phase 1: 规格与计划归档

- [ ] T001 提交 `specs/033-quoted-forward-reply/` 的 spec、plan、research、data-model、quickstart 与检查清单
- [ ] T002 提交前运行 `pnpm format && pnpm check`

**Commit**: `docs(033): 规格与实现计划`

## Phase 2: 引用与聊天记录渲染

- [ ] T003 在 `src/constants.ts` 增加 `QUOTE_MAX_CHARS = 500` 与 `QUOTE_TIMEOUT_MS = 8_000`
- [ ] T004 新增 `src/quote.ts`：`readQuoted`（user 优先、bot 兜底、8 秒超时、失败降级）与 `formatQuote`（截断、占位、聊天记录标签、转义）
- [ ] T005 修改 `src/bridge.ts`：`formatLarkMessage(event, quote?)` 输出 `reply_to` 属性、`<quote>` 块与 `<forwarded_messages/>`
- [ ] T006 修改 `src/bridge.ts`：`handleEvent` 在去重后读取引用，读取失败不影响注入
- [ ] T007 新增 `tests/quote.test.ts`：身份回退、超时降级、截断、转义、聊天记录
- [ ] T008 扩展 `tests/bridge.test.ts`：块属性与顺序、聊天记录输出、引用读取失败仍注入
- [ ] T009 提交前运行 `pnpm format && pnpm check`

**Commit**: `feat(033): 引用与聊天记录渲染`

## Phase 3: lark_notify 精确回复

- [ ] T010 修改 `src/tools.ts`：接受 `reply_to`，首段走 `im +messages-reply`，其余段保持发送
- [ ] T011 修改 `src/tools.ts`：`invalid-reply-to` 与 `reply-failed` 错误码与结果结构
- [ ] T012 更新工具定义：参数说明与输出 schema
- [ ] T013 扩展 `tests/tools.test.ts`：参数校验、首段回复、后续段发送、失败不回落
- [ ] T014 提交前运行 `pnpm format && pnpm check`

**Commit**: `feat(033): lark_notify 支持精确回复`

## Phase 4: 桥接提醒

- [ ] T015 修改 `src/reminder.ts`：追加 `reply_to` 引用、引用准确性、移动端简洁、ID 读取四条
- [ ] T016 扩展 `tests/reminder.test.ts`：断言四条存在且补注仍生效
- [ ] T017 提交前运行 `pnpm format && pnpm check`

**Commit**: `feat(033): 提醒引导精确回复`

## Phase 5: 文档与构建

- [ ] T018 更新 `docs/how-it-works.md` 的消息与通知两节
- [ ] T019 更新 `CHANGELOG.md` 的 `Unreleased`
- [ ] T020 运行 `pnpm build`，确认产线测试通过
- [ ] T021 提交前运行 `pnpm format && pnpm check`

**Commit**: `docs(033): 记录引用与精确回复机制`

## 依赖

- Phase 2 依赖 Phase 1 的规格批准。
- Phase 3 与 Phase 4 互相独立，可在 Phase 2 之后并行。
- Phase 5 依赖 Phase 2 至 Phase 4 完成。