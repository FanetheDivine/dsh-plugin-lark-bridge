# Quickstart: 飞书通知关联会话与跳转

## 前置条件

- Node.js 24.9 或更高版本。
- pnpm 11。
- 在功能 worktree 根目录执行命令。

## 自动化验证

```sh
pnpm install --frozen-lockfile
pnpm vitest run --project code tests/tools.test.ts tests/notify-node.test.ts tests/notify-card.test.ts tests/client.test.ts tests/card-styles.test.ts
pnpm format
pnpm check
pnpm full-check
```

预期：类型检查、Biome、源码测试、构建和产物测试全部通过。

## 场景验收

### 新通知关联

1. 在桥接会话成功调用 `lark_notify`。
2. 检查成功结果包含当前 `sessionId`。
3. 检查 `presentationMeta` 返回相同标识。
4. 检查结果文本仍为现有成功回执。

### 未归档会话

1. 渲染具有有效 `sessionId` 的通知卡片。
2. 检查卡片显示“会话”和完整标识。
3. 点击会话按钮。
4. 检查 `openSession` 收到相同标识。

### 已归档会话

1. 把目标标识加入 `archivedSessionIds`。
2. 渲染通知卡片。
3. 检查卡片显示“已归档”和只读标识。
4. 检查卡片没有会话按钮。

### 历史与未知会话

1. 渲染没有 `sessionId` 的历史卡片，确认只显示正文。
2. 渲染目录中不存在的标识，确认只读展示。
3. 渲染空值、数组和非字符串元数据，确认不显示无效会话区域。

## 实机核对

在真实 DSH Web GUI 加载构建产物后：

1. 成功发送通知并点击卡片中的会话标识，确认进入来源会话。
2. 归档来源会话后重新查看通知，确认显示归档标签且入口不可点击。
3. 刷新页面并加载历史通知，确认关联和正文保持一致。
4. 切换中英文，确认会话与归档文案随界面语言更新。
