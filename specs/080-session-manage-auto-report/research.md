# Research: 加入管理时自动上报会话最后文本

## 根因

- `src/lark-super-agent/managed/index.ts` 在 `session/event` 上把所有会话事件交给 `TurnReporter`。
- `src/lark-super-agent/managed/turn-report.ts` 的 `observe` 在 `turn/start` 建立轮次状态，在 `assistant/message` 记录最后文本，在 `turn/end` 调用 `finish` 后删除该会话状态。
- `finish` 依次检查结束原因为 `completed`、本轮未调用 `send_report`、文本非空、无运行中子代理、会话已被管理。会话在未管理时结束轮次，最后一项不通过，直接返回且状态已被删除。
- `manageSession` 只建立任务，没有补发路径，于是接管一个已经结束轮次的会话不会收到任何上报。

## 决定 1：由 `TurnReporter` 保留最后轮次并补发

- Decision: 轮次状态在 `turn/end` 后保留到下一次 `turn/start`，新增 `catchUp(sessionId, taskId)` 以同一判定重放最后轮次。
- Rationale: 观察器已经持有文本、`send_report` 调用与结束原因；补发与轮次上报共用判定，行为一致。会话历史读取在本仓库依赖宿主的 `eventAt`/`surface`（已在 `firstUserText`、任务日志与提醒中使用），但无法得到「本轮是否调用过 `send_report`」与结束原因，重放判定比读历史更准确。
- Alternatives considered:
  - 在 `manageSession` 中读会话历史拼最后文本：无法判断异常结束与本轮上报状态，且需要新增历史扫描。
  - 在 `finish` 中延迟上报等接管：无法预知接管，且延迟投递会改变现有轮次上报时机。

## 决定 2：每会话串行队列

- Decision: `TurnReporter` 维护 `Map<sessionId, Promise>`；`finish` 与 `catchUp` 都排入该队列串行执行判定与投递。
- Rationale: `finish` 在判定前 `await managedTask`，接管可能在读取前建立任务，两边都会判定该轮「未上报且已管理」并各投递一次。串行化让后执行者看到先执行者的结果。
- Alternatives considered:
  - 只检查会话状态：宿主在轮次关闭期间仍为 `running`，状态检查与事件处理之间没有原子性，无法消除交错。
  - 全局锁：粒度大于需要，且会串行无关会话的上报。

## 决定 3：已投递任务标识

- Decision: 轮次状态记录 `reportedTaskId`；`finish` 成功存档后写入当前任务标识，`catchUp` 在同一任务上看到该标识即跳过。
- Rationale: 区分「同一接管瞬间已由轮次结束投递」与「上一次管理已投递」。再次管理建立新任务，标识不同，按规格 D-006 再次上报。不按正文内容去重。
- Alternatives considered:
  - 按正文去重：与规格 D-006 冲突，相同文本在不同任务上需要重发。
  - 删除已上报状态：无法区分并发窗口。

## 决定 4：服务接线

- Decision: `LarkSuperAgentService` 增加补发回调设置项；`managed/index.ts` 装配时注册 `TurnReporter.catchUp`；`manageSession` 在 `createTask` 后 `await` 补发，异常在观察器内记日志并吞掉。
- Rationale: 服务不依赖被管理会话模块，接线由现有装配点完成；`session_create` 直接调用 `createTask`，不经过 `manageSession`，新会话没有轮次状态，不会误发。
- Alternatives considered:
  - 复用 `setManagedSessionListener`：该监听同时承担提问取消，语义混杂；`session_create` 也会触发。
  - `catchUp` 不等待：工具返回与上报入队的先后不确定，测试与调用方行为不稳定。

## 决定 5：文档与测试

- Decision: 更新 `docs/how-it-works.md` 的「被管理会话能力」表与「上报投递与失败监听」；测试覆盖补发条件、并发去重、再次管理与投递失败。
- Rationale: 机制变化归开发者文档；`README.md` 不写内部上报细节。
- Alternatives considered: 不更新文档；会让文档与行为不一致，违反宪章 III。

## 未采用的外部事实

- 宿主 `agent.status` 在轮次关闭完成后才回到 `idle`，不能作为「轮次已结束」的判据。补发以观察到的 `turn/end` 为准。
- 宿主的种子事件不会进入 `session/event`，因此插件加载前已结束的轮次没有补发，已记入 spec 的 Assumptions。