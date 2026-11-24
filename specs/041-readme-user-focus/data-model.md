# 信息归属表

当前 README 每条信息的去向。满足 SC-004。

| 当前 README 信息 | 去向 |
| --- | --- |
| npm 徽章、一句话简介 | README 简介 |
| 三条 lark-cli 命令 | README 使用 |
| 插件使用本机 lark-cli 当前配置 | 已在 `docs/how-it-works.md`「鉴权」 |
| 飞书开放平台：启用机器人、订阅事件、两项权限 | 迁入 `docs/how-it-works.md`「鉴权」 |
| 插件不执行安装、初始化或登录 | 已在 `docs/how-it-works.md`「鉴权」 |
| 用户登录替换原有授权范围 | 已在 `docs/known-risks.md`「本机配置与登录」 |
| `lark_notify` 作用与可见范围 | 已在 `docs/how-it-works.md`「通知」 |
| 两个预设的用途 | README 关于两个预设 |
| 选择调度工作区、默认预设 | README 使用与关于两个预设；默认值已在 `docs/known-risks.md`「预设默认与改选」 |
| 远程调度需要 git 与 `user.name`、`user.email` | 迁入 `docs/how-it-works.md`「调度工作区存储」 |
| meta-tools 随包安装与重复注册 | 已在 `docs/how-it-works.md`「依赖」与 `docs/known-risks.md`「独立 meta-tools 重复」 |
| 停用「飞书任务与调度会话」行的影响 | 调度工具下线已在 `docs/how-it-works.md`；「飞书对话与 `lark_notify` 照常」迁入同一处 |
| 远程调度四步流程 | 已在 `docs/how-it-works.md`「调度服务与预设叠加」与「上报投递与失败监听」 |
| 只有已登记工作区可接收任务、无匹配与多匹配处理 | 迁入 `docs/how-it-works.md`「调度服务与预设叠加」 |
| 派发后回执目标工作区与执行会话 | 迁入 `docs/how-it-works.md`「调度服务与预设叠加」 |
| Web GUI 直接发言改为正文对话 | 已在 `docs/how-it-works.md`「调度服务与预设叠加」 |
| 两个预设的组成表、不含 `ask_user_question` | 已在 `docs/how-it-works.md`「调度服务与预设叠加」 |
| `send_report` 签名与 `text`、`files` 含义 | 已在 `docs/how-it-works.md`「上报投递与失败监听」；「至少提供一项」迁入同一处 |
| `<work_session_message>` 注入格式 | 已在 `docs/how-it-works.md`「上报投递与失败监听」 |
| 调度工作区文件表 | 已在 `docs/how-it-works.md`「调度工作区存储」 |
| git 初始化、提交与 `AGENTS.md` 维护 | 已在 `docs/how-it-works.md`「调度工作区存储」 |
| 任务完成后归档 | 已在 `docs/how-it-works.md`「调度工作区存储」 |
| 调度会话上下文由压缩控制 | 已在 `docs/how-it-works.md`「调度服务与预设叠加」 |

## 引用同步

| 位置 | 当前 | 目标 |
| --- | --- | --- |
| `docs/how-it-works.md`「鉴权」 | `README.md#前置` | `README.md#使用` |
| `AGENTS.md` 文档索引 | 插件简介与前置 | 插件简介、使用与预设 |
