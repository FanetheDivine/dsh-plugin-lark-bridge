# 需求质量检查清单：引用与聊天记录呈现、精确回复

**Purpose**: 审查 spec.md 的需求完整性、清晰度与可测性
**Created**: 2026-11-21
**Feature**: [spec.md](../spec.md)

**Note**: 由 `/speckit-specify` 生成，供规格审查使用。
**Review Ownership**: 审查者负责勾选；`[x]` 表示该需求质量条目已复核通过，不代表实现完成。
**Marker Semantics**: `[x]` 只表示需求质量合格。

## 完整性与边界

- [x] CHK001 三种输入形态（引用回复、聊天记录、普通消息）都有对应需求条目
- [x] CHK002 引用读取失败的降级行为有明确需求
- [x] CHK003 聊天记录的读取失败与不可见来源有明确需求
- [x] CHK004 非文本被引消息（图片、文件、聊天记录）的呈现有明确需求
- [x] CHK005 通知分段与 `reply_to` 的组合有明确需求
- [x] CHK006 未提供 `reply_to` 时的兼容行为有明确需求

## 清晰度

- [x] CHK007 `<quote>` 块与 `<lark-message>` 块的嵌套关系无歧义
- [x] CHK008 聊天记录占位的呈现形式在 Clarifications 后有唯一定义
- [x] CHK009 `reply_to` 的取值来源（用户消息 ID）无歧义
- [x] CHK010 转义规则明确覆盖引用内容与聊天记录内容

## 可测性

- [x] CHK011 每个验收场景都可在一次注入后通过读块内容判定
- [x] CHK012 SC-001 至 SC-006 都有可观测的判定方式
- [x] CHK013 引用读取超时场景可通过模拟 CLI 失败验证

## 一致性

- [x] CHK014 需求未引入新的会话消息，与 SC-005 一致
- [x] CHK015 提醒条目（FR-016）与引用块、聊天记录块的最终呈现一致
- [x] CHK016 文档同步已按 D-011 收敛为 CHANGELOG 与 how-it-works；README 不改的偏离需在 plan 的 Complexity Tracking 记录

## 结果

- 16/16 通过；README 不更新的偏离已记录在 [plan.md](../plan.md#complexity-tracking)

## Notes

- 未勾选的条目表示仍需澄清、修正或审查者判断
- 全部决策见 [spec.md](../spec.md#clarifications)，偏离见 [spec.md](../spec.md#open-decisions)