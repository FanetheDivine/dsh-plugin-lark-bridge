# Quickstart: 任务会话预设移除 SA-调度会话 选项

## 前置

1. `pnpm install`
2. `pnpm run build`

## 验证

1. `pnpm run check` 与 `pnpm run test:code` 全部通过。
2. 单元验证点：
   - `PresetDefaults` 携带排除列表时，名册中的 `sa-dispatch` 不出现在 `rows`。
   - 已存草稿 `taskPreset = sa-dispatch` 时，`current` 保持 `sa-dispatch`，菜单补禁用项。
   - 桥接 `sessionPreset` 的名册仍包含 `sa-dispatch`。
3. 实机验证（真实宿主）：打开「调度会话」配置页，展开「任务会话预设」，菜单无「SA-调度会话」；打开「用飞书和DSH对话」配置页，菜单仍有「SA-调度会话」。
