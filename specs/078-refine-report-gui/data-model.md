# Data Model: 优化上报与通知卡片 GUI 悬停与点击热区

数据字段与节点解析不变，本文件记录组件状态与 DOM 契约。

## 实体（不变）

- `ReportCardData`：`kind`、`desc`、`text`、`files`、`reportId`，来自 `report-node.ts`。
- `NotifyCardData`：`text`、可选 `summary`、可选 `taskId`、可选 `sessionId`，来自 `notify-node.ts`。

## 组件状态

| 组件 | 状态 | 初值 | 转换 |
| --- | --- | --- | --- |
| `ReportCard` | `expanded` | `true` | 点击热区取反 |
| `NotifyCard` | `expanded` | `summary === undefined`（文本模式展开，卡片模式折叠） | 点击热区取反 |

会话状态判定（`active` / `archived` / `missing` / `unassociated`）沿用 `useWorkspaces` 现有逻辑。

## DOM 契约

### 上报卡片

```text
section.dsh-lark-report[data-dsh-lark-report-card][data-expanded]
├── button.dsh-lark-report-head[data-dsh-lark-report-toggle][aria-expanded][aria-label]
│   ├── span.dsh-lark-report-head-row        # 图标、标题、Tag、折叠态摘要、回执、箭头
│   └── span.dsh-lark-report-desc            # 仅展开且 desc 非空；label + desc-text
├── div.dsh-lark-report-body                 # 仅展开且 text 非空；border-top
└── div.dsh-lark-report-files                # 仅展开且 files 非空；border-top
    └── ul > li > button.dsh-lark-report-file
```

- 热区覆盖分隔线上方完整区域，含卡片上、左、右内边距。
- `desc` 包裹元素由 `div` 改为 `span`（按钮内容模型要求 phrasing content），类名与内部结构不变。
- 折叠态标题行内联摘要 `.dsh-lark-report-head-desc` 不变。

### 通知卡片

```text
section.dsh-lark-notify[data-dsh-lark-notify-card][data-expanded]
├── button.dsh-lark-notify-head[data-dsh-lark-notify-toggle][aria-expanded][aria-label]
│   ├── span.dsh-lark-notify-icon            # IconPaperPlaneOutlineRegular
│   ├── span.dsh-lark-notify-title           # 文本模式：notify.title
│   │   或 span.dsh-lark-notify-summary[data-dsh-lark-notify-summary]  # 卡片模式
│   └── IconChevronDownOutlineRegular.dsh-lark-notify-toggle-icon
├── div.dsh-lark-notify-body                 # 仅展开；border-top；纯文本 pre-wrap
└── footer.dsh-lark-notify-meta              # taskId 或 sessionId 存在时常显；border-top
    ├── footer.dsh-lark-notify-session[data-dsh-lark-notify-task]
    └── footer.dsh-lark-notify-session[data-dsh-lark-notify-session]
        ├── button.dsh-lark-notify-session-link[data-dsh-lark-notify-session-link]  # active
        │   或 span.dsh-lark-notify-session-id                                      # 其余
        └── span.dsh-lark-notify-archived[data-dsh-lark-notify-archived]            # archived
```

- `<details>` 与 `notify.expand`「完整内容」用法移除。
- 会话链接在热区之外，点击不改变 `expanded`。

## 样式契约

| 选择器 | 规则 |
| --- | --- |
| `.dsh-lark-report` / `.dsh-lark-notify` | 无容器 padding；`transition: background-color 0.1s` |
| `@media (hover:hover)` 下两容器 `:hover` | `background: var(--dsw-alias-turn-trigger-bg-hover, var(--dsw-alias-interactive-bg-hover))` |
| `.dsh-lark-report-head` / `.dsh-lark-notify-head` | `width: 100%`、`padding: 10px 14px`、按钮复位、`cursor: pointer` |
| `.dsh-lark-report-body` / `.dsh-lark-report-files` / `.dsh-lark-notify-body` / `.dsh-lark-notify-meta` | `padding: 8px 14px 12px`、`border-top: 0.5px solid var(--dsw-alias-border-l2)` |
| 两热区 `:focus-visible` | 宿主焦点环令牌，`outline-offset: -2px`（收入卡片内） |
| 箭头 `[aria-expanded="true"]` | `rotate(180deg)`，150ms |
| `@media (prefers-reduced-motion:reduce)` | 容器与箭头 `transition: none` |

## 字典变化

| 键 | zh | en | 说明 |
| --- | --- | --- | --- |
| `notify.title` | 通知 | Notification | 新增，文本模式热区标题 |
| `notify.collapse` | 收起 | Collapse | 新增，热区无障碍名称 |
| `notify.expand` | 展开 | Expand | 改值，原「完整内容 / Full content」随 `<details>` 移除 |
