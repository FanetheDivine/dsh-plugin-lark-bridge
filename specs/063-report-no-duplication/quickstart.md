# Quickstart: 上报之后正文只作简短收尾

## 前置

1. `pnpm install`
2. `pnpm run build`

## 验证

1. `pnpm run check` 与 `pnpm run test:code` 全部通过。
2. 文本断言点：
   - `SEND_REPORT_DESCRIPTION` 含上报送达事实、`at most one short closing line`、内容归属清单，以及上报未送达时正文继续承载内容的一句；不再出现 `never in both`。
   - `TASK_RULES_TEXT` 的收尾条目与工具描述同口径：一句收尾上限、正文可空、上报内容不再出现。
   - `SA_DISPATCH_PROMPT` 的 `## Handle reports` 含「转述即上报内容、不追加自己的复述」条目。
   - 小节标题顺序断言不变（未新增小节）。
3. 行为零变更确认：`pnpm run test:code` 中 `tests/managed-turn-report.test.ts`、`tests/lark-super-agent-reports.test.ts`、`tests/lark-super-agent-service.test.ts` 全部保持通过，未新增抑制分支。
4. `pnpm run build` 通过 test:dist 的产物新鲜度校验。
5. 实机验证（真实宿主，可选）：
   - 派发一个需要上报的任务，确认上报送达后该轮正文只有一句收尾或为空。
   - 用户离开期间触发一次提问失败，确认随后的上报同样只带一句收尾。
6. 事后度量（合并若干天后）：遍历 `~/.dsh/sessions` 的会话日志，取新增的 `send_report` 调用，比较同轮后续正文与上报文本的相似度，与基线 28 次调用中 7 次 ≥ 0.5 对照。
