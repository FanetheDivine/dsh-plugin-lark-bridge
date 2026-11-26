# Research: 调度会话向用户提及任务时同时给出名称与 id

## R-01 调度提示词的规则落点与措辞

- Decision：在 `## Reply style` 末尾新增一条形式规则；`## Start a task` 末句改写。
  - 新条目：`Mention tasks to the user as "<title> (<task id>)": the task's current title, one half-width space, and the task id in half-width parentheses. Every mention uses this full form. When the title cannot be resolved, say so and give the id.`
  - 改写句：`The new session becomes the task's only session. Tell the user the workspace and the task as "<title> (<task id>)".`
- Rationale：`Reply style` 是既有的全局话术规则位，一条规则即覆盖创建、转述、状态、结束全部场景（FR-002、FR-003 无需逐节重复）；`Start a task` 原句「Tell the user the task id and the workspace」是唯一要求裸 id 的表述，必须改写（FR-006）。改写句保留 `task's only session` 子串，既有断言 `expect(start).toMatch(/task's only session/)` 不失效。
- Alternatives Considered：新增独立小节（如 `## Name tasks`）——小节列表测试需同步扩充，且与 `Reply style` 职责重叠，收益不足；在 Handle reports 等每节逐条重复——违背简洁写作规范。

## R-02 桥接提醒的插入位置与措辞

- Decision：在回复规则之后、`<quote>` 说明之前插入一行：`- 向用户提及任务时写成「名称 (id)」：名称取任务当前标题，id 取 task id；缺少名称时说明并给出 id。`
- Rationale：该位置紧邻「回复用户时引用用户的消息」，属于同一组“回复内容”规则（`src/reminder.ts` 第 18 至 21 行）；措辞为条件式（“提及任务时”），未管理任务的桥接会话不受影响（D-003）。提醒正文为中文列表风格，沿用现有句式。
- Alternatives Considered：放在末尾「其他来源的用户消息」之后——位置远离回复规则组，易被当作元信息；写成无条件命令——对非调度桥接会话产生无法执行的义务。

## R-03 形式字符串的可测试性

- Decision：测试以精确子串断言。调度提示词断言包含 `"<title> (<task id>)"` 与 `Every mention uses this full form`，并断言不再包含 `Tell the user the task id and the workspace`；桥接提醒断言包含 `名称 (id)`。
- Rationale：仓库测试即用 `toContain`/`toMatch` 校验提示词文本（`tests/sa-dispatch.test.ts`、`tests/reminder.test.ts` 现状）；半角括号加一个空格的形式在英文句中自然成立（`title` 后必有一个空格再接括号），无需额外正则。
- Alternatives Considered：正则匹配宽松形式——放宽了就测不出「固定全形式」这一验收点；快照测试——与现有逐条断言风格不一致。

## R-04 文档落点

- Decision：`docs/how-it-works.md` 在「调度服务与预设叠加」的行为条目列表中，紧跟“回复只给结论、保持简短”条目后新增一条：`- 对用户提及任务时写成「名称 (id)」：名称取台账当前标题，每次提及都用全形式；名称取不到时说明并给出 id。桥接提醒对提及任务的情况提出同样要求。转述上报时上报原文中的其他任务提及保持原样。` `CHANGELOG.md` Unreleased 增加一条摘要。
- Rationale：输出形式是调度会话行为，归属该列表（宪章 III：每条信息只有一个归属文档）；提醒文本细节在 how-it-works 只写机制不写全文，本文条目已覆盖提醒中的同一要求，不再在「消息与会话流程」一节重复。
- Alternatives Considered：README 增补——超出需求给定范围（见 Complexity Tracking）；在提醒机制条目下展开文本内容——形成两处维护。

## R-05 构建与产物链路

- Decision：源码文本变更后依次运行 `pnpm format && pnpm check`（typecheck、lint、test:code），再 `pnpm build` 重建 `dist/sa-dispatch.mjs` 并经 test:dist 校验产物新鲜度。
- Rationale：`SA_DISPATCH_PROMPT` 与 `BRIDGE_REMINDER` 都进入宿主入口 bundle（`tsdown.config.ts`），`tests/dist-freshness.test.ts` 要求 dist 与源码同步。
- Alternatives Considered：仅 test:code——dist 过期会使发布校验失败。
