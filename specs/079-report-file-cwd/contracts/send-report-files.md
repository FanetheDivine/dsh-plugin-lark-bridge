# Contract: send_report 的 files 解析

**Date**: 2026-11-27 | **Plan**: [plan.md](../plan.md)

## 入参

| 参数 | 类型 | 约束 |
| --- | --- | --- |
| `kind` | `progress \| question` | 必填 |
| `text` | string | 与 `files` 至少提供一项 |
| `files` | string[] | 每项为 Markdown 文件路径；绝对路径直接使用，相对路径按调用会话当前工作目录解析 |
| `desc` | string | 可选 |

## 解析

```text
files 项
  ├─ 绝对路径 ──────────────→ 直接校验
  └─ 相对路径 → 基准目录 + 项 → 校验
基准目录 = workingDirectory.get(session)
         ?? session.header.cwd
         ?? 任务记录的 cwd
         ?? process.cwd()（记 warn）
```

## 输出

成功结果保持不变：

```json
{ "reportId": "...", "taskId": "...", "reportPath": "reports/<taskId>/<reportId>.md", "delivered": true }
```

## 错误

```text
send_report files must be existing .md files: <原始值> -> <绝对路径> (base <基准目录>)
```

- 多个无效项以 `;` 分隔后再附一次 `(base ...)`。
- 非 `.md`、目录、不存在的路径都按无效项报错。
- 会话未被管理时，附件校验先执行，错误类型保持不变。

## 兼容性

- 绝对路径行为不变。
- 存档、投递、附件复制、`reportId` 生成不变。
