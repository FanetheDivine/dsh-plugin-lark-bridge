# Research: 调度提示词规定任务会话的置顶与归档

## R-01 提示词注入点与冲突措辞

**Decision**: 只改 `src/sa-dispatch/prompt.ts` 的 `SA_DISPATCH_PROMPT`，并在 `src/sa-dispatch/tools.ts` 删除 `task_end` 描述里的政策句。

**Rationale**:

- 提示词由 `src/sa-dispatch/index.ts` 以 `systemPrompt.section`（`sa-dispatch:instructions`，order 700）注册，全部规则只在这一份文本里。
- 与需求冲突的现有措辞共三处：
  - `## Start a task`：没有任何置顶步骤。
  - `## Manage existing sessions`：`session_manage` 后没有置顶步骤，`session_unmanage` 未说明置顶保留。
  - `## Decide when a task is done`：`Ending a task archives the task and its reports. It leaves the session unarchived.` 明确写着不归档会话。
- `task_end` 描述 `The session stays unarchived; archive it separately when the user wants that.` 的后半句与新规则冲突；前半句是工具行为事实，保留。

**Alternatives considered**:

- 在 `session_create` 与 `session_manage` 的代码里直接置顶：超出用户限定的「只改提示词」范围，且 FR-010 要求代码行为不变。
- 改写工具描述补上步骤：步骤要求只写在提示词里，避免同一规则两处维护。

## R-02 提示词结构

**Decision**: 三处内联生命周期步骤，加一节 `## Keep the session list current` 放跨场景规则，紧跟 `## Decide when a task is done`。

**Rationale**:

- 内联步骤与上下文顺序一致：`session_create` 后置顶、`session_manage` 后置顶、`task_end` 后归档。
- 跨场景规则集中一节，避免在三个小节里重复「只在任务开始或用户要求时置顶」与失败处理。
- 新小节只写内联步骤没有的信息，控制提示词长度：再次置顶的条件、归档会移除置顶、置顶或归档失败的处理。

**Alternatives considered**:

- 每条规则都内联：三处重复失败处理，提示词变长。
- 新增小节并删除内联步骤：模型需要跨节引用才能知道何时调用 `session_pin`，可靠性更差。

## R-03 宿主语义核对

**Decision**: 提示词要求归档用 `session_archive` 且传 `stop_activity: true`，不要求归档前取消置顶。

**Rationale**:

- 宿主 `@deepseek-ai/dsh-workspace` 的 `WorkspaceRegistry.archiveSession` 在同一次持久化写入中把会话从置顶集合移除，归档与置顶互斥。
- `pinSession` 对已归档会话抛 `WorkspaceArchivedSessionPinError`，因此不能先归档再置顶。
- `meta-tools` 0.1.7 的 `session_pin` 为幂等置顶，`session_archive` 暴露 `stop_activity`，运行中的会话在传 `true` 时可归档。

## R-04 测试

**Decision**: 更新 `tests/sa-dispatch.test.ts` 的小节顺序断言与逐节断言，新增置顶、归档与失败处理断言。

**Rationale**:

- 该文件已有 `section(title)` 辅助函数按 `## ` 切分提示词，新增小节只需加入断言。
- `提示词按顺序包含全部小节` 断言完整标题列表，新增 `Keep the session list current` 必须同步。
- 现有断言 `It leaves the session unarchived` 与新规则冲突，改为断言归档要求。
- `task_end` 描述断言：现有测试只检查描述以字母开头，补充删句断言。

## R-05 文档

**Decision**: 更新 `docs/how-it-works.md` 的调度提示词条目与结束任务说明，更新 `CHANGELOG.md` 的 Unreleased 条目；`README.md` 按用户结论不改。

**Rationale**:

- `docs/how-it-works.md` 是机制归属文档，现有「结束任务不归档会话」必须改写，否则与提示词矛盾。
- CHANGELOG 按分支规则在 push 或 merge 时增加。
- 宪章原则 III 要求用户可见行为变化更新 `README.md`，与用户结论 D-006 冲突；按治理规则以用户要求为准，偏离记录在 `plan.md` 的 Complexity Tracking。
