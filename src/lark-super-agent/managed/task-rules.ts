/**
 * S：提问被拒后插入的临时指令，说明改用 send_report 提问。
 * 正文收尾要求与 send_report 描述同口径。
 * 导出 TASK_RULES_SOURCE_KIND、TASK_RULES_TEXT 与任务提醒的识别与构造。
 */
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

/** 提醒消息的来源标识。 */
export const TASK_RULES_SOURCE_KIND = 'lark-task-rules';

/** 提醒正文。 */
export const TASK_RULES_TEXT = `This is a one-off instruction for this turn; ignore it afterwards. This session is managed by the dispatch session and cannot ask the user directly. Call send_report with kind question to ask instead of ask_user_question.

- Put everything for the user in the report: conclusions, lists, blockers, and the decision you need. After the report, your response body holds at most one short closing line, or stays empty.
- desc: summarize this task, because the dispatch session knows only the task's first message.
- The report is your only channel to the user until the user answers you.
- When you are stuck, ask through a question report with the current state, what you tried, the blocker, and the decision you need. Keep doing useful independent work; never wait silently.`;

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-task-rules': {
      kind: 'lark-task-rules';
      form: 'notice';
    };
  }
}

/** 构造一条内容为 S 的用户消息。 */
export function taskRulesMessage(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: TASK_RULES_TEXT }],
    source: { kind: TASK_RULES_SOURCE_KIND, form: 'notice' },
  });
}

/** 本批消息中是否已包含 S。 */
export function hasTaskRules(messages: readonly UserMessage[]): boolean {
  return messages.some((message) => message.source.kind === TASK_RULES_SOURCE_KIND);
}
