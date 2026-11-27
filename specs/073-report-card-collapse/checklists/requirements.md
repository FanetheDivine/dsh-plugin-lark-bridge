# Requirements Quality Checklist: 上报卡片折叠开关

**Purpose**: 校验 spec 的需求完整性、可测试性、一致性与无障碍约束
**Created**: 2026-11-27
**Feature**: [spec.md](../spec.md)

## 范围与完整性

- [x] CHK001 GUI 中所有报告展示位置已盘点并在 Clarifications 记录结论
- [x] CHK002 各类 `kind`（`progress`、`question`、自定义、空值）均纳入覆盖范围
- [x] CHK003 默认展开、折叠后保留内容与展开后恢复内容已明确定义

## 可访问性与样式

- [x] CHK004 折叠开关要求 `<button type="button">` 与 `aria-expanded` 属性
- [x] CHK005 展开与收起状态的中英文文案键及英文回退已规定
- [x] CHK006 `.dsh-lark-report-body > [data-markdown-variant="compact"]` 主前景色不回退已列为硬约束

## 可测试性

- [x] CHK007 初始状态、折叠切换、展开恢复与边界情况均可由单元测试独立断言
- [x] CHK008 质量门禁（`pnpm check` 与 `pnpm build`）已列入成功标准

## Notes

- 全部条目已自审通过。
