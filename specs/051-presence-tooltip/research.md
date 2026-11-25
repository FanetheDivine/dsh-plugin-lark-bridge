# Research: 在场状态按钮即时 tooltip

## 组件来源

- 决策：使用 shadcn/ui 的 Tooltip 封装，底层 `@radix-ui/react-tooltip`。
- 理由：项目已有 shadcn 的 Button、Popover、TimePicker 与 `cn` 工具；用户要求使用 shadcn/ui，Radix UI 也在允许范围。
- 备选：宿主 `@deepseek-ai/dsh-client-ui-primitives` 的 `Tooltip`。它可用且无需新依赖，但不符合用户指定的组件体系。

## 即时展示

- 决策：`TooltipProvider` 设置 `delayDuration={0}`、`skipDelayDuration={0}`。
- 理由：Radix 默认悬停延迟 700 ms；归零后指针进入即安排打开，满足 100 ms 目标。`skipDelayDuration` 归零避免连续经过其他 tooltip 时复用延迟窗口。
- 备选：保留默认延迟，由调用方传入。多个 tooltip 时默认值会让首个提示变慢。

## 位置与避让

- 决策：Content 使用 `side="top"`、`align="center"`、`collisionPadding={8}`。
- 理由：Radix 在首选方向空间不足时自动翻转并平移，覆盖窗口底部与侧栏裁切。
- 备选：自行计算坐标。重复 Radix 已有的碰撞处理。

## 渲染与样式

- 决策：Content 通过 Radix Portal 挂到 body，带 `data-dsh-lark-ui`，使用 shadcn 语义类名。
- 理由：Portal 避开侧栏层叠上下文；`data-dsh-lark-ui` 让局部 base 与设计令牌覆盖生效。
- 备选：不 Portal 的绝对定位。侧栏滚动容器可能裁剪。

## 测试方式

- 决策：静态渲染断言按钮不再有原生 `title`，并用 jsdom 挂载按钮验证指针移入、键盘聚焦、移出与失焦。
- 理由：Radix 的打开状态只在客户端产生，静态标记无法验证即时展示。
- 备选：只断言组件 props。无法覆盖真实交互。

## 已知风险

- 新增 Radix Tooltip 会增大浏览器产物。
- jsdom 没有真实布局，上方翻转与避让由 Radix 负责，需在真实 GUI 复核位置。
- 触屏设备没有 hover，Radix 不会因点击固定展示提示。
