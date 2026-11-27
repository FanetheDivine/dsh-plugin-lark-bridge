# Data Model: send_report 相对附件路径解析

**Date**: 2026-11-27 | **Plan**: [plan.md](./plan.md)

## 实体

### CallerSession（调用会话）

| 字段 | 来源 | 说明 |
| --- | --- | --- |
| `session.header.cwd` | 会话头 | 会话创建时的绝对目录，生命周期内不变 |
| `workingDirectory` 投影 | `working-directory/change` 事件 | 会话当前绝对目录，随 `working_directory` 与 `create_worktree` 更新 |

### ReportFile（上报附件）

| 字段 | 说明 |
| --- | --- |
| `raw` | 调用参数中的原始值，绝对或相对路径 |
| `resolved` | 解析后的绝对路径 |
| `valid` | 扩展名为 `.md` 且指向存在的文件 |

### Task（任务）

| 字段 | 说明 |
| --- | --- |
| `cwd` | 任务所属会话的工作目录，写入时用同一解析链 |

## 解析规则

| 顺序 | 基准目录 | 条件 |
| --- | --- | --- |
| 1 | `workingDirectory.get(session)` | 宿主提供该服务且返回非空 |
| 2 | `session.header.cwd` | 第 1 级不可用 |
| 3 | 任务记录的 `cwd` | 会话句柄缺失或前两级为空 |
| 4 | `process.cwd()` | 前三级都不可用，记 `logger.warn` |

- 绝对路径不参与解析，直接使用。
- 附件按基准目录拼接后校验扩展名与文件存在性，通过后复制进 `reports/<taskId>/`。
- `files` 省略或为空时跳过附件校验。

## 错误文本

```text
send_report files must be existing .md files: <原始值> -> <绝对路径>; ... (base <基准目录>)
```

- 每个无效项一条，`;` 分隔。
- 基准目录只在消息末尾出现一次。
