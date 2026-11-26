// 通知工具测试：参数校验、用户未知、分段与卡片发送、任务关联、部分发送失败与结果契约。
import { describe, expect, it } from 'vitest';

import { LarkCli } from '../src/cli.ts';
import { BridgeError } from '../src/errors.ts';
import { buildNotifyTool, type NotifyDeps, sendNotification } from '../src/tools.ts';
import { assertLosslessJson } from './support/lossless-json.ts';

/** 记录调用并返回固定 JSON 的 CLI。 */
function makeCli(results: Array<{ ok: boolean }> = [{ ok: true }]) {
  const calls: Array<{ args: string[]; options: { input?: string } }> = [];
  let counter = 0;
  const runner = async (
    _command: unknown,
    args: readonly string[],
    options: { input?: string },
  ) => {
    calls.push({ args: [...args], options: { ...options } });
    const next = results.shift() ?? { ok: true };
    counter += 1;
    return {
      stdout: next.ok
        ? `{"ok":true,"data":{"message_id":"om_sent${counter}"}}`
        : '{"ok":false,"error":{"message":"permission denied"}}',
      stderr: '',
      code: next.ok ? 0 : 1,
    };
  };
  return { cli: new LarkCli(runner), calls };
}

const TASK = { id: 'task-1', title: '修复登录', sessionId: 'session-task-1' };

/** 调用发送。 */
function send(
  text: unknown,
  owner: string | undefined,
  results?: Array<{ ok: boolean }>,
  extra: Record<string, unknown> = {},
  resolveTask?: NotifyDeps['resolveTask'],
) {
  const { cli, calls } = makeCli(results);
  return {
    calls,
    result: sendNotification(
      { getCli: () => cli, getOwner: () => owner, ...(resolveTask ? { resolveTask } : {}) },
      typeof text === 'string' ? { text, ...extra } : text,
    ),
  };
}

describe('sendNotification', () => {
  it('向已绑定用户发送并只返回第一条消息标识', async () => {
    const { result, calls } = send('hello', 'ou_1');
    await expect(result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls[0]?.args).toEqual([
      'im',
      '+messages-send',
      '--as',
      'bot',
      '--user-id',
      'ou_1',
      '--text',
      '-',
      '--idempotency-key',
      expect.stringMatching(/^lark-notify-/),
    ]);
    expect(calls[0]?.options.input).toBe('hello');
  });

  it('正文只通过 stdin 传递 Unicode、换行和 shell 元字符', async () => {
    const text = '你好🌍\n第二行：$(whoami) `id` ; & | < > " \'';
    const { result, calls } = send(text, 'ou_1');
    await expect(result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.options.input).toBe(text);
    const serializedArgs = calls[0]?.args.join(' ') ?? '';
    for (const fragment of ['你好', '🌍', '\n', '$', '`', ';', '&', '|', '<', '>', '"', "'"]) {
      expect(serializedArgs).not.toContain(fragment);
    }
  });

  it('空文本与非法参数返回错误', async () => {
    await expect(send('  ', 'ou_1').result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-text' },
    });
    await expect(send(42, 'ou_1').result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-args' },
    });
  });

  it('用户未知时不发送', async () => {
    const { result, calls } = send('hello', undefined);
    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'owner-missing' } });
    expect(calls).toEqual([]);
  });

  it('超过单条上限时按顺序拆分，结果仍只含第一条消息标识', async () => {
    const text = 'x'.repeat(20_000);
    const { result, calls } = send(text, 'ou_1', [{ ok: true }, { ok: true }]);
    await expect(result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.options.input).join('')).toBe(text);
  });

  it('发送失败返回错误而不抛出', async () => {
    const { result } = send('hello', 'ou_1', [{ ok: false }]);
    const value = await result;
    expect(value.ok).toBe(false);
    expect(value.error?.code).toBe('send-failed');
    expect(value.error?.sentCount).toBeUndefined();
  });

  it('带 reply_to 时用回复接口发送', async () => {
    const { result, calls } = send('收到', 'ou_1', undefined, { reply_to: 'om_1' });
    await expect(result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls[0]?.args).toEqual([
      'im',
      '+messages-reply',
      '--as',
      'bot',
      '--message-id',
      'om_1',
      '--text',
      '-',
      '--idempotency-key',
      expect.stringMatching(/^lark-notify-/),
    ]);
    expect(calls[0]?.options.input).toBe('收到');
  });

  it('分段时只有首段使用回复', async () => {
    const text = 'x'.repeat(20_000);
    const { result, calls } = send(text, 'ou_1', [{ ok: true }, { ok: true }], {
      reply_to: 'om_1',
    });
    expect((await result).ok).toBe(true);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[1]).toBe('+messages-reply');
    expect(calls[0]?.args).toContain('om_1');
    expect(calls[1]?.args[1]).toBe('+messages-send');
    expect(calls[1]?.args).toContain('ou_1');
    expect(calls.map((call) => call.options.input).join('')).toBe(text);
  });

  it('回复失败返回错误且不回落为普通发送', async () => {
    const { result, calls } = send('收到', 'ou_1', [{ ok: false }], { reply_to: 'om_gone' });
    const value = await result;
    expect(value.ok).toBe(false);
    expect(value.error?.code).toBe('reply-failed');
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args[1]).toBe('+messages-reply');
  });

  it('reply_to 类型错误时拒绝发送', async () => {
    const { result, calls } = send('收到', 'ou_1', undefined, { reply_to: 42 });
    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-reply-to' },
    });
    await expect(send('收到', 'ou_1', undefined, { reply_to: ' ' }).result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-reply-to' },
    });
    expect(calls).toEqual([]);
  });

  it('部分发送成功后失败时说明已发条数与第一条消息标识', async () => {
    const text = 'x'.repeat(20_000);
    const { result, calls } = send(text, 'ou_1', [{ ok: true }, { ok: false }]);
    const value = await result;
    expect(calls).toHaveLength(2);
    expect(value.ok).toBe(false);
    expect(value.error).toMatchObject({
      code: 'send-failed',
      sentCount: 1,
      firstMessageId: 'om_sent1',
    });
    expect(value.error?.message).toContain('已发送 1/2 条');
    expect(value.error?.message).toContain('om_sent1');
    expect(value.error?.message).toContain('不要重发整批');
  });
});

describe('sendNotification 卡片模式', () => {
  it('card 模式发送 interactive 卡片，总结常显、正文放进默认收起的面板', async () => {
    const { result, calls } = send('# 标题\n\n正文', 'ou_1', undefined, {
      mode: 'card',
      summary: 'xxx 任务已完成',
    });
    await expect(result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.args).toEqual([
      'im',
      '+messages-send',
      '--as',
      'bot',
      '--user-id',
      'ou_1',
      '--msg-type',
      'interactive',
      '--content',
      '-',
      '--idempotency-key',
      expect.stringMatching(/^lark-notify-/),
    ]);
    const card = JSON.parse(calls[0]?.options.input ?? '{}');
    expect(card.schema).toBe('2.0');
    expect(card.header.title.content).toBe('xxx 任务已完成');
    const panel = card.body.elements[0];
    expect(panel.tag).toBe('collapsible_panel');
    expect(panel.expanded).toBe(false);
    expect(panel.elements[0]).toEqual({ tag: 'markdown', content: '# 标题\n\n正文' });
  });

  it('card 模式缺少 summary 或 mode 非法时拒绝', async () => {
    const missing = send('正文', 'ou_1', undefined, { mode: 'card' });
    await expect(missing.result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-summary' },
    });
    const blank = send('正文', 'ou_1', undefined, { mode: 'card', summary: '  ' });
    await expect(blank.result).resolves.toMatchObject({
      ok: false,
      error: { code: 'invalid-summary' },
    });
    const bad = send('正文', 'ou_1', undefined, { mode: 'fancy' });
    await expect(bad.result).resolves.toMatchObject({ ok: false, error: { code: 'invalid-mode' } });
    expect(missing.calls.length + blank.calls.length + bad.calls.length).toBe(0);
  });

  it('card 模式带 reply_to 时首张卡片用回复接口', async () => {
    const { calls, result } = send('正文', 'ou_1', undefined, {
      mode: 'card',
      summary: '总结',
      reply_to: 'om_1',
    });
    await result;
    expect(calls[0]?.args.slice(0, 7)).toEqual([
      'im',
      '+messages-reply',
      '--as',
      'bot',
      '--message-id',
      'om_1',
      '--msg-type',
    ]);
  });

  it('超长内容拆成多张卡片，标题带序号，部分失败时报告已发张数', async () => {
    const paragraph = `${'段'.repeat(1000)}\n\n`;
    const text = paragraph.repeat(60);
    const { result, calls } = send(text, 'ou_1', [{ ok: true }, { ok: false }], {
      mode: 'card',
      summary: '很长的报告',
    });
    const value = await result;
    expect(calls).toHaveLength(2);
    const first = JSON.parse(calls[0]?.options.input ?? '{}');
    expect(first.header.title.content).toMatch(/^很长的报告（1\/\d+）$/);
    expect(value.ok).toBe(false);
    expect(value.error).toMatchObject({ sentCount: 1, firstMessageId: 'om_sent1' });
  });
});

describe('sendNotification 任务关联', () => {
  const resolveTask = async (id: string) => {
    if (id !== TASK.id) throw new BridgeError('task-not-found', `任务不存在或已结束：${id}`);
    return TASK;
  };

  it('文本模式在首行补写「名称 (id)」并返回任务会话标识', async () => {
    const { result, calls } = send(
      '进度 80%',
      'ou_1',
      undefined,
      { task_id: 'task-1' },
      resolveTask,
    );
    await expect(result).resolves.toEqual({
      ok: true,
      messageId: 'om_sent1',
      taskSessionId: 'session-task-1',
    });
    expect(calls[0]?.options.input).toBe('修复登录 (task-1)\n进度 80%');
  });

  it('卡片模式把任务名写进副标题，正文不改', async () => {
    const { calls, result } = send(
      '正文',
      'ou_1',
      undefined,
      { task_id: 'task-1', mode: 'card', summary: '修复登录已完成' },
      resolveTask,
    );
    await result;
    const card = JSON.parse(calls[0]?.options.input ?? '{}');
    expect(card.header.subtitle.content).toBe('修复登录 (task-1)');
    expect(card.body.elements[0].elements[0].content).toBe('正文');
  });

  it('任务不存在或已结束时报错且不发送', async () => {
    const { result, calls } = send('x', 'ou_1', undefined, { task_id: 'task-gone' }, resolveTask);
    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'task-not-found' } });
    expect(calls).toEqual([]);
  });

  it('台账不可读时带 task_id 报错，不带 task_id 照常发送', async () => {
    const broken = async () => {
      throw new BridgeError('task-ledger-unavailable', '任务台账校验失败，无法查找任务');
    };
    const withTask = send('x', 'ou_1', undefined, { task_id: 'task-1' }, broken);
    await expect(withTask.result).resolves.toMatchObject({
      ok: false,
      error: { code: 'task-ledger-unavailable' },
    });
    expect(withTask.calls).toEqual([]);
    const without = send('x', 'ou_1', undefined, {}, broken);
    await expect(without.result).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
  });

  it('没有任务解析来源时带 task_id 报错', async () => {
    const { result, calls } = send('x', 'ou_1', undefined, { task_id: 'task-1' });
    await expect(result).resolves.toMatchObject({
      ok: false,
      error: { code: 'task-ledger-unavailable' },
    });
    expect(calls).toEqual([]);
  });

  it('task_id 为空串或非字符串时拒绝', async () => {
    const { result } = send('x', 'ou_1', undefined, { task_id: ' ' }, resolveTask);
    await expect(result).resolves.toMatchObject({ ok: false, error: { code: 'invalid-task-id' } });
  });
});

/** 构造带桥接判定的工具。 */
function makeTool(isBridge: boolean, results?: Array<{ ok: boolean }>) {
  const { cli, calls } = makeCli(results);
  const tool = buildNotifyTool({
    getCli: () => cli,
    getOwner: () => 'ou_1',
    resolveTask: async () => TASK,
    isBridgeAgent: async () => isBridge,
  });
  return { tool, calls };
}

describe('buildNotifyTool', () => {
  it('声明是含 properties 与 required 的 JSON Schema', () => {
    const { tool } = makeTool(true);
    expect(tool.name).toBe('lark_notify');
    expect(tool.description).toContain('lark_notify');
    const parameters = tool.parameters as {
      type?: string;
      properties?: Record<string, { type?: string; enum?: string[] }>;
      required?: string[];
    };
    expect(parameters.type).toBe('object');
    expect(parameters.properties?.['text']).toMatchObject({ type: 'string' });
    expect(parameters.properties?.['reply_to']).toMatchObject({ type: 'string' });
    expect(parameters.properties?.['summary']).toMatchObject({ type: 'string' });
    expect(parameters.properties?.['task_id']).toMatchObject({ type: 'string' });
    expect(parameters.properties?.['mode']).toMatchObject({ enum: ['text', 'card'] });
    expect(parameters.required).toEqual(['text']);
    expect(parameters).not.toHaveProperty('$schema');
    expect(Object.keys(parameters)).toEqual([
      'type',
      'properties',
      'required',
      'additionalProperties',
    ]);
    expect(() => assertLosslessJson(parameters, 'lark_notify.parameters')).not.toThrow();
    expect(typeof tool.execute).toBe('function');
  });

  it('模型可见的成功结果只含消息标识，任务会话标识只在展示元数据中', () => {
    const { tool } = makeTool(true);
    const value = { ok: true, messageId: 'om_9', taskSessionId: 'session-task-1' };
    expect(tool.output.render({}, value)).toEqual([
      { type: 'text', text: '已发送给用户（消息 om_9）' },
    ]);
    expect(JSON.stringify(tool.output.render({}, value))).not.toContain('session-task-1');
    expect(tool.output.presentationMeta?.({}, value)).toEqual({ taskSessionId: 'session-task-1' });
    expect(tool.output.presentationMeta?.({}, { ok: true, messageId: 'om_9' })).toEqual({});
    expect(tool.output.presentationMeta?.({}, { ok: false })).toEqual({});
    expect(tool.output.render({}, { ok: true })).toEqual([{ type: 'text', text: '已发送给用户' }]);
  });

  it('非桥接会话不可用时不调用 CLI', async () => {
    const { tool, calls } = makeTool(false);
    await expect(
      tool.execute({ text: 'hello' }, { agent: { session: { id: 's2' } } } as never),
    ).resolves.toEqual({
      ok: false,
      error: { code: 'not-bridge-session', message: 'lark_notify 只在桥接会话可用' },
    });
    expect(calls).toEqual([]);
  });

  it('缺少 agent 或判定异常时同样拒绝', async () => {
    const { cli, calls } = makeCli();
    const tool = buildNotifyTool({
      getCli: () => cli,
      getOwner: () => 'ou_1',
      isBridgeAgent: async () => {
        throw new Error('state unavailable');
      },
    });
    await expect(tool.execute({ text: 'hello' }, {} as never)).resolves.toMatchObject({
      ok: false,
      error: { code: 'not-bridge-session' },
    });
    await expect(
      tool.execute({ text: 'hello' }, { agent: { session: { id: 's1' } } } as never),
    ).resolves.toMatchObject({ ok: false, error: { code: 'not-bridge-session' } });
    expect(calls).toEqual([]);
  });

  it('桥接会话执行时按参数发送，结果不再含调用方会话标识', async () => {
    const { tool, calls } = makeTool(true);
    await expect(
      tool.execute({ text: 'hello' }, { agent: { session: { id: 's1' } } } as never),
    ).resolves.toEqual({ ok: true, messageId: 'om_sent1' });
    expect(calls[0]?.args.slice(0, 5)).toEqual([
      'im',
      '+messages-send',
      '--as',
      'bot',
      '--user-id',
    ]);
  });

  it('桥接会话带 task_id 执行时返回任务会话标识', async () => {
    const { tool } = makeTool(true);
    await expect(
      tool.execute({ text: 'hello', task_id: 'task-1' }, {
        agent: { session: { id: 's1' } },
      } as never),
    ).resolves.toEqual({ ok: true, messageId: 'om_sent1', taskSessionId: 'session-task-1' });
  });

  it('非桥接错误使用独立展示文案', () => {
    const { tool } = makeTool(true);
    expect(
      tool.output.render(
        {},
        { ok: false, error: { code: 'not-bridge-session', message: '只在桥接会话可用' } },
      ),
    ).toEqual([{ type: 'text', text: '只在桥接会话可用' }]);
  });
});
