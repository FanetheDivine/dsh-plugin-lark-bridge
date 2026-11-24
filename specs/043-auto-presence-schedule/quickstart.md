# Quickstart: 在场状态自动切换

## 构建与检查

```sh
pnpm install
pnpm format
pnpm check
pnpm build
```

## 本地加载

1. 运行 `pnpm dev`。
2. 在 profile 的 `cordis.patch.yml` 加入：

```yaml
- insert:
    - id: dsh-plugin-lark-bridge-dev
      name: file:///<repo>/dist/index.mjs
```

3. 刷新 GUI，打开「飞书任务与调度会话」行的配置页。

## 手工验证

| 步骤 | 期望 |
| --- | --- |
| 打开配置页 | 出现「自动切换在电脑旁的时间」「自动切换离开的时间」两个分区与添加按钮 |
| 添加 `09:00` 条目并保存 | 分区出现 `09:00` tag；重新打开配置页后仍在 |
| 点 tag 的设置入口 | 弹窗显示该条目的时间与跳过项，修改后保存生效 |
| 点 tag 的 x | 条目移除；保存后配置写入 `presenceAlarms` |
| 把一条闹钟设为下一分钟 | 到点后页脚按钮图标与文案按动作变化 |
| 到点后一分钟内手动切换 | 状态保持手动结果，下一个到点再切换 |
| 停用条目 | 到点不执行 |
| 关闭网络并重启插件 | 配置页提示节假日数据不可用；只按周末跳过 |
| 恢复网络后等待刷新 | 提示消失，判定恢复按法定节假日 |

## 节假日缓存

- 文件：`<DSH_HOME>/lark-bridge/holiday-cache.json`。
- 删除该文件可强制重新获取。
- 数据源：`https://cdn.jsdelivr.net/gh/NateScarlet/holiday-cn@master/<year>.json`。

## 实机验证

实机验证在用户选定的时机进行，不在实现过程中重启用户正在使用的 GUI 服务。
