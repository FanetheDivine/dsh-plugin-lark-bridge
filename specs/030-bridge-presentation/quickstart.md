# 快速验证：桥接会话呈现

## 准备

在 worktree 根目录安装依赖并构建：

```sh
pnpm install
pnpm build
```

`pnpm build` 同时运行 `test:dist`。后续命令都在 worktree 根目录执行。

## 自动化检查

```sh
pnpm check
```

覆盖类型、lint、`test:code` 与构建后的 `test:dist`。

## 场景 1：新标题

1. 删除或改名测试 profile 的状态文件，使插件创建新会话。
2. 向机器人发一条飞书消息。
3. 在 DSH 侧边栏查看会话标题。

预期：标题为「飞书桥接会话」。

## 场景 2：旧会话保留标题

1. 在状态文件写入 `sessionId`、`workspaceRoot` 与旧标题「来自用户的飞书消息」。
2. 用该 profile 启动 DSH，向机器人发一条飞书消息。

预期：该会话标题仍为「来自用户的飞书消息」；新的 `session/title` 事件不出现。

## 场景 3：图标

```sh
node -e "const j=require('./package.json'); console.log(j.icon, j.exports['./icon'], j.files.includes('icon.svg'))"
npm pack --dry-run --json
```

预期：三个声明都存在，tarball 含 `icon.svg`。

在插件管理器查看该插件的行与详情页。预期显示飞书标志；图标缺失时回落默认图。

## 场景 4：README

```sh
sed -n '1,50p' README.md
```

预期：

- 只有标题、npm 徽章、一句简介与 `## 前置`。
- 简介为「借助lark-cli，让DSH以bot身份和你交互」。
- `## 前置` 与改动前的对应段落逐字一致。

## 场景 5：文档一致性

```sh
grep -rn "来自用户的飞书消息" README.md docs AGENTS.md locale src
```

预期：没有命中。`docs/how-it-works.md` 的会话小节写明新建用新标题、复用保留标题。

## 实机验证

本轮不做实机验证。图标渲染与标题展示保持未验证。
