# 快速验证：插件图标铺满与元数据文案

## 前置

- 仓库检出位于本分支的 worktree，依赖已安装（`pnpm i`）。
- 静态资产不需要构建；只有跑 `test:dist` 时要求 `dist` 新鲜。

## 既有测试

```sh
pnpm test:code -- tests/icon.test.ts tests/metadata.test.ts
```

预期：两文件保持通过，不新增断言。

- 图标：画布 36×36、存在 `<title>`、三段品牌色、无禁用元素、≤256 KiB、三处清单声明。
- 元数据：两份 locale 键集一致、值非空、标题单行、清单声明。

## 一次性几何核对

不进入仓库，用于确认铺满结果：

```sh
node -e "<读取 icon.svg，解析 path 与 transform，输出墨水盒>"
```

预期：墨水盒 36×28.61，左右间距 0，上下留白各约 3.69。

## 质量门禁

```sh
pnpm format && pnpm check
```

预期：类型检查、lint 与全部源码测试通过。

## 打包内容

```sh
npm pack --dry-run --json
```

预期：

- 文件列表含 `icon.svg`、`locale/zh.json`、`locale/en.json`。
- 包描述为「配置lark-cli，用在手机上也可以和DSH对话」。

## 实机验证

1. 搭建隔离 profile：

   ```sh
   bash .dsh/skills/real-device-test/scripts/setup-env.sh "<repo>"
   ```

2. 启动 GUI 并按脚本输出导出环境变量：

   ```sh
   eval $(bash .dsh/skills/real-device-test/scripts/gui-up.sh <profile名>)
   ```

3. 在浏览器驱动中加入或手工执行以下检查：

   | 检查 | 预期 |
   | --- | --- |
   | 插件页卡片图标 | 图形横向占满宿主内框，截图测量图形宽度与内框宽度差 ≤1px |
   | 插件页行图标 | 30px 行尺寸下三段色块可辨 |
   | 中文界面标题与描述 | 用飞书连接DSH / 配置lark-cli，用在手机上也可以和DSH对话 |
   | 英文界面标题与描述 | Connect DSH from Lark / Configure lark-cli so you can talk to DSH from your phone too. |
   | 停用插件后行标题与描述 | 与启用时一致 |

4. 结束时结束 GUI 进程并删除 profile。

## 回归范围

- `tests/package-pack.test.ts`：发布包仍含图标与 locale 文件。
- `tests/metadata.test.ts`：结构不变，未新增断言。
- 图标以外的资产与源码改动为零，`pnpm build` 产物不变。
