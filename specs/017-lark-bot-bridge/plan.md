# Implementation Plan: 飞书机器人消息桥

**Branch**: `feat/017-lark-bot-bridge` | **Date**: 2026-11-18 | **Spec**: [spec.md](./spec.md)

**Input**: 基于 DSH 插件模板构造 `dsh-plugin-lark-bridge`，只使用 lark-cli 的 bot 身份完成飞书消息接收、system-reminder 注入与会话通知。

## Summary

把模板转化为实际插件：

- 宿主侧通过 `@larksuite/cli` 的 CLI 子进程管理独立 lark-cli 配置档案、应用凭据与 OAuth 设备码授权。
- 用 `lark-cli event consume im.message.receive_v1 --as bot` 接收用户私聊消息。
- 把消息包成 `<system-reminder>`，以 `agent.followup` 注入配置工作区对应的 DSH 会话；无记录时创建、设置标题并置顶。
- 注册 `lark_notify` 工具，固定以 bot 身份向已绑定用户 open_id 发送消息。
- 浏览器侧注册鉴权弹窗与配置页鉴权面板；两者通过宿主注册的只读 JSON 路由读取鉴权状态并执行授权动作。

## Technical Context

**Language**: TypeScript 6

**Runtime**: Node.js 24.9+ / DSH 0.2.2-rc.3

**Build**: tsdown（宿主 ESM + 浏览器闭包工厂）、tsc 生成类型

**Test**: vitest（`code` 与 `dist` 两个 project）；真实链路用 mock lark-cli 脚本

**Dependencies**:

| 依赖 | 归属 | 用途 |
| --- | --- | --- |
| `@larksuite/cli` | `dependencies` | 随插件安装 lark-cli，不依赖全局安装 |
| `@deepseek-ai/schemastery` | `dependencies` | 配置 schema |
| `@deepseek-ai/dsh-agent`、`dsh-session`、`dsh-llm`、`dsh-workspace`、`dsh-client-*` | `devDependencies` | 宿主共享实例，保持 external |

`@larksuite/cli` 不进入 bundle：运行时用 `createRequire(import.meta.url).resolve('@larksuite/cli/package.json')` 定位包目录，优先直接执行 `bin/lark-cli(.exe)`；缺失时执行 `node scripts/run.js` 触发按需下载。两者都不经 shell，避免参数注入。

**Storage**: `$DSH_HOME/lark-bridge/state.json`（默认 `~/.dsh/lark-bridge/state.json`），保存桥接会话标识与去重消息窗口。

**HTTP API**: 宿主通过 `ctx.webServer.register` 注册 `/lark-bridge/*` 路由，响应同源浏览器请求。若 `ctx.connection` 存在，逐请求调用 `requestRejection` 做 Host/Origin 与浏览器会话校验；否则拒绝非回环来源并校验 `Origin` 与 `webServer.getOrigin()` 一致。

## Constitution Check

| 原则 | 结论 | 说明 |
| --- | --- | --- |
| I. 宿主依赖版本 | PASS | 全部 `@deepseek-ai/*` 保持 `0.2.2-rc.3`，与当前宿主一致；新增依赖不改动宿主版本。 |
| II. 测试同步 | PASS | 新增 auth、session、events、routes、tools 与前端组件测试；package-pack 回归发布内容。 |
| III. 文档结构 | PASS | README 写用户功能与配置；`docs/how-it-works.md` 写机制；`docs/known-risks.md` 补风险；代码注释写职责。 |
| IV. 质量门禁 | PASS | 每个阶段结束运行 `pnpm format && pnpm check`。 |
| V. 公开引用 | PASS | 不写入本机绝对路径；配置示例用占位符与回环地址。 |

**模板转化要求**（[template-conversion.md](../../docs/change-categories.md#模板转化)）：

- 修订宪章与 `AGENTS.md`：删除模板说明，更新项目名、包名、README 与 `cordis.patch.yml`。
- 依赖保持与宿主同版本，不升级。
- 清空 `package.json` 的 `version` 并由本插件填入 `0.1.0`。
- 恢复 CI 的 tag 发布条件，删除 `if: false`。
- 清空过往 spec 与 changelog；提醒用户绑定 npm Trusted Publisher。

## Architecture

### 宿主模块

| 文件 | 职责 |
| --- | --- |
| `src/index.ts` | 入口：解析配置、创建 `Bridge`、注册工具与路由、随插件卸载清理 |
| `src/config.ts` | `Config` schema、默认值、严格校验与热重载读取 |
| `src/cli.ts` | 解析并启动 `@larksuite/cli`；统一处理 JSON envelope、超时与 stderr |
| `src/auth.ts` | 鉴权状态机：`cli-missing` → `app-missing` → `bot-unavailable` → `user-missing` → `ready`；应用凭据绑定、设备码授权、状态检测 |
| `src/bridge.ts` | 事件消费子进程、消息过滤与去重、system-reminder 构造与注入 |
| `src/sessions.ts` | 工作区校验、会话创建/恢复、标题、置顶与记录持久化 |
| `src/state.ts` | `state.json` 原子读写与串行写队列 |
| `src/tools.ts` | `lark_notify` 工具定义与分段发送 |
| `src/routes.ts` | `/lark-bridge/*` JSON 路由与鉴权状态投影 |
| `src/constants.ts`、`src/utils.ts`、`src/types.ts` | 共享常量、纯函数与宿主类型再导出 |

### 浏览器模块

| 文件 | 职责 |
| --- | --- |
| `src/client/index.ts` | 注册字典、鉴权弹窗与配置页 |
| `src/client/auth-overlay.tsx` | `shell.overlay` 弹窗：未就绪时显示阶段与入口，可关闭本次提示 |
| `src/client/auth-panel.tsx` | 配置页鉴权面板：状态、App ID/Secret、绑定、授权链接、重新检测 |
| `src/client/config-page.tsx` | `plugins.row.config` 页面：官方表单字段 + 鉴权面板 |
| `src/client/api.ts` | 同源 fetch 封装、状态类型与轮询 |
| `src/client/config-form.ts` | 工作区、标题、档案名等字段的草稿模型 |
| `src/client/locales.ts` | 中英文字典 |

### 配置

| 键 | 默认值 | 说明 |
| --- | --- | --- |
| `workspaceRoot` | `''` | 桥接会话所属工作区；空值表示未配置 |
| `sessionTitle` | `飞书` | 桥接会话标题；复用会话时同步 |
| `profile` | `dsh-lark-bridge` | 插件专用 lark-cli 配置档案 |
| `larkCli` | `''` | 覆盖可执行文件路径；空值自动解析 |
| `ownerOpenId` | `''` | 覆盖授权得到的用户 open_id |
| `authCheckOnStartup` | `true` | 每次加载是否执行鉴权检查 |

全部字段 `.volatile()`，保存后不重启插件。

### 鉴权流程

1. **cli-missing**：解析不到可执行文件。配置页提示安装，并提供 `@larksuite/cli` 的安装说明。
2. **app-missing**：`profile list` 不含专用档案。配置页填写 App ID/Secret，提交到宿主路由；宿主用 `profile add --name <profile> --app-id ... --app-secret-stdin` 写入，Secret 只经 stdin。
3. **bot-unavailable**：`auth status --json` 的 `identities.bot.status` 非 `ready`。提示检查应用凭据与开放平台权限。
4. **user-missing**：无 `ownerOpenId` 且 `identities.user` 未就绪。配置页点击开始授权：宿主执行 `auth login --no-wait --json`，读取 `verification_url` 与 `device_code`，返回链接；后台执行 `auth login --device-code <code> --json`，完成后重新检测。
5. **ready**：bot 与用户均可用；启动事件消费。

每次加载执行一次检查；配置保存、授权动作、手动重新检测都会重跑。鉴权失败不抛加载错误，保持配置页可用。

### 消息处理

1. 子进程输出 NDJSON，逐行解析 `im.message.receive_v1`。
2. 过滤：`chat_type !== 'p2p'`、`sender_type !== 'user'`、`sender_id !== ownerOpenId`、`message_id` 已在去重窗口内，任一命中即丢弃。
3. 文本为空时使用 `[${message_type}]` 占位。
4. `state.sessionId` 存在且可恢复时复用；恢复失败、已归档或工作区不匹配时新建。
5. 新建会话：`ctx.agents.create`，`meta.cwd = workspaceRoot`，setup 追加 `session/title`；随后 `workspaceRegistry.resolveByPath(cwd) ?? create(cwd)` 并 `attachSession`、`pinSession`；写入 `state.sessionId`。
6. 注入：`createUserMessage({ content: [{ type: 'text', text: reminder }], source: { kind: 'lark-bridge' } })` → `agent.followup(message)`。
7. 子进程退出后按 2s 起、上限 60s 的退避重启；插件卸载时 `taskkill /T /F`（Windows）或 `SIGTERM` 终止。

### 通知

`lark_notify({ text })`：

1. 校验 `text` 非空。
2. 目标为 `ownerOpenId`（配置覆盖优先，否则授权结果）。缺失时返回失败结果。
3. 按 15000 UTF-16 单元分段，优先换行处，避免拆分代理对。
4. 逐段执行 `im +messages-send --as bot --user-id <openId> --text <part>`；带 `--idempotency-key`。
5. 任一段失败返回 `{ ok: false, error }`；成功返回 `{ ok: true, parts, messageId }`。

### HTTP 路由

全部为同源 JSON：

| 方法 | 路径 | 作用 |
| --- | --- | --- |
| GET | `/lark-bridge/status` | 鉴权阶段、用户、应用、工作区、会话标识 |
| POST | `/lark-bridge/check` | 重新检测 |
| POST | `/lark-bridge/app` | 绑定应用凭据 `{ appId, appSecret }` |
| POST | `/lark-bridge/auth/start` | 开始设备码授权，返回链接 |
| POST | `/lark-bridge/auth/cancel` | 取消当前授权 |
| POST | `/lark-bridge/session/reset` | 清除会话记录，下一次消息新建会话 |

响应统一 `{ ok: boolean, data?: ..., error?: { code, message } }`。请求体上限 64 KiB，非 GET 必须同源。

### 会话记录

`state.json`：

```json
{
  "sessionId": "uuid",
  "workspaceRoot": "D:/work/demo",
  "title": "飞书",
  "seen": { "om_xxx": 1730000000000 },
  "updatedAt": "2026-11-18T10:00:00.000Z"
}
```

`seen` 最多保留 500 条，按时间淘汰。

## Project Structure

```text
src/
├── index.ts
├── config.ts
├── constants.ts
├── cli.ts
├── auth.ts
├── bridge.ts
├── sessions.ts
├── state.ts
├── tools.ts
├── routes.ts
├── types.ts
├── utils.ts
└── client/
    ├── index.ts
    ├── api.ts
    ├── auth-overlay.tsx
    ├── auth-panel.tsx
    ├── config-form.ts
    ├── config-page.tsx
    └── locales.ts
tests/
├── cli.test.ts
├── auth.test.ts
├── bridge.test.ts
├── sessions.test.ts
├── state.test.ts
├── tools.test.ts
├── routes.test.ts
├── client.test.ts
└── package-pack.test.ts
```

## Test Strategy

- **cli**：解析包内可执行文件与 `.cmd` 回退；JSON envelope 解包；超时与 stderr。
- **auth**：四个阶段的检测顺序；`profile add` 的 stdin 传递；设备码输出解析；Secret 不进入配置或日志。
- **bridge**：NDJSON 分帧、过滤、去重、占位文本、reminder 转义；子进程重启退避。
- **sessions**：工作区校验；创建后标题与置顶；复用；归档后新建；记录写入。
- **tools**：空文本拒绝；未知用户拒绝；长文本分段；失败返回。
- **routes**：同源校验、请求体上限、状态投影。
- **client**：字典键集、弹窗显隐、配置页字段与鉴权动作、轮询清理。
- **dist**：`dist/client.js` 注册契约；`npm pack` 包含 `dist`、`cordis.patch.yml`、`locale/*.json`、README，不含 `src`、`tests`。

真实链路用 `tests/support/fake-lark-cli.mjs` 模拟 CLI；真机测试在 Desktop profile 安装后按 quickstart 执行。

## Complexity Tracking

| 项 | 偏离 | 理由 |
| --- | --- | --- |
| 浏览器与宿主通信 | 使用 `ctx.webServer` JSON 路由而非 Typert Remote | 模板构建不运行 Typert 生成；Remote 需要宿主构建管线。路由限制为同源只读状态与显式授权动作。 |
| lark-cli 运行时 | 以子进程调用 CLI，而非进程内 OAuth 库 | `@larksuite/cli` 不导出 Node API；CLI 自带设备码授权、凭据存储与事件消费，是唯一完整实现。 |
| 状态存储 | 插件自有 JSON 文件 | 会话标识与去重窗口是插件私有状态；模板未挂载 storage 域，文件足够且可测试。 |