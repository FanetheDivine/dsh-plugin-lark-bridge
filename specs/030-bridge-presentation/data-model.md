# 数据模型：桥接会话呈现

## 桥接会话标题

| 场景 | 标题来源 | 写入 |
| --- | --- | --- |
| 新建会话 | `SESSION_TITLE` = 「飞书桥接会话」 | `session/title` 事件 + `state.title` |
| 复用会话 | 会话已有标题 | 不写，保留原值 |
| 归档后新建 | `SESSION_TITLE` | 同新建 |

`state.title` 不再驱动复用路径的标题改写，只记录标题供诊断。旧状态文件里的 `title` 保持原值，不需要迁移。

## 插件图标

| 字段 | 值 |
| --- | --- |
| 路径 | `icon.svg`（包根） |
| 格式 | SVG |
| 画布 | `viewBox="0 0 36 36"`，主体居中，透明背景 |
| 上限 | 256 KiB（宿主限制） |
| 图形 | 飞书标志三段路径：青绿 `#00D6B9`、蓝 `#3370FF`、深蓝 `#133C9A` |
| 声明 | `package.json` 顶层 `icon`、`exports["./icon"]`、`files` |

宿主渲染规则：图标无法解码或缺失时回落默认图；插件行与详情页分别解析包级与插件级图标，本包两者为同一文件。

## README 结构

| 部分 | 保留 | 内容 |
| --- | --- | --- |
| 标题 | 是 | `# dsh-plugin-lark-bridge` |
| npm 徽章 | 是 | 链接到 npm 包页 |
| 简介 | 是 | `借助lark-cli，让DSH以bot身份和你交互` |
| `## 前置` | 是 | 原样保留的 CLI 安装、bot 配置、用户登录与开放平台权限说明 |
| 功能、安装、配置、工具、数据、限制、开发 | 否 | 删除 |

## 文档同步点

| 文件 | 变更 |
| --- | --- |
| `docs/how-it-works.md` | 会话小节：新建用固定标题，复用保留标题 |
| `AGENTS.md` | 文档索引：README 描述为「插件简介与前置」 |
| `locale/zh.json`、`locale/en.json` | `meta.description` 改为当前注入方式 |
| `docs/i18n.md` | 包清单示例加入图标导出 |
| `CHANGELOG.md` | `## Unreleased` 记录标题、图标与 README 变化 |