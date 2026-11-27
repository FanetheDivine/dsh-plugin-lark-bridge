// S 正文测试：作为提问的回答，要求自足的 question 上报；不含被拦截问题清单。
import { describe, expect, it } from 'vitest';

import {
  hasTaskRules,
  TASK_RULES_SOURCE_KIND,
  TASK_RULES_TEXT,
  taskRulesMessage,
} from '../src/lark-super-agent/managed/task-rules.ts';

describe('TASK_RULES_TEXT', () => {
  it('说明提问没有送达用户并要求立刻上报', () => {
    expect(TASK_RULES_TEXT).toContain('No user answer was received.');
    expect(TASK_RULES_TEXT).toContain('Call send_report with kind question now');
  });

  it('要求上报自足：任务目的、当前状态、提问与选项、desc', () => {
    expect(TASK_RULES_TEXT).toContain('may not remember this task');
    expect(TASK_RULES_TEXT).toContain('The task goal and the current state');
    expect(TASK_RULES_TEXT).toContain('Each question, its options');
    expect(TASK_RULES_TEXT).toContain('desc: summarize this task');
  });

  it('收尾要求与 send_report 描述同口径', () => {
    expect(TASK_RULES_TEXT).toContain('Put everything for the user in the report');
    expect(TASK_RULES_TEXT).toContain('at most one short closing line, or stays empty');
    expect(TASK_RULES_TEXT).not.toContain('Keep the response body minimal');
    expect(TASK_RULES_TEXT).not.toMatch(/card/i);
  });

  it('不列举被拦截的问题', () => {
    expect(TASK_RULES_TEXT).not.toContain('Blocked questions');
  });
});

describe('taskRulesMessage', () => {
  it('正文为 S，来源为 lark-task-rules', () => {
    const message = taskRulesMessage();
    const block = message.content[0] as { type: string; text?: string } | undefined;
    expect(block?.text).toBe(TASK_RULES_TEXT);
    expect(message.source.kind).toBe(TASK_RULES_SOURCE_KIND);
    expect(hasTaskRules([message])).toBe(true);
    expect(hasTaskRules([])).toBe(false);
  });
});
