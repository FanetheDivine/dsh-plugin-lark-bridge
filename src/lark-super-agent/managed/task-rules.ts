/**
 * S：提问被拒后插入的临时指令，要求改用 send_report 上报一份自足的提问，并附上被拦截的问题。
 * 正文收尾要求与 send_report 描述同口径。
 * 导出 TASK_RULES_SOURCE_KIND、TASK_RULES_TEXT、blockedQuestionsText 与任务提醒的识别与构造。
 */
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

/** 提醒消息的来源标识。 */
export const TASK_RULES_SOURCE_KIND = 'lark-task-rules';

/** 提醒正文。 */
export const TASK_RULES_TEXT = `This is a one-off instruction for this turn; ignore it afterwards. This session is managed by the dispatch session and cannot ask the user directly. Your ask_user_question call was blocked and the user did not see it. Call send_report with kind question now to ask instead.

The user reads the report away from this session and may not remember this task. Make the report self-contained:
- The task goal and the current state: what is done and what blocks you.
- Each question with its options, what each option means, and your recommendation.
- desc: summarize this task, because the dispatch session knows only the task's first message.

- Put everything for the user in the report: conclusions, lists, blockers, and the decision you need. After the report, your response body holds at most one short closing line, or stays empty.
- The report is your only channel to the user until the user answers you.
- When you are stuck, ask through a question report with the current state, what you tried, the blocker, and the decision you need. Keep doing useful independent work; never wait silently.`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 取字符串字段并去掉首尾空白；非字符串返回空串。 */
function field(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === 'string' ? value.trim() : '';
}

/** 把被拦截的问题渲染成 S 的附加段；没有可读问题时返回空串。 */
export function blockedQuestionsText(questions: readonly unknown[]): string {
  const lines: string[] = [];
  let count = 0;
  for (const item of questions) {
    const question = isRecord(item) ? item : {};
    const text = field(question, 'question');
    const header = field(question, 'header');
    if (text === '' && header === '') continue;
    count += 1;
    lines.push(
      `- Q${count}${header === '' ? '' : ` [${header}]`}: ${text === '' ? '(no question text)' : text}`,
    );
    const options = Array.isArray(question.options) ? question.options : [];
    for (const option of options) {
      if (!isRecord(option)) continue;
      const label = field(option, 'label');
      if (label === '') continue;
      const description = field(option, 'description');
      lines.push(`  - ${label}${description === '' ? '' : `: ${description}`}`);
    }
    if (question.multi_select === true) lines.push('  (multi-select)');
  }
  if (lines.length === 0) return '';
  return ['Blocked questions. Keep their wording and options in the report:', ...lines].join('\n');
}

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-task-rules': {
      kind: 'lark-task-rules';
      form: 'notice';
    };
  }
}

/** 构造一条内容为 S 的用户消息；带问题时在末尾附上被拦截的问题。 */
export function taskRulesMessage(questions: readonly unknown[] = []): UserMessage {
  const blocked = blockedQuestionsText(questions);
  const text = blocked === '' ? TASK_RULES_TEXT : `${TASK_RULES_TEXT}\n\n${blocked}`;
  return createUserMessage({
    content: [{ type: 'text', text }],
    source: { kind: TASK_RULES_SOURCE_KIND, form: 'notice' },
  });
}

/** 本批消息中是否已包含 S。 */
export function hasTaskRules(messages: readonly UserMessage[]): boolean {
  return messages.some((message) => message.source.kind === TASK_RULES_SOURCE_KIND);
}
