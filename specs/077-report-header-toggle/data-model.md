# 数据模型：上报卡片头部

无持久化数据。以下为 DOM 契约。

## 头部按钮

| 属性 | 展开态 | 折叠态 |
| --- | --- | --- |
| 元素 | `<button type="button">` | 同左 |
| `class` | `dsh-lark-report-head` | 同左 |
| `data-dsh-lark-report-toggle` | `""` | 同左 |
| `aria-expanded` | `true` | `false` |
| `aria-label` | `收起` / `Collapse` | `展开` / `Expand` |
| `title` | 无 | 无 |
| 可见文字 | 无「收起」「展开」 | 同左 |

## 头部子元素

| 元素 | 类别 | 恒在 | 说明 |
| --- | --- | --- | --- |
| 图标 | `.dsh-lark-report-icon` | 是 | 纸飞机，`aria-hidden` |
| 标题 | `.dsh-lark-report-title` | 是 | `report.title` |
| 类型标签 | `Tag` | `kind` 非空 | `progress` / `question` / 原样 `kind` |
| 折叠态摘要 | `.dsh-lark-report-head-desc` | 折叠且 `desc` 非空 | 单行省略 |
| 回执 | `.dsh-lark-report-receipt` | 是 | `report.delivered` + 可选 `.dsh-lark-report-id` |
| 箭头 | `.dsh-lark-report-toggle-icon` | 是 | 展开旋转 180deg |

## 状态

| 状态 | `data-expanded` | 显示区块 |
| --- | --- | --- |
| 展开 | `true` | `.dsh-lark-report-desc`、`.dsh-lark-report-body`、`.dsh-lark-report-files` |
| 折叠 | `false` | 仅头部 |

## 与规格的对应

- 整行热区：头部按钮包含上表全部子元素。
- 只留箭头：头部没有文字开关节点。
- 附件不进入热区：`.dsh-lark-report-files` 位于头部按钮之外。
