# Tasks: 设置界面 UI 优化

**Feature**: `028-plugin-ui-polish` | **Plan**: [plan.md](./plan.md) | **Spec**: [spec.md](./spec.md)

## Phase 1: 删除「恢复默认」入口

- [ ] T001 删除 `WorkspaceSelect` 的 `onReset`、`overridden` 属性与恢复默认按钮（`src/client/config-page.tsx`）
- [ ] T002 停止传 `overridden`（`src/client/auth-overlay.tsx`），`ConfigPage` 不再传 `onReset`
- [ ] T003 删除 `config.reset`、`config.overridden` 字典键（`src/client/locales.ts`）
- [ ] T004 更新断言：配置页与弹窗都不含「恢复默认」，都保留「工作区」标题（`tests/client.test.ts`）

## Phase 2: 检测按钮紧邻状态

- [ ] T005 移除状态文字的 `flex: 1`，让检测按钮紧跟状态文字（`src/client/auth-panel.tsx`）
- [ ] T006 更新断言：按钮紧跟状态文字，文案保留全称（`tests/client.test.ts`）

## Phase 3: 命令复制按钮

- [ ] T007 命令改为容器加复制按钮，成功态换对勾（`src/client/terminal-command.tsx`）
- [ ] T008 新增复制文案键 `auth.command.copy`、`auth.command.copied`（`src/client/locales.ts`）
- [ ] T009 `TerminalCommand` 传入 `t`（`src/client/auth-panel.tsx`）
- [ ] T010 更新断言：每条命令右侧有复制按钮，`aria-label` 为复制命令（`tests/client.test.ts`）

## Phase 4: 工作区选择换成宿主下拉

- [ ] T011 用宿主 `Menu`、`Button`、`IconChevronDownOutlineRegular` 重写 `WorkspaceSelect`（`src/client/config-page.tsx`）
- [ ] T012 补 `tests/support/primitives.ts` 的转出：`Menu`、`MenuItemButton`、`Button`、`useClipboardCopy`、`IconChevronDownOutlineRegular`、`IconCheckOutlineRegular`、`writeClipboard`
- [ ] T013 更新断言：关闭态显示占位或选中项，空列表禁用，无 `<select>`
- [ ] T014 实机截图核对：浮层外观、键盘、Esc、点外部、选中态、配置页与弹窗一致

## Phase 5: 文档与变更记录

- [ ] T015 `CHANGELOG.md` 的 Unreleased 记录四项改动
- [ ] T016 `docs/development.md` 文件地图与测试表同步
- [ ] T017 运行 `pnpm format && pnpm check && pnpm build`
- [ ] T018 提交、推送、开 PR 并等待 CI 与合并

## 依赖

- T001–T003 同属一个提交，T004 跟随。
- T005–T006 可独立于其它阶段。
- T007–T010 依赖 T008 的字典键。
- T011–T013 独立，T014 依赖 `pnpm build`。
- T015–T016 在建 PR 前完成。
