# 需求质量 Checklist: 调度会话切换会话模型与恢复已归档会话

**Purpose**: 校验 spec 的需求完整性、可测试性、一致性与边界覆盖
**Created**: 2026-11-27
**Feature**: [spec.md](../spec.md)

## 范围与完整性

- [x] CHK001 两个能力的用户目标与调度会话的关系已写明
- [x] CHK002 「取消会话归档」的语义作为假设写明，并给出与删除会话的边界
- [x] CHK003 模型切换的目标范围（任务会话与自身）已明确
- [x] CHK004 恢复的范围（解除归档、任务、pin）逐项列出
- [x] CHK005 不在范围内的动作（删除会话、删除台账、重建调度会话）有明确边界

## 可测试性

- [x] CHK006 每条验收场景都能单独构造前置状态
- [x] CHK007 成功标准均可观察或测量
- [x] CHK008 失败路径（未归档、非法路由、归档任务缺失、置顶失败）都有对应场景
- [x] CHK009 结果字段足以断言切换与恢复的效果

## 一致性

- [x] CHK010 术语统一使用 provider、model、effort、pin、archive、unarchive
- [x] CHK011 恢复置顶默认值与 D-010、FR-013 一致
- [x] CHK012 任务恢复范围与 D-009、FR-010、FR-012 一致
- [x] CHK013 模型切换与全局默认模型的边界在 FR-005 与 D-004 一致

## 依赖与风险

- [x] CHK014 宿主能力（`agent.model.select`、`llm.resolveCallConfig`、`unarchiveSession`、`pinSession`）在现状基线中有代码证据
- [x] CHK015 宿主没有模型切换工具的结论有调研出处
- [x] CHK016 归档清 pin、unarchive 不恢复 pin 的宿主行为已记录
- [x] CHK017 恢复依赖的归档目录结构已描述

## Notes

- 本清单随 spec 一起自审通过；未决问题已全部记录在 spec 的 Clarifications。