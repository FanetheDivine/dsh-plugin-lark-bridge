# Data Model: 上报卡片折叠开关

## Entities

### 1. ReportCardData（既有，不变）

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `kind` | `string` | 上报类型（`progress`、`question`、其他字符串或 `''`） |
| `desc` | `string` | 任务简介 |
| `text` | `string` | Markdown 正文 |
| `files` | `readonly string[]` | 附件路径列表 |
| `reportId` | `string` | 上报编号 |

### 2. ReportCard 视图状态（新增本地状态）

| 状态 | 类型 | 初始值 | 说明 |
| --- | --- | --- | --- |
| `expanded` | `boolean` | `true` | 控制卡片主体区域是否展开 |

### 3. 新增国际化字典键（`src/client/locales.ts`）

| 键 | 中文 (`zh`) | 英文 (`en` / `FALLBACK`) | 用途 |
| --- | --- | --- | --- |
| `report.collapse` | `收起` | `Collapse` | 展开状态下折叠按钮的文案、`aria-label` 与 `title` |
| `report.expand` | `展开` | `Expand` | 折叠状态下展开按钮的文案、`aria-label` 与 `title` |
