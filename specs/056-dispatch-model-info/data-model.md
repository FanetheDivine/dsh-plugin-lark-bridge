# Data Model: 调度会话模型信息查询工具

**Feature**: `specs/056-dispatch-model-info/` | **Date**: 2026-11-26

工具 `list_models` 的输出即本特性的全部数据；无持久化实体。

## ProviderEntry

一次输出中一个已注册 provider 的条目。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `provider` | string | 是 | provider 路由 id，宿主原始拼写，可直接传给 `session_create.provider`。 |
| `models` | ModelEntry[] | 是 | 该 provider 下的 model，宿主返回顺序。 |

## ModelEntry

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `model` | string | 是 | model id，宿主原始拼写，可直接传给 `session_create.model`。 |
| `efforts` | string[] | 是 | 该路由支持的 reasoning effort id，按宿主给出的从弱到强顺序；路由未声明时为空数组。可直接取值传给 `session_create.effort`。 |

## SkippedEntry

被跳过的部分；`model` 缺省表示 provider 级跳过。

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `provider` | string | 是 | 失败的 provider id。 |
| `model` | string | 否 | 失败的 model id；缺省表示整个 provider 目录失败。 |
| `error` | string | 是 | 失败原因的可读文本。 |

## 输出封套

```text
{ providers: ProviderEntry[], skipped: SkippedEntry[] }
```

规则：

- `providers` 只含目录读取成功的 provider。
- `skipped` 按失败发生顺序排列；无失败时为空数组。
- 全部 id 保留宿主原始拼写，禁止改写大小写或别名映射。
