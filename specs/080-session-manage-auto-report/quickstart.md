# Quickstart: 加入管理时自动上报会话最后文本

## 前置

- Node >= 24.9，已执行 `pnpm install`。
- 测试在仓库根目录运行。

## 验证命令

```bash
pnpm run test:code -- tests/managed-turn-report.test.ts tests/lark-super-agent-service.test.ts
pnpm format && pnpm check
```

## 场景

1. **接管补发**：未管理会话完成一轮，最后文本为 `T`；`manageSession` 后 `sendReport` 以 `{ kind: 'progress', text: T }`、会话标识与 `turn_end` 被调用一次。
2. **空白文本**：最后文本为空或空白；`manageSession` 成功，`sendReport` 不被调用。
3. **异常结束**：最后轮次 `reason.kind` 为 `error` 或 `cancelled`；不补发。
4. **本轮上报过**：最后轮次调用过 `send_report`；不补发。
5. **运行中子代理**：子代理检查返回真；不补发。
6. **轮次仍在运行**：未观察到 `turn/end`；不补发；随后 `turn/end` 正常上报一次。
7. **并发**：轮次结束处理已排队并在读取任务前延迟，接管先建立任务；最终该轮文本只上报一次。
8. **再次管理**：同一最后文本先上报给任务 A，取消管理后再次管理建立任务 B；补发对任务 B 再上报一次。
9. **投递失败**：`sendReport` 抛错或返回未送达；`manageSession` 成功，任务存在，日志含失败信息。

## 预期结果

- `session_manage` 返回字段保持 `sessionId`、`taskId`、`title`。
- 上报文件位于 `reports/<taskId>/<reportId>.md`，front matter 的 `origin` 为 `"turn_end"`。
- 调度会话收到的任务会话消息带 `kind="progress"` 与 `origin="turn_end"`。