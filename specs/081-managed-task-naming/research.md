# Research: 接管会话的任务名基于会话标题生成

## 现状

- `session_manage` 建立任务时，`SuperAgentService.manageSession` 执行 `agent?.session?.title?.replace(...) || id`。
- 任务名因此退回会话 id，例如 `session-aadc3913-...`。
- `tests/lark-super-agent-service.test.ts` 的会话对象自行携带 `title` 字段，测试通过，真实宿主上读取恒为 `undefined`。

## 宿主事实

- `@deepseek-ai/dsh-session` 的 `Session` 类没有 `title` 属性。标题是 log-only 的 `session/title` 事件，客户端通过 `title` 投影读取。
- `@deepseek-ai/dsh-session-title` 的 `SessionTitleService.get(session)` 返回最新折叠标题 `{ title, ... }`，插件可从 `ctx.get('sessionTitle')` 取得该服务。
- 该包已在 `devDependencies` 中（`sessions.ts` 已用 `import type {} from '@deepseek-ai/dsh-session-title'` 扩展事件表），本次不新增依赖。
- `session_manage` 的工具结果已含 `title`，调度会话可直接获得生成任务名的依据。

## 结论

1. 用 `sessionTitle.get(session)` 读取标题，替代 `session.title`。
2. 保留现有的换行折叠与去空白，再以会话 id 兜底。
3. 提示词补规则：基于返回标题生成任务名，用 `task_update` 写入，不用会话 id。
4. 测试改为注入 `sessionTitle` 模拟，覆盖真实读取路径与回退。
