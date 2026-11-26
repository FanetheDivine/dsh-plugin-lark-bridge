# Requirements Checklist: 调度会话模型信息查询工具

**Purpose**: 校验 spec.md 的需求质量：完整性、可测试性与无歧义性。
**Created**: 2026-11-26
**Feature**: [spec.md](../spec.md)

**Review Ownership**: This checklist is a reviewer-owned requirements-quality review artifact. Mark an item `[x]` only when the reviewer determines the requirements-quality criterion is satisfied.
**Marker Semantics**: `[x]` means the criterion has been reviewed and satisfied for requirements quality. It does not mean implementation work is complete.

## 需求完整性

- [x] CHK001 每个用户故事都有可独立验证的验收场景
- [x] CHK002 数据来源（宿主模型目录）已在假设中明确
- [x] CHK003 错误路径（模型服务不可用）已有对应需求与故事
- [x] CHK004 工具命名已确定（D-001：list_models）
- [x] CHK005 返回字段范围已确定（D-002：provider、model、支持的 effort）

## 需求一致性

- [x] CHK006 FR 与用户故事一一对应，无孤立需求
- [x] CHK007 术语（provider、model、模型目录）全文一致

## 可测试性

- [x] CHK008 每条 FR 均可用给定/当/然后场景验证
- [x] CHK009 成功标准可度量（单次调用、路由有效性、失败可见）

## 边界与约束

- [x] CHK010 无参数查询已确定满足全部场景（D-005）
- [x] CHK011 空目录、空 provider 等边界已列入 Edge Cases

## Notes

- Mark items `[x]` only after review confirms the requirement-quality criterion is satisfied
- Leave items unchecked when they still require clarification, correction, or reviewer evaluation
- `/speckit-implement` reads checklist checkbox state as a gate and must not modify markers
- `checklists/requirements.md` has a separate built-in lifecycle maintained by `/speckit-specify` and `/speckit-clarify`
- 全部条目已通过复核，Open Decisions 已清空
