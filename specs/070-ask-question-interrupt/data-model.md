# Data Model: 提问拦截上报

## 实体变更

### ReportOrigin（联合类型，`src/lark-super-agent/api.ts`）

| 值 | 含义 | 变化 |
| --- | --- | --- |
| `send_report` | 会话主动上报 | 不变 |
| `turn_end` | 轮次结束自动上报 | 不变 |
| `ask_intercept` | 插件拦截 `ask_user_question` 代为上报 | 新增 |

### 拦截上报正文（D-001）

`questionReportText(questions)` 由调用参数生成，单条问题一节：

```
The task session asked (answered via the dispatch session or Lark; this session stays blocked until then):
- [header] <question>
  options: <label — description>; ...
```

- `questions` 非数组或为空时正文回退为固定说明句。
- 每题一行题面；有 `options` 时补一行选项列表；`multi_select` 与 `header` 按存在输出。

### AskGuard 会话内状态（内存，进程生命周期）

| 成员 | 键 → 值 | 用途 | 变化 |
| --- | --- | --- | --- |
| `waiting` | sessionId → callId → AbortController | 结束等待中的提问 | 不变 |
| `aborted` | callId 集合 | 改写中止结果 | 不变 |
| `intercepted` | callId 集合 | post-execute 识别拦截成功的调用并替换文案 | 新增 |
| `pendingRules` | sessionId 集合 | 下一次模型请求前注入 S | 不变（仅回退路径使用） |

### 任务状态

转换不变（`in_progress → waiting_user → in_progress` 等）。新增触发方：拦截上报投递成功时，插件把 `in_progress` 置 `waiting_user`；`waiting_user`/`failed` 跳过。

## 流程数据

```
模型调用 ask_user_question（会话有未结束任务）
  → pre-execute：cancel 旧等待，返回 allow
  → tools/execute 环绕：不调 next（工具体不运行）
      → intercept(sessionId, questions)
          → sendReport(kind=question, origin=ask_intercept) → 存档 + 注入调度会话
          → task.status==in_progress 时 updateTask(waiting_user)
          → reporter.markIntercepted(sessionId)
      → 成功：exec.concludeTurn(); 返回 {isError:false, value:{answers:[]}}
      → 失败：requireRules(sessionId); 返回 {isError:true, error:ASK_BLOCKED_ERROR}
  → post-execute：intercepted 命中 → accept 并替换 content 为上报说明
  → batch 聚合 concluded=true → 轮次在该步结束（reason completed）
```
