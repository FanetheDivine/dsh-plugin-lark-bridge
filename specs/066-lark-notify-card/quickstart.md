# Quickstart: 通知卡片、上报正文色与统一渠道

## 自动验证

```sh
pnpm format
pnpm full-check
```

重点用例：

```sh
pnpm vitest run tests/notify-node.test.ts tests/notify-card.test.ts tests/card-styles.test.ts
pnpm vitest run tests/sa-dispatch.test.ts tests/reminder.test.ts tests/client.test.ts
```

预期：成功回执才产卡片，失败与替换副本被排除；正文保留换行；两类卡片内容色使用主前景令牌；提示词与提醒不存在旧渠道规则。

## 实机验证

按 `.dsh/skills/real-device-test` 流程准备隔离 profile，使用 mock 模型与可控 lark-cli，避免向真实用户发送测试消息。

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 成功通知 | 桥接会话调用 `lark_notify`，正文含多行与 Markdown 记号 | 轮次层级显示「飞书通知」，完整原文保换行，回执含发送/回复与分段数，无需点击即可见 |
| 失败通知 | 未绑定用户或 mock CLI 失败时调用 | 只有宿主默认工具行与错误，无通知卡片 |
| 历史加载 | 重新打开含成功通知的会话 | 成功结果仍出卡片；缺调用时只缺正文，不丢回执 |
| 上报正文色 | 触发含正文、desc、附件的 `send_report` | 正文、任务简介与附件名和普通助手正文同色；通知正文同样一致 |
| 折叠可见性 | 折叠过程分组与轮次 | 两类卡片保持默认可见 |
| 统一渠道 | 「在电脑旁」状态从 GUI 给调度会话发消息 | 完整回复经 `lark_notify`，正文最多一句概述，提示词请求不含在场提醒 |
| 在场回归 | 切换页脚状态并让被管理会话提问 | 在场按钮、状态切换与提问拦截保持原行为 |

实机截图与结果记录到本规格目录，跟踪文件只使用仓库内相对路径。
