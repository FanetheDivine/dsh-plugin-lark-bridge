# Quickstart: 上报先存档后投递、归档即重建与未读补投

## 前置

```sh
pnpm i
pnpm check
```

## 单元与构建

```sh
pnpm test:code -- lark-super-agent-reports lark-super-agent-service lark-super-agent-blocks lark-super-agent-notes managed-task-log managed-turn-report lark-super-agent-index
pnpm full-check
```

## 隔离 profile 实机验证

1. 搭建环境：

   ```sh
   bash .dsh/skills/real-device-test/scripts/setup-env.sh <worktree 绝对路径> rdt-071
   ```

2. 改写 profile 的 `cordis.patch.yml` 主行配置：

   ```yaml
   - id: dsh-plugin-lark-bridge
     config:
       workspaceRoot: <测试工作区 Linux 风格路径>
       sessionPreset: sa-dispatch
   ```

3. 把驱动脚本复制到 profile 目录，按以下场景运行。脚本通过 `runProfile` 加载宿主，使用 `app.get('larkSuperAgent')` 与 `app.agents`。

| 场景 | 操作 | 断言 |
| --- | --- | --- |
| 归档重建 | 预建会话写入桥接状态，调用 `workspaceRegistry.archiveSession` 归档它，再调用 `sendReport` | 结果 `delivered: true`；`reports/<taskId>/*.md` 存在；`git log` 含报告提交；桥接状态指向新会话 |
| 不存在新建 | 桥接状态写不存在的 `sessionId` | 结果 `delivered: true`；出现新会话；桥接状态更新 |
| 未读补投 | 手工在台账放两份未读报告，再调用 `sendReport` | 新会话事件中的块列出三份路径与先读说明；`deliveredReportIds` 含三份 |
| 无工作区 | 桥接状态 `workspaceRoot: null` | 结果 `delivered: false`、`reason: no_workspace`；工作区无新增报告；不建会话 |
| 正常投递 | 桥接状态指向存活会话 | 结果 `delivered: true`；块只列未读报告 |
| 并发 | 两个被管理会话同时 `sendReport`，桥接状态无会话 | 只建一个会话；两份报告都送达；`deliveredReportIds` 各记一份 |

4. 清理：结束 GUI 进程，删除 profile 目录。

## 期望结果

- 六个场景全部 PASS。
- `pnpm full-check` 通过。
- 工作区 `git status --porcelain` 为空。