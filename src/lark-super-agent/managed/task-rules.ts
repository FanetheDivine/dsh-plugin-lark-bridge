/**
 * S：被管理会话的提问以它作答的指令，要求改用 send_report 上报一份自足的提问。
 * 正文收尾要求与 send_report 描述同口径。
 * 导出 TASK_RULES_SOURCE_KIND、TASK_RULES_TEXT 与任务提醒的识别与构造。
 */
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

/** 提醒消息的来源标识。 */
export const TASK_RULES_SOURCE_KIND = 'lark-task-rules';

/** 提问工具的返回正文；也用于已在等待的提问被取消后的提醒。 */
export const TASK_RULES_TEXT = `This session is managed by the dispatch session. No user answer was received. Call send_report with kind question now so the dispatch session can relay your questions. Use send_report for this request instead of calling ask_user_question again.

The user reads the report away from this session and may not remember this task. Make the report self-contained:
- The task goal and the current state: what is done and what blocks you.
- Each question, its options and their implications, and your recommendation where appropriate.
- desc: summarize this task, because the dispatch session knows only the task's first message.

- Put everything for the user in the report: conclusions, lists, blockers, and the decision you need. After the report, your response body holds at most one short closing line, or stays empty.
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
