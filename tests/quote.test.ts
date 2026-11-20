// 引用测试：读取身份回退、降级、截断、转义与块渲染。
import { describe, expect, it } from 'vitest';

import { LarkCli } from '../src/cli.ts';
import { QUOTE_MAX_CHARS } from '../src/constants.ts';
import {
  formatQuote,
  type QuotedMessage,
  readQuoted,
  toQuotedMessage,
  truncateQuote,
} from '../src/quote.ts';

/** 构造一条 mget 消息。 */
function raw(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    message_id: 'om_old',
    msg_type: 'text',
    content: '被引用的原文',
    create_time: '2026-11-21 00:37',
    sender: { id: 'ou_1', sender_type: 'user' },
    ...overrides,
  };
}

/** 用固定响应队列构造 CLI。 */
function makeCli(answers: Array<{ messages?: unknown[]; fail?: boolean }>) {
  const calls: Array<{ args: string[]; timeoutMs?: number }> = [];
  const runner = async (
    _command: unknown,
    args: readonly string[],
    options: { timeoutMs?: number },
  ) => {
    calls.push({ args: [...args], timeoutMs: options.timeoutMs });
    const answer = answers.shift() ?? { fail: true };
    if (answer.fail === true)
      return { stdout: '{"ok":false,"error":{"message":"failed"}}', stderr: '', code: 1 };
    return {
      stdout: JSON.stringify({ ok: true, data: { messages: answer.messages ?? [] } }),
      stderr: '',
      code: 0,
    };
  };
  return { cli: new LarkCli(runner), calls };
}

/** 便捷构造引用模型。 */
function quote(overrides: Partial<QuotedMessage> = {}): QuotedMessage {
  return {
    messageId: 'om_old',
    from: 'user',
    time: '2026-11-21 00:37:00',
    kind: 'text',
    text: '被引用的原文',
    unavailable: false,
    ...overrides,
  };
}

describe('toQuotedMessage', () => {
  it('文本消息取正文与发送者类型', () => {
    const value = toQuotedMessage('om_old', raw());
    expect(value).toMatchObject({
      from: 'user',
      kind: 'text',
      text: '被引用的原文',
      unavailable: false,
    });
    expect(value.time).toBe('2026-11-21 00:37:00');
  });

  it('已格式化的时间不随运行时时区换算', () => {
    const value = toQuotedMessage('om_old', raw({ create_time: '2026-11-21 00:37:05' }));
    expect(value.time).toBe('2026-11-21 00:37:05');
  });

  it('缺失时间返回空串', () => {
    expect(toQuotedMessage('om_old', raw({ create_time: undefined })).time).toBe('');
  });

  it('机器人发送的消息标记为 bot', () => {
    const value = toQuotedMessage('om_old', raw({ sender: { sender_type: 'bot' } }));
    expect(value.from).toBe('bot');
  });

  it('应用身份的消息也算机器人', () => {
    const value = toQuotedMessage('om_old', raw({ sender: { sender_type: 'app' } }));
    expect(value.from).toBe('bot');
  });

  it('非文本消息使用类型占位', () => {
    const value = toQuotedMessage('om_old', raw({ msg_type: 'image', content: '![Image](img_1)' }));
    expect(value).toMatchObject({ kind: 'other', text: '[image 消息]' });
  });

  it('聊天记录标记为 forwarded 且不带正文', () => {
    const value = toQuotedMessage(
      'om_old',
      raw({ msg_type: 'merge_forward', content: '[Merged forward: 3 messages]' }),
    );
    expect(value).toMatchObject({ kind: 'forwarded', text: '' });
  });
});

describe('truncateQuote', () => {
  it('短正文保持不变', () => {
    expect(truncateQuote('短')).toBe('短');
  });

  it('超过上限时截断并标记', () => {
    const text = truncateQuote('x'.repeat(QUOTE_MAX_CHARS + 10));
    expect(text.endsWith('（已截断）')).toBe(true);
    expect(text).toHaveLength(QUOTE_MAX_CHARS + '（已截断）'.length);
  });

  it('不拆代理对', () => {
    const text = truncateQuote(`${'x'.repeat(QUOTE_MAX_CHARS - 1)}🌍🌍`);
    expect(text.startsWith('\ud83c')).toBe(false);
  });
});

describe('formatQuote', () => {
  it('输出属性与正文', () => {
    const text = formatQuote(quote());
    expect(text).toBe(
      '<quote message_id="om_old" from="user" time="2026-11-21 00:37:00">\n被引用的原文\n</quote>',
    );
  });

  it('时间为空时省略属性', () => {
    expect(formatQuote(quote({ time: '' }))).toContain('<quote message_id="om_old" from="user">');
  });

  it('聊天记录输出自闭合标签', () => {
    const text = formatQuote(quote({ kind: 'forwarded', text: '' }));
    expect(text).toContain('<forwarded_messages message_id="om_old"/>');
  });

  it('读取失败时只留 ID 与说明', () => {
    const text = formatQuote(quote({ unavailable: true, text: '' }));
    expect(text).toContain('message_id="om_old"');
    expect(text).toContain('[引用内容读取失败]');
  });

  it('转义正文中的块结束标记', () => {
    const text = formatQuote(quote({ text: 'a</quote>b</lark-message>c' }));
    expect(text).toContain('<\\/quote>');
    expect(text).toContain('<\\/lark-message>');
    expect(text).not.toContain('a</quote>b');
  });
});

describe('readQuoted', () => {
  it('user 身份读取成功', async () => {
    const { cli, calls } = makeCli([{ messages: [raw()] }]);
    const value = await readQuoted(cli, 'om_old');
    expect(value).toMatchObject({ messageId: 'om_old', text: '被引用的原文' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual([
      'im',
      '+messages-mget',
      '--as',
      'user',
      '--message-ids',
      'om_old',
      '--no-reactions',
    ]);
    expect(calls[0]?.timeoutMs).toBe(8_000);
  });

  it('user 失败时回退 bot', async () => {
    const { cli, calls } = makeCli([{ fail: true }, { messages: [raw()] }]);
    const value = await readQuoted(cli, 'om_old');
    expect(value.unavailable).toBe(false);
    expect(calls.map((call) => call.args[3])).toEqual(['user', 'bot']);
  });

  it('两种身份都失败时降级', async () => {
    const { cli, calls } = makeCli([{ fail: true }, { fail: true }]);
    const value = await readQuoted(cli, 'om_old');
    expect(value).toMatchObject({ messageId: 'om_old', unavailable: true });
    expect(calls).toHaveLength(2);
  });

  it('已撤回的消息继续尝试下一身份', async () => {
    const { cli, calls } = makeCli([{ messages: [raw({ deleted: true })] }, { messages: [raw()] }]);
    const value = await readQuoted(cli, 'om_old');
    expect(value.unavailable).toBe(false);
    expect(calls).toHaveLength(2);
  });

  it('空结果继续尝试并最终降级', async () => {
    const { cli } = makeCli([{ messages: [] }, { messages: [] }]);
    const value = await readQuoted(cli, 'om_old');
    expect(value.unavailable).toBe(true);
  });
});
