# Research: 任务会话消息不含会话元信息

## R-001 调度会话写入任务会话的路径

- Decision: 只有两条，均由调度模型书写文字。
- Evidence: `src/sa-dispatch/session-create.ts` 用 `agent.steer` 发送首条 `prompt`；meta-tools `session_send` 的 `text` 经 `src/lark-super-agent/managed/dispatch-message.ts` 包装为 `<dispatch_session_message>` 块，插件不改写正文。
- Alternatives Considered: 运行期过滤正文。拒绝：会误伤用户原话与任务所需路径，且偏离项目「假设模型按预期行为」的既有口径（069 D-004）。

## R-002 宿主已提供工作目录事实

- Decision: 会话的系统提示词含当前工作目录，调度会话无须重复。
- Evidence: 宿主运行时的 system-reminder 含「Current working directory」；会话元信息含验证后的 `cwd`（`@deepseek-ai/dsh-agent` 的 `index.ts`）。

## R-003 宿主已提供模型切换事实

- Decision: 模型切换由宿主在下一步写入 `[model changed: ...]` 提示，切换方无须通知任务会话。
- Evidence: `@deepseek-ai/dsh-agent/src/model-selection.ts` 的 `modelSwitchNotice` 与 `installModelSelection`。

## R-004 失败原因只在调度侧

- Decision: 上一轮失败原因只出现在调度会话的 `task_session_failure` 注入块，任务会话自身可见其轮次错误；调度会话转述失败原因属于元信息泄露。
- Evidence: `src/lark-super-agent/blocks.ts` 的失败通知构造；提示词「Other messages from the service」。

## R-005 现状提示词的泄露点

- Decision: 第 35 行要求 prompt 写「its target workspace」；其余小节未限制元信息内容。
- Evidence: `src/sa-dispatch/prompt.ts`；`tests/sa-dispatch.test.ts` 现有断言未覆盖元信息。

## R-006 文档归属

- Decision: 机制写 `docs/how-it-works.md`，残余风险写 `docs/known-risks.md`「被管理会话与调度消息」。
- Evidence: 宪章 III 文档结构；两文档现有段落。