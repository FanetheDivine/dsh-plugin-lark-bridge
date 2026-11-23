# 数据模型：插件图标铺满与元数据文案

本次变更只涉及包内静态资产，没有运行时状态或持久化结构。

## 图标资产

| 字段 | 值 |
| --- | --- |
| 路径 | `icon.svg`（包根） |
| 画布 | `width="36" height="36" viewBox="0 0 36 36"` |
| 图形容器 | `<g transform="translate(-4.77117 -3.94208) scale(2.7426524)">` |
| 路径 | 三条 `path`，品牌色 `#00D6B9`、`#3370FF`、`#133C9A` |
| 背景 | 透明，不绘制底板 |
| 墨水盒（变换后） | x 0–36、y 3.69294–32.30706，即 36×28.6141 |
| 长宽比 | 1.25812（源图形 13.12598×10.43301） |
| 体积 | ≤256 KiB |

校验规则：

- 画布为 36×36，`<title>` 存在（既有测试覆盖）。
- 不含 `<script>`、`<image>`、`<foreignObject>`、`<style>`、`on*=` 属性（既有测试覆盖）。
- 墨水盒宽度等于画布宽度，容差 ±0.1；高度 28.61，容差 ±0.2；不越出画布（一次性脚本与实机截图核对）。
- 上下留白相等，差的绝对值 ≤0.1（同上）。

## 元数据资源

| 文件 | 字段 | 值 |
| --- | --- | --- |
| `locale/zh.json` | `meta.title` | 用飞书连接DSH |
| `locale/zh.json` | `meta.description` | 配置lark-cli，用在手机上也可以和DSH对话 |
| `locale/en.json` | `meta.title` | Connect DSH from Lark |
| `locale/en.json` | `meta.description` | Configure lark-cli so you can talk to DSH from your phone too. |
| `package.json` | `description` | 配置lark-cli，用在手机上也可以和DSH对话 |

校验规则：

- 两文件的 `meta` 键集一致，只有 `title` 与 `description`。
- 值为非空字符串，`title` 不含换行。
- 文本不含零宽空格 U+200B 与 BOM U+FEFF。

## 清单声明

| 字段 | 值 | 约束 |
| --- | --- | --- |
| `package.json` `icon` | `./icon.svg` | 顶层字段优先于子路径导出 |
| `package.json` `exports["./icon"]` | `./icon.svg` | 子路径消费者可读 |
| `package.json` `exports["./locale/*.json"]` | `./locale/*.json` | 宿主读取元数据 |
| `package.json` `files` | 含 `icon.svg`、`locale/*.json` | 发布包内容 |

本次不修改这些声明，测试继续断言其存在。

## 状态与流转

无。图标与文案在宿主读取时生效，插件停用状态同样可读。
