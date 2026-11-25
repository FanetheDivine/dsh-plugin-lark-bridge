# Tasks: 自动切换时间的配置行与时间选择浮窗

**Feature**: `feat/047-presence-time-picker` | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

每个阶段对应一个 commit。

## Phase 1 Tailwind、shadcn 组件与编辑弹窗

- [x] T001 `package.json`：加 `@radix-ui/react-popover`、`@radix-ui/react-slot`、`class-variance-authority`、`tailwind-merge`，加 devDependencies `tailwindcss`、`@tailwindcss/cli`、`tw-animate-css`；移除 `react-time-picker` 与 `react-clock`
- [x] T002 `scripts/build-client-css.mjs`：调用 Tailwind CLI 生成 `src/client/tailwind.generated.css`
- [x] T003 `src/client/tailwind.css`：utilities only、`source(none)`、令牌映射、局部 base
- [x] T004 `build`、`dev`、`check`、`test:code` 前置 `css:build`；`.gitignore` 排除生成文件；`biome.json` 打开 Tailwind 指令解析
- [x] T005 `tests/client-bundle.test.ts` 增加产物守卫：内联样式不含 preflight，含 `--dsw-` 引用
- [x] T006 `src/client/ui/cn.ts`、`button.tsx`、`input.tsx`、`input-group.tsx`、`popover.tsx`
- [x] T007 `src/client/ui/time-picker.tsx`：ReUI 移植，图标换宿主图标，适配仓库严格 TS 选项
- [x] T008 `src/client/presence-alarms-editor.tsx`：`InputGroup` + 时钟按钮 + Popover 列式面板
- [x] T009 `src/client/locales.ts`：补列标题与浮窗文案，删除 `presenceConfig.editor.clock`

## Phase 2 配置行卡片化

- [x] T010 `src/client/presence-config.tsx`：卡片行结构、停用态、跳过 chip
- [x] T011 `src/client/presence-alarms.css`：卡片行样式，删除表盘样式

## Phase 3 测试、文档与实机验证

- [x] T012 `tests/presence-alarms-client.test.ts`：卡片行、停用态、弹窗回填、浮窗列选择、重复校验
- [x] T013 `README.md`、`docs/how-it-works.md`、`CHANGELOG.md`
- [x] T014 `pnpm format && pnpm check && pnpm build`
- [x] T015 实机验证：隔离 profile + Playwright 截图，写入 `real-device-report.md`
