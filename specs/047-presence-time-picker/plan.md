# Implementation Plan: 自动切换时间的配置行与时间选择浮窗

**Branch**: `feat/047-presence-time-picker` | **Date**: 2026-11-25 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/047-presence-time-picker/spec.md`

**Status**: Approved

## Open Decisions

- [x] [D-001] 组件来源 | shadcn 底座 | Status: answered
- [x] [D-002] 选择形态 | 小时列与分钟列 | Status: answered
- [x] [D-003] 配置行布局 | 卡片行 | Status: answered
- [x] [D-004] 浮窗底座 | `@radix-ui/react-popover` | Status: answered
- [x] [D-005] 浮窗实现 | 移植 ReUI `@reui/time-picker` | Status: answered
- [x] [D-006] 样式落地 | Tailwind v4 只输出 utilities | Status: answered

## Clarifications

### Session 2026-11-25

- [D-005] Q: 浮窗用哪份实现？ -> A: 移植 ReUI 的 `@reui/time-picker`（radix 变体）与其 `button`、`input-group`、`popover` 三个 shadcn 组件。
- [D-006] Q: 样式怎样落地？ -> A: 接入 Tailwind v4，只输出 utilities，`@theme inline` 映射到宿主令牌，preflight 不进产物。

## Review Record

- 2026-11-25 | Decision: Waived | Scope: plan 免审 | Open items: none | Risks: 移植 1780 行外部源码；Tailwind preflight 误入产物会重置宿主页面；产物体积上升

## Summary

配置页的两处时间 UI 重做：配置行改为卡片行，编辑弹窗的时间控件换成 shadcn 体系的列式 time picker。技术路径是接入 Tailwind v4（只输出 utilities，令牌映射到 `--dsw-*`），并移植 ReUI 的 `@reui/time-picker` 与它依赖的 `button`、`input-group`、`popover` 三个 shadcn 组件。

## Technical Context

**Language/Version**: TypeScript 6.0，React 18.3，Node 24

**Primary Dependencies**: `@radix-ui/react-popover` 1.3.1、`@radix-ui/react-slot` 1.2.x、`class-variance-authority` 0.7.x、`clsx` 2.1、`tailwind-merge` 3.7.1；构建期 `tailwindcss` 4.3.5、`@tailwindcss/cli` 4.3.5、`tw-animate-css` 1.4.0

**Storage**: 无新增；条目仍存为插件配置的 `presenceAlarms`

**Testing**: vitest（`code` 与 `dist` 两个 project）；jsdom 渲染配置页与弹窗；产物测试断言 CSS 不含 preflight

**Target Platform**: DSH 网页端浏览器产物 `dist/client.js`，由宿主模块加载器注入页面

**Constraints**: 产物不得污染宿主页面样式；`--dsw-*` 令牌是唯一颜色来源；深浅色主题都要可用

**Scale/Scope**: 单个配置页的两个分区、编辑弹窗与一个时间选择控件

## Constitution Check

| 条款 | 结论 | 说明 |
| --- | --- | --- |
| I 宿主依赖版本 | PASS | 新增依赖都不属于 `@deepseek-ai/*`；`@deepseek-ai/*` 版本不变，`minimumReleaseAgeExclude` 无需变更 |
| II 测试同步 | PASS | 更新 `tests/presence-alarms-client.test.ts`，新增产物 CSS 守卫测试 |
| III 文档结构 | PASS | 行为变化写入 `README.md`，控件机制写入 `docs/how-it-works.md`，条目写入 `CHANGELOG.md` |
| IV 质量门禁 | PASS | 每个阶段跑 `pnpm format && pnpm check`，收尾跑 `pnpm build` |
| V 公开引用 | PASS | 移植文件头写来源 URL 与 MIT 许可证，路径全部用仓库内相对路径 |

## Project Structure

### Documentation (this feature)

```text
specs/047-presence-time-picker/
├── plan.md
├── spec.md
├── checklists/requirements.md
├── tasks.md
└── real-device-report.md
```

### Source Code

```text
src/client/
├── ui/
│   ├── cn.ts               # clsx + tailwind-merge，对应 shadcn 的 lib/utils
│   ├── button.tsx          # shadcn button（new-york-v4）
│   ├── input-group.tsx     # shadcn input-group
│   ├── popover.tsx         # shadcn popover（radix）
│   └── time-picker.tsx     # ReUI time-picker 移植，只保留 24 小时制与时分
├── tailwind.css            # Tailwind 入口：utilities、令牌映射、局部 base
├── tailwind.generated.css  # 构建产物，gitignore
├── presence-alarms-editor.tsx
├── presence-alarms.css
└── presence-config.tsx
scripts/
└── build-client-css.mjs    # 调用 Tailwind CLI 生成 tailwind.generated.css
```

## 关键设计

### 1. Tailwind 接入

- `src/client/tailwind.css`：

  ```css
  @import "tailwindcss/utilities" source(none);
  @import "tw-animate-css";
  @source "./**/*.tsx";

  @theme inline {
    --color-background: var(--dsw-alias-bg-base);
    --color-foreground: var(--dsw-alias-label-primary);
    --color-popover: var(--dsw-alias-bg-layer-2);
    --color-popover-foreground: var(--dsw-alias-label-primary);
    --color-primary: var(--dsw-alias-state-business-primary);
    --color-primary-foreground: #fff;
    --color-secondary: var(--dsw-alias-bg-layer-3);
    --color-muted: var(--dsw-alias-bg-layer-1);
    --color-muted-foreground: var(--dsw-alias-label-secondary);
    --color-accent: var(--dsw-alias-interactive-bg-hover);
    --color-accent-foreground: var(--dsw-alias-label-primary);
    --color-border: var(--dsw-alias-border-l3);
    --color-input: var(--dsw-alias-border-l4);
    --color-ring: var(--dsw-alias-state-business-primary);
    --color-destructive: var(--dsw-alias-state-error-primary);
    --radius-sm: var(--dsw-radius-sm);
    --radius-md: var(--dsw-radius-md);
    --radius-lg: var(--dsw-radius-lg);
  }
  ```

- 不引 `tailwindcss/preflight`，改为一段只作用于 `[data-dsh-lark-ui]` 子树的最小 base：`box-sizing`、`border-style: solid`、`button`/`input` 的默认透明背景与继承字体。
- `source(none)` 关掉自动扫描，只用 `@source` 指向 `src/client`，避免把 worktree、dist 里的类编进产物。
- `scripts/build-client-css.mjs` 在 tsdown 之前生成 `src/client/tailwind.generated.css`；`package.json` 的 `build` 与 `dev` 前置该脚本。生成的 CSS 由 `src/client/index.ts` 导入，tsdown 收进 `dist/client.css`，构建末尾的 `inlineClientCss` 再注入 `client.js`。

### 2. 移植的 shadcn 组件

- 三个组件按 shadcn `new-york-v4` 源码落地，`cn` 用 `clsx` + `tailwind-merge`。
- 用到的图标换成宿主 `IconClockOutlineRegular`，避免为一个图标引入 `lucide-react`。
- 每个文件头写明来源 URL 与 MIT 许可证。

### 3. 时间选择控件

- 只保留 24 小时制、`granularity="minute"`，去掉秒列与 AM/PM 列，`value` 直接是 `HH:mm`，与 `PresenceAlarm.time` 同格式。
- 编辑弹窗内用 `TimePicker` 的输入组形态：`InputGroup` 显示 `HH:mm`，右侧时钟按钮打开 Popover，Popover 内是小时列与分钟列。
- i18n 用 `presenceConfig.editor.*` 文案键，删除表盘相关的 `presenceConfig.editor.clock`。

### 4. 配置行

- 每条时间是一张卡片：时间按钮（等宽数字、主字号）+ 跳过周末/跳过节假日的可点 chip + 右侧启用开关与删除按钮。
- 停用行整体降透明度；卡片用 `--dsw-alias-bg-layer-1` 填充与 `--dsw-alias-border-l3` 描边。
- 样式写在 `presence-alarms.css`，类名以 `dsh-lark-` 开头，与 Tailwind 生成的 utilities 并存。

## Complexity Tracking

| 偏离 | 理由 |
| --- | --- |
| 不引入 `lucide-react`，改用宿主图标 | 只用一个时钟图标，引入整套图标库不划算；宿主图标与相邻控件一致 |
| 不引 Tailwind preflight | preflight 会重置宿主页面，必须挡在产物外，用局部 base 补齐用到的默认值 |
| 保留一份手写 `presence-alarms.css` | 配置行需要卡片与层级样式，写成语义类比堆叠 utilities 更好读 |

## 验收

- `pnpm format && pnpm check && pnpm build` 全绿。
- 产物守卫：`dist/client.css` 不含 `*,::before,::after{box-sizing` 这类 preflight 选择器，且含 `--dsw-` 引用。
- 实机：隔离 profile 中打开配置页与编辑弹窗，截图核对配置行、浮窗、选中态与深浅色。
