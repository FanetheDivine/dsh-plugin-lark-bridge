// S 正文测试：固定指令要求自足的 question 上报，并附上被拦截的问题与选项。
import { describe, expect, it } from 'vitest';

import {
  blockedQuestionsText,
  hasTaskRules,
  TASK_RULES_SOURCE_KIND,
  TASK_RULES_TEXT,
  taskRulesMessage,
} from '../src/lark-super-agent/managed/task-rules.ts';

/** 取消息的文本正文。 */
function textOf(message: ReturnType<typeof taskRulesMessage>): string {
  const block = message.content[0] as { type: string; text?: string } | undefined;
  return block?.text ?? '';
}

describe('blockedQuestionsText', () => {
  it('列出题面、表头、选项说明与多选标注', () => {
    const text = blockedQuestionsText([
      {
        question: '选 A 还是 B',
        header: '方案',
        options: [{ label: 'A（推荐）', description: '改动小' }, { label: 'B' }],
      },
      { question: '还有补充吗？', multi_select: true },
    ]);
    expect(text.split('\n')).toEqual([
      'Blocked questions. Keep their wording and options in the report:',
      '- Q1 [方案]: 选 A 还是 B',
      '  - A（推荐）: 改动小',
      '  - B',
      '- Q2: 还有补充吗？',
      '  (multi-select)',
    ]);
  });

  it('跳过没有题面与表头的条目，全部无效时返回空串', () => {
    expect(blockedQuestionsText([])).toBe('');
    expect(blockedQuestionsText([{}, 'x', null])).toBe('');
    expect(blockedQuestionsText([{}, { question: '真的问题' }])).toContain('- Q1: 真的问题');
    expect(blockedQuestionsText([{ header: '只有表头' }])).toContain(
      '- Q1 [只有表头]: (no question text)',
    );
  });
});

describe('taskRulesMessage', () => {
  it('没有问题时正文只有固定指令', () => {
    const message = taskRulesMessage();
    expect(textOf(message)).toBe(TASK_RULES_TEXT);
    expect(message.source.kind).toBe(TASK_RULES_SOURCE_KIND);
    expect(hasTaskRules([message])).toBe(true);
  });

  it('附上被拦截的问题', () => {
    const text = textOf(
      taskRulesMessage([{ question: '要不要发版？', options: [{ label: '要' }] }]),
    );
    expect(text.startsWith(TASK_RULES_TEXT)).toBe(true);
    expect(text).toContain('- Q1: 要不要发版？');
    expect(text).toContain('  - 要');
  });

  it('固定指令要求立刻上报自足的提问', () => {
    expect(TASK_RULES_TEXT).toContain('Call send_report with kind question now');
    expect(TASK_RULES_TEXT).toContain('may not remember this task');
    expect(TASK_RULES_TEXT).toContain('The task goal and the current state');
    expect(TASK_RULES_TEXT).toContain('Each question with its options');
  });
});
