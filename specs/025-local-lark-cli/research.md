# 技术研究

## 1. 程序来源

**Decision**: 删除 `@larksuite/cli` 运行时依赖、workspace 构建许可、锁文件条目和包目录回退。插件只启动用户本机命令。

**Rationale**: 当前依赖声明为 `1.0.100`，包入口 `scripts/run.js` 在二进缺失时下载程序。仅删除 `dependencies` 而保留解析逻辑仍会留下插件管理副本的入口。

**Alternatives Considered**: 保留依赖作为后备、通过 `npx` 按需执行。两者都会让插件重新承担程序获取职责，不符合规格。

## 2. 命令发现

**Decision**: 不提供 `larkCli`、`LARK_CLI` 或自定义 `PATH` 搜索。一次性调用与事件消费者共用普通命令调用。

**Rationale**: 现有 `CliCommand` 已把可执行文件与参数数组集中管理，可以缩减解析层而不改变鉴权、事件桥和通知工具。

**Alternatives Considered**: 保留显式路径作为高级配置。用户已明确移除全部专用配置。

### Windows npm shim 限制

在 Windows x64、Node.js 24.9.0 上实测：

| 调用 | 结果 |
| --- | --- |
| `spawn('lark-cli', args, { shell: false })` | `ENOENT` |
| `spawn('lark-cli.cmd', args, { shell: false })` | 同步抛出 `EINVAL` |
| 两种名称配合 shell | 可以执行全局 npm 安装 |
| 全局包内原生 `bin/lark-cli.exe`，`shell: false` | 可以执行 |

[Node.js 24.9.0 文档](https://nodejs.org/download/release/v24.9.0/docs/api/child_process.html#spawning-bat-and-cmd-files-on-windows)要求 `.cmd` 通过 shell 或 `cmd.exe` 启动，并禁止把未净化输入传给 shell。[Node 源码](https://github.com/nodejs/node/blob/v24.9.0/lib/child_process.js)在 `shell: true` 且提供参数数组时只拼接空格，不执行安全转义。

`@larksuite/cli` 的 `bin` 是 `scripts/run.js`，npm 全局 prefix 提供 `lark-cli.cmd`，原生二进制位于全局包目录。当前 `lark-cli im +messages-send` 支持 `--text -` 从 stdin 读取正文。

**Decision (P-D001)**: macOS/Linux 使用 `shell: false`。Windows 使用受约束 shell：只拼接通过安全字符白名单的参数，通知正文通过 `--text -` 从 stdin 读取。动态参数拒绝空格、换行和 shell 元字符。

**Rationale**: 该方案保持普通 `lark-cli` 命令来源，避免恢复全局包路径解析，同时阻止通知正文进入 shell。同步 `spawn` 异常统一转换为 `CliError('spawn-failed')`，避免鉴权把启动失败误判为程序可用。

**Alternatives Considered**: 直接执行全局包内原生二进制可完全关闭 shell，但需要恢复用户已排除的路径解析，未采用。

**Risk**: 未设置最低版本，旧版 CLI 若不支持 `--text -`，通知会返回实际命令错误。当前全局 1.0.98 与仓库移除前的 1.0.100 均支持该参数。

## 3. 旧配置升级

**Decision**: 将 `larkCli` 加入现有旧键集合，接受并丢弃；从运行时配置和前端表单删除该字段。

**Rationale**: 项目已对 `profile`、`ownerOpenId` 采用相同兼容策略。直接把它视为未知键会让已有 profile 升级后加载失败。

**Alternatives Considered**: 继续读取旧路径、自动清除用户配置。前者违背直接命令调用，后者会扩大插件对宿主配置的写入范围。

## 4. 安装命令展示

**Decision**: 在中英文字典提供同一条命令，通过共享只读组件在 `cli-missing` 弹窗和配置页鉴权面板显示：

```sh
npm install -g @larksuite/cli@latest && lark-cli config init
```

**Rationale**: `@larksuite/cli` 是实际 npm 包名，`lark-cli` 是其 `bin` 名称。共享组件保证两个入口内容一致。

**Alternatives Considered**: 自动执行安装、增加复制按钮、增加最低版本检查。用户只要求展示命令；版本限制已明确排除，复制按钮不属于必要范围。

## 5. 发布回归

**Decision**: 在 package-pack 测试同时检查包清单依赖声明与 `npm pack --dry-run --json` 的实际文件集合。

**Rationale**: npm tarball 默认不包含依赖目录，只检查文件列表无法防止运行时依赖重新声明。两项检查共同覆盖安装来源与发布产物。

**Alternatives Considered**: 只检查构建后的 `dist/index.mjs`。这无法覆盖 profile 安装时读取的依赖清单。

## 6. 验证策略

**Decision**: 使用现有 Vitest 模拟 `ctx`、CLI runner 与 React SSR；构建后运行产物和打包测试；最后在真实 DSH 宿主验证配置页、弹窗、私聊注入与通知，并执行一次 UI/UX 子代理审查。

**Rationale**: 单元测试覆盖解析移除和升级兼容，产物测试覆盖发布内容，真实宿主覆盖 Electron 环境与实际界面。

**Alternatives Considered**: 仅运行单元测试。无法发现本机命令解析和宿主界面问题。
