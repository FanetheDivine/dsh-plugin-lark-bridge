# Implementation Plan: 上报之后正文只作简短收尾

**Branch**: `fix/063-report-no-duplication` | **Date**: 2026-11-26 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/063-report-no-duplication/spec.md`

**Status**: Waived

## Open Decisions

无。实现细节已由 [research.md](./research.md) 的 R-01 至 R-06 记录并按推荐默认确定。

## Clarifications

### Session 2026-11-26

- 无新增实现决策。文案落点、断言方式、文档归属与是否做实机验证见 research。

## Review Record

- 2026-11-26 | Decision: Waived | Scope: current complete plan | Open items: none | Risks: 文案约束依赖模型遵循，无代码兜底；上报展示形态由 061 负责，本次文案对展示形式中立；未做实机验证，效果以文案断言加事后日志复核度量

## Summary

需求：任务会话上报成功后，正文只作简短收尾，重复上报内容一律不写。方案为三处文本常量的措辞改动，行为代码零变更：

- `SEND_REPORT_DESCRIPTION` 把含糊的「Keep the response body minimal」段落改写为送达事实加收尾上限加内容归属三段。
- `TASK_RULES_TEXT` 的第一条要同口径。
- `SA_DISPATCH_PROMPT` 的 `## Handle reports` 段增加一条转述规则。

`TurnReporter`、`ReportStore`、投递链路与工具参数契约保持原样。测试增加形式断言与旧表述消失断言，文档同步 `docs/how-it-works.md` 与 `CHANGELOG.md`。

## Technical Context

**Language/Version**: TypeScript（Node ESM，宿主 DSH 插件）

**Primary Dependencies**: `@deepseek-ai/*`（与 `@deepseek-ai/dsh` 同版本）；无新增依赖

**Storage**: 无新存储；三处文案均为源码常量

**Testing**: vitest（`pnpm test:code`）；产物新鲜度由 `pnpm build` 末尾的 `test:dist` 校验

**Target Platform**: DSH 宿主当前版本

**Performance Goals**: 不适用

**Constraints**: 只改文本常量；`send_report` 的参数、返回契约、存档与投递逻辑不变；`turn_end` 自动上报的触发与抑制条件不变；文案对上报的展示形式保持中立

**Scale/Scope**: 3 个源文件（`report-tool.ts`、`task-rules.ts`、`sa-dispatch/prompt.ts`）、2 个测试文件（`lark-super-agent-index.test.ts`、`sa-dispatch.test.ts`）、2 份文档

## Constitution Check

| 原则 | 结论 |
| --- | --- |
| I. 宿主依赖版本 | 通过。不新增、不升级依赖 |
| II. 测试同步 | 通过。两个测试文件增加新形式断言与旧措辞消失断言；`turn_end` 与投递链路的既有用例保持通过即为行为零变更的证据。文案断言属形式断言，理由见 R-04 |
| III. 文档结构 | 通过。收尾规则的唯一归属为 `docs/how-it-works.md` 的被管理会话能力表；S 说明只作一句指向。`README.md` 未覆盖上报机制，本次不改，见 R-06 |
| IV. 质量门禁 | 通过。实现后运行 `pnpm format && pnpm check`，并运行 `pnpm build` 更新产物 |
| V. 公开引用 | 通过。改动全部为仓内文本，无本机路径；调查数据只以比例与相对结论写入规格 |

## Project Structure

### Documentation (this feature)

```text
specs/063-report-no-duplication/
├── spec.md              # 需求规格
├── plan.md              # 本文件
├── research.md          # Phase 0 输出
├── quickstart.md        # Phase 1 输出
├── checklists/
│   └── requirements.md  # 需求质量清单
└── tasks.md             # /speckit-tasks 产出
```

### Source Code (repository root)

```text
src/
├── lark-super-agent/
│   └── managed/
│       ├── report-tool.ts   # SEND_REPORT_DESCRIPTION 的送达与收尾段落；text 参数描述补一句
│       └── task-rules.ts    # TASK_RULES_TEXT 第一条改为同口径收尾要求
└── sa-dispatch/
    └── prompt.ts            # Handle reports 段增加转述不追加复述的一条

tests/
├── lark-super-agent-index.test.ts  # 工具描述与 S 的形式断言
└── sa-dispatch.test.ts             # Handle reports 段的形式断言

docs/
└── how-it-works.md                 # 被管理会话能力表与 S 说明

CHANGELOG.md                        # 仓库根，Unreleased 增加条目
```

**Structure Decision**: 沿用现有单插件布局。改动集中在被管理会话能力目录与调度预设目录，无新增文件。

## Complexity Tracking

无需记录。五项宪法原则逐条通过，无偏离。
