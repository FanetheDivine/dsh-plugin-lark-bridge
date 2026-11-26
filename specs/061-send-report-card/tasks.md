# Tasks: 修复 send_report 卡片不显示报告内容

## Phase 1: 卡片节点与渲染

- [ ] T001 `src/client/report-node.ts`：解析上报参数、判定成功结果、构造 `lark-report` 节点
- [ ] T002 `src/client/report-node.ts`：注册 Conversation Definition
- [ ] T003 `src/client/report-card.tsx`：改为 Chat 节点渲染器
- [ ] T004 `src/client/report-card.css`：宿主令牌样式
- [ ] T005 `src/client/locales.ts`：中英文案键

## Phase 2: 接线与依赖

- [ ] T006 `src/client/index.ts`：移除 `tool.call.toolview` 注册，注册 Definition 与 `conversation.chat.node`
- [ ] T007 `package.json` 与 `pnpm-workspace.yaml`：新增 `@deepseek-ai/dsh-client-ui-chat` 与客户端 inject

## Phase 3: 测试

- [ ] T008 `tests/report-node.test.ts`：匹配、参数提取、成功与失败节点
- [ ] T009 `tests/report-card.test.ts`：卡片内容与空字段
- [ ] T010 `tests/client.test.ts` 与 `tests/client-bundle.test.ts`：注册接线

## Phase 4: 文档与质量门禁

- [ ] T011 更新 `docs/how-it-works.md`、`docs/known-risks.md`、`README.md`、`CHANGELOG.md`
- [ ] T012 运行 `pnpm format && pnpm check && pnpm build`

## Phase 5: 实机验证

- [ ] T013 隔离 profile 起 `dsh web`，成功与失败各触发一次 `send_report` 并截图
