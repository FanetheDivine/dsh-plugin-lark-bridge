# Quickstart: 通知正文卡片与上报正文色

## 自动验证

```sh
pnpm format
pnpm full-check
```

重点用例：

```sh
pnpm vitest run tests/notify-node.test.ts tests/notify-card.test.ts tests/card-styles.test.ts tests/client.test.ts
```

预期：只有成功结果与 nonempty 正文同时存在时才产卡片；卡片只含正文并保留换行；两类卡片容器使用主前景令牌。

## 实机验证

按 `.dsh/skills/real-device-test` 流程准备隔离 profile，使用 mock 模型与可控 lark-cli，避免向真实用户发送测试消息。

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 成功通知 | 桥接会话调用 `lark_notify`，正文含多行与 Markdown 记号 | 轮次层级只显示完整正文，无标题或回执，换行保留，无需点击即可见 |
| 失败通知 | 未绑定用户或 mock CLI 失败时调用 | 只有宿主默认工具行与错误，无卡片 |
| 历史加载 | 重新打开含成功通知的会话 | 调用与结果均加载时显示正文卡片；缺调用时不产生空卡片 |
| 正文颜色 | 触发一次含正文、desc、附件的 `send_report`，并查看通知卡片 | 上报正文、任务简介、附件名与通知正文均和普通助手正文同色 |
| 折叠可见性 | 折叠过程分组与轮次 | 两类卡片保持默认可见 |

实机截图与结果记录到本规格目录，跟踪文件只使用仓库内相对路径。
