# Research: 移除用户在场机制

## R-01 无条件拦截的判定位置

**Decision**: 保留 `tools/pre-execute` 的 `beforeExecute` 作为唯一判定点：先 `await next()`，遇到他方的 `deny` 或 `cancel` 时原样返回；其余情况对被管理会话一律返回 `deny`，并先取消该会话已在等待的提问。

**Rationale**: 现有拦截已在 `tools/pre-execute` 生效，`next()` 先运行能保留其他插件的审批决定与错误语义。判定不再读任何状态，只查任务台账。

**Alternatives considered**:

- 在 `tools/execute` 直接返回错误：绕过 `pre-execute` 的审批与可见性判定，错误形态也与拒绝反馈不同。
- 为每个会话注册独立的提问工具：工具的可见性按会话计算，提问工具由宿主提供，无法按会话替换。

## R-02 取消已在等待提问的触发点

**Decision**: 三个触发点共用同一个 `cancel(sessionId)`：

1. `beforeExecute` 判定前取消该会话。
2. 插件加载时 `sweep()` 扫描网关 `pendingRemoteEvents`，对 `user-questions/request` 且 `isManaged(agentId)` 的请求逐个取消。
3. 任务建立时经服务回调取消，覆盖 `session_manage` 与 `session_create`。

**Rationale**: 只有网关里的等待请求能覆盖插件加载前开始的提问；`tools/execute` 的控制器覆盖插件加载后开始的提问，两者都要保留。任务建立是唯一让会话从「未管理」变成「被管理」的入口，`createTask` 是两条路径的公共终点。

**Alternatives considered**:

- 只依赖网关取消：取消后无法把结果改写为统一反馈，模型看到的错误形态取决于宿主。
- 定时轮询任务台账：增加计时器与延迟，且插件加载后仍要扫网关，收益为零。
- 在每个 `agent/pre-step` 检查：会话在等待提问时不会进入下一步，检查不会发生。

## R-03 S 的排队与注入

**Decision**: 沿用 `pendingRules` 集合与 `takeRules`：每次拒绝或取消都记一次，`agent/pre-step` 取走后把 S 插到本批消息最前，`hasTaskRules` 防止重复。S 正文改写为「本会话不能直接向用户提问，改用 `send_report` 的 `question`」，删除「用户不在电脑前」的表述。

**Rationale**: 这是现有机制，行为已验证；只有文案随原因改变。立即在下一个请求注入，能尽快把模型切到上报通道。

**Alternatives considered**:

- 在任务建立时直接注入 S：会让每个任务的首轮都多一段指令，且任务本可以正常上报，不需要提前约束。
- 拒绝时把 S 作为工具反馈返回：反馈只影响当前步，下一次请求仍需系统消息，两条路径重复。

## R-04 统一渠道的归属

**Decision**: 渠道规则只写在 `src/reminder.ts` 的桥接提醒里。`SA-调度会话` 的提示词删除「Track where the user is」整段，`Handle reports` 的转达句子去掉「through the channel for the current presence」。

**Rationale**: `lark_notify` 只在桥接会话可见与可执行。`SA-调度会话` 也可能被用于非桥接会话，硬编码「调用 lark_notify」会在那里失败。桥接提醒按 `sessionId` 注入，天然只在桥接会话出现。

**Alternatives considered**:

- 在调度提示词里直接要求 `lark_notify`：非桥接的调度会话会调用失败。
- 按消息来源在提示词里分流：与 D-003 的「一律经 `lark_notify`」冲突。

## R-05 正文一句话规则与失败例外

**Decision**: 在桥接提醒里加一条：`lark_notify` 成功送达后，本轮正文最多一句概述，允许为空，完整内容只写在通知里；同一条提醒说明通知失败时正文保留完整内容。删除「其他来源的用户消息按普通方式回复」与「会话里的 text 块尽量少输出」两条，前者被统一渠道替代，后者被一句话规则替代。

**Rationale**: 与 `send_report` 描述的收尾规则同口径；失败例外避免模型在发送失败时丢掉全部内容。

**Alternatives considered**:

- 由宿主或工具截断正文：插件无法控制模型输出，也没有截断入口。
- 只在调度提示词里写：漏掉使用其他预设的桥接会话。

## R-06 前端与 Tailwind 的清理边界

**Decision**: 删除 `src/client/ui/`、`tailwind.css`、`tailwind.generated.css`、`scripts/build-client-css.mjs` 与九项专属 devDependencies；`dev`、`check`、`build`、`test:code` 去掉 `css:build`。保留 `@tsdown/css`、tsdown 的 `css: { fileName: 'client.css' }` 与 `inlineClientCss`。

**Rationale**: `src/client/ui/` 的两个使用方都是在场组件。上报卡片的 `report-card.css` 与官方模型选择器的 CSS module 仍需要 tsdown 打包并内联；这条管线与 Tailwind 无关。

**Alternatives considered**:

- 一并移除 `@tsdown/css`：会丢掉上报卡片与选择器样式。
- 保留 Tailwind 只删组件：构建与依赖仍在，违背 D-007。

## R-07 配置命名与旧键兼容

**Decision**: `presence-config.tsx` 改名为 `task-config.tsx`，导出改为 `TASK_ROW_ID`、`TASK_ROW_KEY`、`TaskConfigForm`、`TaskConfigPage` 等，hook 键改 `taskConfig`，字典键前缀改 `taskConfig.`。三个在场配置键从 schema 与 `cordis.patch.yml` 删除。

**Rationale**: schemastery 的 `object` 不剥离未知键（本地验证：`S({ a: false, stale: 1 })` 原样保留 `stale`），因此旧 profile 里的在场键不会导致加载失败，插件只是不再读取。

**Alternatives considered**:

- 保留旧键并把值丢弃：需要额外注释解释无用字段，还会出现在配置页。
- 迁移旧配置：没有需要保留的数据，迁移只会引入一次性代码。

## R-08 测试替换策略

**Decision**: 删除 6 个在场测试文件。`managed-ask-guard.test.ts` 改为覆盖无条件拒绝、`cancel` 中止、`sweep` 网关扫描与 S 只生效一次；`sa-dispatch.test.ts` 断言不插提醒、提示词无在场段落；`client.test.ts` 断言任务配置页与槽位注册；配置页相关测试改用 `TaskConfigForm`；服务桩去掉 `presence`。

**Rationale**: 现有测试直接验证行为，改名与删除后仍能复用它证明规格的每一条验收场景。

**Alternatives considered**:

- 保留在场测试并标记跳过：会在仓库里留下失效机制。

## R-09 文档归属

**Decision**: `README.md` 删除「在场状态」章节并按用户视角写明「回复一律到飞书」；`docs/how-it-works.md` 删除在场机制与时间控件小节，更新路由表、被管理会话能力表、桥接提醒与依赖说明；`docs/known-risks.md` 删除在场风险；`docs/development.md` 更新文件地图、测试表与构建说明；`CHANGELOG.md` 在推送前加一条。

**Rationale**: 宪章 III 要求机制与风险归 `docs/`、用户行为归 `README.md`、开发结构归 `docs/development.md`，且同一信息只写一处。

**Alternatives considered**:

- 只改 README：`docs/` 会继续描述已删除的机制与路由。

## R-10 实机验收方式（D-102）

**Decision**: 复用 `real-device-test` 的 mock provider 环境：A1 校验装载；B 用 mock 模型在被管理会话里调用 `ask_user_question`，断言拒绝与下一次请求里的 S；C 打开插件页与任务配置页，断言没有在场开关、时间与页脚按钮。不发送真实飞书消息，`lark_notify` 的渠道规则以请求中的提醒文本为准。

**Rationale**: mock 环境能驱动真实宿主链路且不触碰用户飞书；渠道规则是提示词内容，检查请求即可证明。

**Alternatives considered**:

- 真实飞书收发：会打扰用户、依赖当前授权，且不增加对规格的覆盖。
