# Contract: `list_models` 工具

**Feature**: `specs/056-dispatch-model-info/` | **Date**: 2026-11-26

工具定义遵循 `@deepseek-ai/dsh-tools` 的 `defineTool`，注册于 `SA-调度会话` 预设作用域。

## 请求

```text
name: list_models
parameters: 无（空参数表）
```

## 成功输出（JSON）

```json
{
  "providers": [
    {
      "provider": "deepseek",
      "models": [
        { "model": "deepseek-chat", "efforts": ["minimal", "medium", "high"] },
        { "model": "deepseek-reasoner", "efforts": ["high"] }
      ]
    }
  ],
  "skipped": []
}
```

- 字段定义见 [data-model.md](../data-model.md)。
- `efforts` 为空数组表示该路由未声明 effort，`session_create` 调用应省略 `effort` 参数。

## 失败输出

| 条件 | 行为 |
| --- | --- |
| 宿主 `llm` 服务未挂载 | 工具抛出错误：模型目录暂不可用（llm service 未挂载） |
| 某 provider 目录读取失败 | 调用成功，该 provider 进入 `skipped`，无 `model` 字段 |
| 某 model 元数据解析失败 | 调用成功，该 model 进入 `skipped`，含 `model` 字段 |

## 渲染

与其他调度工具一致：`render` 输出 JSON 文本块。
