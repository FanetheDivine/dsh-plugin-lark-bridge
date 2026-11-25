# Research: 任务边界与上报规则

## R-001 本机模式不上报的来源

- Decision: 改写工作会话提示词，上报规则与在场状态无关。
- Rationale: `SA_WORKER_PROMPT` 的 Local mode 一节写明普通对话不上报，只上报需求变更、完成与放弃；模型在正文交付结果后常省略完成上报。
- Alternatives considered: 工作会话一轮结束未上报时由程序兜底通知。用户选择只改提示词。

## R-002 任务串扰的来源

- Decision: 调度会话提示词改为「默认新任务」，首条要求只带本任务内容。
- Rationale: 现有分类按语义区分进度追问与补充，没有默认值；调度会话长对话保留前一任务的上下文。
- Alternatives considered: 记录机器人消息 id 并在注入时按 `reply_to` 标注任务。用户选择只改提示词。

## R-003 结束信号

- Decision: `send_report` 必填 `kind`，取值 `progress`、`question`、`completed`、`abandoned`。
- Rationale: C1 下完成即归档并停止工作会话，文字判断的误判代价高。
- Alternatives considered: 服务按 `kind` 自动改状态。归档会话仍需调度会话执行，用户选择由调度会话负责状态。

## R-004 工具参数校验

- Decision: schema 声明 `enum` 与 `required`，服务层再校验。
- Rationale: `defineTool` 在执行前按 schema 抛 `ToolArgsError`；服务也被测试与其他调用者直接使用。
- Alternatives considered: 只在服务校验。模型拿到的工具声明就缺少枚举提示。
