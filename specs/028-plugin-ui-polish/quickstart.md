# 验证指南: 设置界面 UI 优化

**Feature**: `028-plugin-ui-polish`

## 前提

- Node 24、pnpm 11。
- 已 `pnpm i`。
- 实机验证需要 `dsh` 0.2.2-rc.3 与 Playwright 自带的本机 Chrome。

## 静态检查与测试

```sh
pnpm check     # 类型、lint、code 测试
pnpm build     # 构建 dist 并跑 dist 测试
```

预期：全部通过；`tests/client.test.ts` 覆盖关闭态触发控件、空列表禁用、无「恢复默认」、命令复制按钮存在。

## 实机验证

```sh
bash .dsh/skills/real-device-test/scripts/setup-env.sh <worktree 绝对路径> rdt-<日期>
export PATH="<本地宿主目录>/node_modules/.bin:$PATH"   # setup-env.sh 结束时打印的路径
eval $(bash .dsh/skills/real-device-test/scripts/gui-up.sh rdt-<日期>)
```

profile 的 `cordis.patch.yml` 必须把插件配置写成 `workspaceRoot: ""`，模板里的 `prefix` 会让插件加载失败。

改代码后执行 `pnpm build`：宿主监听 `dist`，同一 GUI 实例自动替换插件，无需重启。

### 核对场景

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 检测按钮位置 | 打开设置弹窗 | 三行中按钮紧跟「已连接」右侧，间距不超过 8px |
| 复制命令 | 点击任一行复制按钮 | 图标变对勾，剪贴板内容等于该行命令，约 1 秒后复位 |
| 恢复默认移除 | 查看配置页与设置弹窗 | 两处都有「工作区」标题，都没有「恢复默认」 |
| 浮层外观 | 展开工作区选择 | 出现宿主风格下拉卡片，行内为「标题 — 路径」，选中行带对勾 |
| 浮层关闭 | 展开后按 Esc、点击外部、选中一项 | 三种方式都关闭；前两种不改已选值 |
| 空列表 | 删除全部注册工作区后打开界面 | 控件显示「暂无已注册工作区」且不可展开 |
| 英文 | 切换界面语言 | 上述文案均为英文，无截断 |

截图保存到 profile 的 `shots/`，逐张读图核对后再判定通过。

## 清理

```sh
netstat -ano | grep ":3210 " | grep LISTENING   # 取 PID
taskkill //F //T //PID <pid>
rm -rf "$DSH_HOME/profiles/rdt-<日期>"
```
