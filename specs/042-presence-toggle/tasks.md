---
description: "Tasks for 042-presence-toggle"
---

# Tasks: 侧栏在场状态按钮

**Input**: `specs/042-presence-toggle/` 下的 plan.md、spec.md、research.md、data-model.md、contracts/、quickstart.md

**Tests**: 宪章 II 要求代码变更同步测试；plan P-005 要求实机验证。

**Commit**: 每个阶段一个 commit。阶段结束前运行 `pnpm format && pnpm check`。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 可并行，文件不同且不依赖未完成任务
- **[Story]**: 对应 spec.md 的用户故事

---

## Phase 1: Setup（依赖）

**Purpose**: 槽位类型可用

- [X] T001 在 `package.json` 的 `devDependencies` 增加 `"@deepseek-ai/dsh-client-ui-sidebar": "0.2.2-rc.5"`；在 `pnpm-workspace.yaml` 的 `minimumReleaseAgeExclude` 按字母序加入 `'@deepseek-ai/dsh-client-ui-sidebar@0.2.2-rc.5'`；运行 `pnpm install` 更新 `pnpm-lock.yaml`
- [X] T002 确认 `tests/dependency-versions.test.ts` 覆盖新依赖并通过；需要时更新断言

**Checkpoint**: commit `chore(042): 增加侧栏槽位类型依赖`

---

## Phase 2: Foundational（全局状态、配置与路由）

**Purpose**: `lark-super-agent` 行提供在场状态、两个配置项与 `/lark-bridge/presence`，所有用户故事依赖它

- [X] T003 新增 `src/lark-super-agent/presence.ts`：`UserPresence` 类型从 `src/sa-dispatch/presence.ts` 移入；`PresenceStore` 含 `get(): { presence, updatedAt }`、`set(presence)`、`observe(messages)`、`subscribe(listener)`；初始 `local`；`observe` 按 data-model 迁移表判定，`guiInputSetsLocal` 与 `larkInputSetsRemote` 由构造参数的 getter 读取实时值；同批以最后一条可判定消息为准；`WeakSet` 记录已观察的消息对象
- [X] T004 [P] 新增 `src/lark-super-agent/config.ts`：`Config` schema `guiInputSetsLocal: Schema.boolean().default(true).volatile()`、`larkInputSetsRemote: Schema.boolean().default(true).volatile()`；`readPresenceConfig(config)` 读取实时值，缺省为 true
- [X] T005 在 `src/routes.ts` 导出 `rejectReason` 与 `send`，供新路由复用；行为不变
- [X] T006 新增 `src/lark-super-agent/routes.ts`：`registerPresenceRoute({ webServer, connection?, store, logger })` 注册 exact 路由 `/lark-bridge/presence`，GET 与 POST 行为、错误码按 `contracts/presence-route.md`；返回注销函数
- [X] T007 修改 `src/lark-super-agent/index.ts`：导出 `Config`；创建 `PresenceStore` 交给 `SuperAgentService`；`webServer` 经 `ctx.get` 可选读取，存在时注册路由并以 `ctx.effect` 注销；更新顶部注释
- [X] T008 修改 `src/lark-super-agent/service.ts` 与 `api.ts`：服务暴露只读 `presence: PresenceStore`
- [X] T009 在 `cordis.patch.yml` 的 `lark-super-agent` 行写入 `config: { guiInputSetsLocal: true, larkInputSetsRemote: true }` 与注释
- [X] T010 [P] 新增 `tests/presence.test.ts`：初始 `local`；`set` 更新时间；GUI 与飞书消息按开关更新；开关关闭不变；桥接提醒不计入；同批最后一条为准；同一消息对象只生效一次；手动与自动按先后
- [X] T011 [P] 新增 `tests/presence-routes.test.ts`：GET 返回快照；POST 写入；非法 `presence` 返回 400 `invalid-presence`；非回环与 `Origin` 不符返回 403；其他方法返回 `method-not-allowed`；注销后不再处理
- [X] T012 更新 `tests/lark-super-agent-index.test.ts`：导出 `Config`；有 `webServer` 时注册 `/lark-bridge/presence`，卸载时注销；无 `webServer` 时只提供服务；更新 `tests/presets-patch.test.ts` 断言两个默认配置

**Checkpoint**: commit `feat(042): 增加全局在场状态与路由`

---

## Phase 3: User Story 1 - 一眼看到当前在场状态 (Priority: P1) 🎯 MVP

**Goal**: 行启用时页脚显示状态图标，3 秒内同步

**Independent Test**: `tests/presence-client.test.ts` 通过；实机「初始」「多页同步」「行停用」「折叠侧栏」场景

- [ ] T013 [US1] 新增 `src/client/presence-controller.ts`：`PresenceController` 每 3 秒经 `callApi('presence')` 读取，页面隐藏时跳过，`visibilitychange` 与 `focus` 时立即读取；快照含 `available: boolean | null`、`presence`、`pending`、`failed`；`ok` 置 `available: true`，`invalid-response` 置 `false`，`network` 与其他错误保持原值；`subscribe`、`getSnapshot`、`dispose` 与 `StatusController` 一致
- [ ] T014 [US1] 新增 `src/client/presence-button.tsx`：`PresenceButton` 接收 `wide`、`t` 与注入的 `controller`；36×36 圆形透明按钮，悬停底色为当前色 12% 混合；在电脑旁为绿色显示器（`rect x=3 y=4 w=18 h=12 rx=2`、`M12 16v4`、`M8 20h8`），离开为 `var(--dsw-alias-label-secondary)` 手机（`rect x=7 y=2.5 w=10 h=19 rx=2.5`、`M11 18.5h2`），18 px、描边 1.8；`title` 与 `aria-label` 为「在电脑旁 · 点击切换为离开」或「离开 · 点击切换为在电脑旁」；`data-rail` 与折叠栏 CSS 沿用参考插件 `RAIL_CSS`，选择器类名改为 `lbp-entry`
- [ ] T015 [US1] 修改 `src/client/index.ts`：创建 `PresenceController` 并随共享状态清理；订阅可用性，`true` 时用 `ctx.plugin` 挂载子插件注册 `sidebar.footer.action`（`id: 'lark-bridge-presence'`、`order: 52`、`locale: NS`）与折叠栏样式，`false` 时卸载，`null` 时保持
- [ ] T016 [P] [US1] 在 `src/client/locales.ts` 增加 `presence.local`、`presence.remote`、`presence.toLocal`、`presence.toRemote`、`presence.failed` 的中英文
- [ ] T017 [P] [US1] 新增 `tests/presence-client.test.ts`：控制器可用性三种回答；隐藏页不请求；按钮两种状态的图标与文案；`index.ts` 在可用性 true/false 间挂载与卸载槽位

**Checkpoint**: commit `feat(042): 侧栏显示在场状态`

---

## Phase 4: User Story 2 - 点击切换状态 (Priority: P1)

**Goal**: 单击切换；调度会话按全局状态与提醒属性选择渠道

**Independent Test**: 切换与提醒相关测试通过；实机「手动切换」「提醒按属性」场景

- [ ] T018 [US2] 在 `PresenceController` 增加 `toggle()`：立即写入目标状态，POST `{ presence }`；失败时恢复原状态并置 `failed` 3 秒；成功后以回答为准
- [ ] T019 [US2] `PresenceButton` 单击调用 `toggle()`；`failed` 时颜色改为 `var(--dsw-alias-state-error-primary)`，`title` 与 `aria-label` 为「切换失败，点击重试」
- [ ] T020 [US2] 在 `src/lark-super-agent/presence.ts` 增加共用提醒：`PRESENCE_SOURCE_KIND = 'sa-presence'`；正文按 data-model「提醒正文」；`latestPresenceReminder(session)` 从 `session.surface.nodes` 末尾向前找首个 `user/message` 且 `source.kind === 'sa-presence'` 的事件，返回 `source.presence`，非 `local`/`remote` 视为 undefined；`presenceReminder(session, messages)` 先 `observe(messages)`，再与当前状态比较，不同或不存在时返回提醒消息，`source` 为 `{ kind: 'sa-presence', form: 'notice', presence }`
- [ ] T021 [US2] 在 `src/lark-super-agent/presence.ts` 声明 `MessageSourceMap['sa-presence']`；删除 `src/sa-dispatch/presence.ts` 与 `src/sa-dispatch/index.ts` 中的 `sa-dispatch-presence` 声明和 `WeakMap`
- [ ] T022 [US2] 修改 `src/sa-dispatch/index.ts`：`agent/pre-step` 在 `next()` 后调用 `larkSuperAgent.presence` 的提醒函数，有提醒时插到本批消息最前
- [ ] T023 [US2] 按 research R-08 重写 `src/sa-dispatch/prompt.ts` 的 `## Track where the user is`，删除无提醒默认与「Worker reports and failures never change your presence ...」一句
- [ ] T024 [P] [US2] 更新 `tests/sa-dispatch.test.ts`：删除旧 `presenceReminder` 用例；新增按属性查找、状态一致不插入、旧 `sa-dispatch-presence` 提醒不计入、压缩后表层无提醒时补回、提示词不含 `Without any reminder` 与 `用户在电脑前`
- [ ] T025 [P] [US2] 在 `tests/presence-client.test.ts` 增加 `toggle` 乐观更新、失败回滚与 3 秒错误态用例

**Checkpoint**: commit `feat(042): 单击切换在场状态并按属性提醒调度会话`

---

## Phase 5: User Story 3 - 按配置自动更新状态 (Priority: P2)

**Goal**: 任一会话的 GUI 输入与飞书输入按开关更新状态；行配置页可编辑两个开关

**Independent Test**: 观察与配置页测试通过；实机「GUI 输入」「飞书输入」「开关关闭」场景

- [ ] T026 [US3] 在 `src/lark-super-agent/index.ts` 注册全局 `agent/pre-step`：`next()` 后对非 reject 决定调用 `store.observe(decision.messages)`，返回原决定
- [ ] T027 [US3] 新增 `src/client/presence-config.tsx`：行配置页，两个 `Switch` 绑定 `guiInputSetsLocal`、`larkInputSetsRemote`，暂存值为 `'true'`/`'false'`，提供保存与放弃；`view === 'summary'` 返回摘要文案
- [ ] T028 [US3] 修改 `src/client/index.ts`：用 `ctx.configForms.get('lark-super-agent')` 建表单，注册 `plugins.row.config`，`key: 'dsh-plugin-lark-bridge#lark-super-agent'`
- [ ] T029 [P] [US3] 在 `src/client/locales.ts` 增加行配置页文案：「网页输入时切换为在电脑旁」「收到飞书消息时切换为离开」及英文与摘要
- [ ] T030 [P] [US3] 测试：`tests/lark-super-agent-index.test.ts` 断言全局观察按配置更新；`tests/config-form.test.ts` 或新用例断言布尔字段格式与解析；`tests/client.test.ts` 断言行配置页注册键

**Checkpoint**: commit `feat(042): 按配置自动更新在场状态`

---

## Phase 6: User Story 4 - 工作会话跟随在场状态 (Priority: P2)

**Goal**: 工作会话只按在场提醒决定模式

**Independent Test**: `tests/sa-worker.test.ts` 通过；实机「工作会话远程」「工作会话本机」「其他预设」场景

- [ ] T031 [US4] 修改 `src/sa-worker/index.ts`：`agent/pre-step` 在 `wrapDispatchMessages` 之后调用共用提醒函数，有提醒时插到本批消息最前
- [ ] T032 [US4] 按 research R-08 重写 `src/sa-worker/prompt.ts`：标题改为 `## Follow where the user is`；删除远程起始与按来源切换模式的规则；`## Local mode` 删除「用户在电脑前」首行一句
- [ ] T033 [P] [US4] 更新 `tests/sa-worker.test.ts`：删除 `用户在电脑前` 断言；新增提醒插入、状态一致不插入、提示词不含按来源切换的规则

**Checkpoint**: commit `feat(042): 工作会话跟随在场状态`

---

## Phase 7: Polish（文档、构建与实机）

- [ ] T034 [P] 更新 `README.md`：页脚在场按钮的含义与切换、两个开关及默认值
- [ ] T035 [P] 更新 `docs/how-it-works.md`：组成表增加 `src/lark-super-agent/presence.ts`、`routes.ts`；浏览器通信表增加 `/lark-bridge/presence`；重写在场判定段落为全局状态、观察点、提醒属性与共用正文
- [ ] T036 [P] 更新 `docs/known-risks.md`：手机浏览器的 GUI 输入记为在电脑旁；主行停用时按钮与配置页不显示；关闭 GUI 开关后工作会话不切到本机模式
- [ ] T037 运行 `pnpm format && pnpm check && pnpm build`，修复问题；确认 `dist` 与打包测试通过
- [ ] T038 用 `real-device-test` skill 按 `quickstart.md` 全部场景实机验证，结果写入 `specs/042-presence-toggle/real-device-report.md`

**Checkpoint**: commit `docs(042): 在场按钮文档与实机报告`

---

## Dependencies & Execution Order

- Phase 1 → Phase 2 → 其余阶段。
- US1 先于 US2：切换建立在控制器与按钮之上。
- US2 先于 US4：工作会话复用 T020 的共用提醒函数。
- US3 只依赖 Phase 2，可在 US1 之后任意时机进行。
- Phase 7 在全部用户故事之后。

## Parallel Example

```text
Phase 2: T004、T010、T011 可与 T003 之后的路由任务并行
Phase 3: T016、T017 可与 T014 并行
Phase 4: T024、T025 可在实现完成后并行
```

## Implementation Strategy

1. 完成 Phase 1、2 与 US1，即可看到只读的在场图标。
2. 加 US2 获得手动切换与调度会话提醒。
3. 加 US3、US4 完成自动更新与工作会话。
4. Phase 7 补文档并实机验收。
