# Research: 被管理会话提问拦截改为代为上报

日期：2026-11-26。宿主版本 0.2.2-rc.5。证据为包源码行号与当日实机/生产记录。

## R1 拦截点：`tools/execute` 环绕钩子

- Decision：工具体接管逻辑放在 `tools/execute` 环绕钩子；`tools/pre-execute` 对被管理会话返回 `allow`。
- Rationale：`pre-execute` 的 deny 走错误结果通道（`dsh-tools/src/pipeline.ts:214-226`），错误结果不能携带 `concludesTurn`（`contracts.ts:360`），无法结束轮次；环绕钩子不调 `next()` 即跳过工具体，返回成功结果 + `exec.concludeTurn()` 后由 `normalizeDispatchResult → createSuccessResult` 附上 `concludesTurn`（`pipeline.ts:567-573,579-596`）。宿主自身的 PTC 执行器就是这么转发标记的（`dsh-tool-executor-ptc/src/ptc.ts:626`）。
- Alternatives：post-execute 改写错误结果——错误通道的 `isError` 与 `value?: never` 约束使其拿不到成功语义；`user-questions/request` 内注册回答器竞争——与远程转发桥的注册顺序耦合，不可靠（rdt 探针：root 监听收不到已被 api-remotes 截走的请求）。

## R2 `pre-execute` 仍保留的原因

- Decision：保留 `beforeExecute`，对被管理 ask 返回 `allow`（此前返回 deny）。
- Rationale：`ask` 决策会进入审批等待（`pipeline.ts:204-206,440-481`）；提前返回 `allow` 跳过审批等待，也提前结束该会话已挂起的旧提问。若整段删除该钩子，其他插件的 `ask`/`deny` 决策可能把被管理会话重新拖入等待。

## R3 合成结果通过输出校验

- Decision：返回 `{isError:false, value:{answers:[]}}`。
- Rationale：legacy 输出 schema 要求 `answers` 数组、无最少条数（`dsh-tool-ask-user/src/index.ts:77-98`）；timed schema 的 `oneOf` 第二分支匹配 `{answers:[]}`（`timed.ts:156-192`）。宿主按 schema 校验并渲染后接受。
- Alternatives：抛错走拒绝——失去结束轮次能力；伪造答案——误导模型。

## R4 模型可见文案

- Decision：`tools/post-execute` 对被拦截调用返回 `{kind:'accept', content:[notice]}` 替换内容。
- Rationale：`postExecute` 的 accept 允许替换 `content`（`pipeline.ts:529-532`），`value` 保持 schema 合法；notice 文本即 D-004 的「已代为上报」。
- Alternatives：`deferContext`/`additionalContexts` 注入用户消息——与内容替换等效但多一条消息记录，卡片展示更乱。

## R5 轮次终止的数据

- Decision：依赖宿主「成功结果携带 `concludesTurn` 即在该步结束轮次」；同批其余调用照常完成。
- Rationale：`dsh-agent/src/runtime-types.ts:408-414`；`dsh-tools/src/batch.ts:132-147,229-233` 聚合 `concluded`。
- 实机：已用带探针构建在 rdt 环境验证 pre-execute deny 与工具体跳过路径；`concludesTurn` 分支由实现后 rdt 场景 1 复验（turn/end 在同一事件窗口出现）。

## R6 `turn/end` 自动上报去重

- Decision：拦截成功后调用 `TurnReporter.markIntercepted(sessionId)`，把当前轮标记为已上报。
- Rationale：`TurnReporter` 仅在看到 `tool/call send_report` 时置 `reported`（`managed/turn-report.ts:73-76`）；不标记则轮次结束会再补一条 `turn_end` 的 progress 上报（`:109-124`），与问题上报重复。
- Alternatives：把 `tool/call ask_user_question` 一律视为已上报——投递失败回退路径会被错误抑制。

## R7 任务状态落账

- Decision：`in_progress` 时经 `updateTask(status='waiting_user')`；其余状态跳过。
- Rationale：转换表只允许 `in_progress ↔ waiting_user / → failed`（`notes.ts:248-252`）；`updateTask` 对同状态放行（`notes.ts:270-274`），`failed → waiting_user` 抛错，跳过即可。

## R8 生产与实机证据（缺陷根因）

1. 0.4.6 时代（presence 条件守卫）：被管理会话 `session-1b54fe86` 的 5 次 ask 全部真实等待（9～1228 秒；1 次跨日未决），用户取消或界面回答。
2. 主工作区 `dist/` 为 pre-067 陈旧产物：rdt 用该产物完整复现「被管理会话 ask 挂起」，网关 `user-questions/request` pending 1 条；worktree 重建（HEAD 代码）后同一场景 3ms 内被拒绝、轮次继续。
3. 生产（0.4.7 重启后）`session-06956f2f`：deny 3ms 生效，模型随后 `send_report(question)` 送达——证明缺陷残余是「依赖模型二次上报与调度会话再落状态」的设计缺口，而非拒绝失效。
4. 同日 0.4.6→0.4.7 热升级存在旧模块残留（task-20261126181045-6459 诊断，重启后恢复）：混合状态下旧守卫服务请求，确定性拦截（工具体不运行）消除对守卫新旧版本的依赖。
