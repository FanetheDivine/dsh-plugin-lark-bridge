// 通知工具测试：参数校验、用户未知、分段发送与失败返回。
import { describe, expect, it } from 'vitest';

import { LarkCli } from '../src/cli.ts';
import { buildNotifyTool, sendNotification } from '../src/tools.ts';

/** 记录调用并返回固定 JSON 的 CLI。 */
function makeCli(results: Array<{ ok: boolean }> = [{ ok: true }]) {
  const calls: Array<{ args: string[]; options: { input?: string } }> = [];
  const runner = async (
    _command: unknown,
    args: readonly string[],
    options: { input?: string },
  ) => {
    calls.push({ args: [...args], options: { ...options } });
    const next = results.shift() ?? { ok: true };
    return {
      stdout: next.ok
        ? '{"ok":true,"data":{"message_id":"om_sent"}}'
        : '{"ok":false,"error":{"message":"permission denied"}}',
      stderr: '',
      code: next.ok ? 0 : 1,
    };
  };
  return { cli: new LarkCli(runner), calls };
}

/** 调用发送。 */
function send(
  text: unknown,
  owner: string | undefined,
  results?: Array<{ ok: boolean }>,
  extra: Record<string, unknown> = {},
) {
  const { cli, calls } = makeCli(results);
  return {
    calls,
    result: sendNotification(
      { getCli: () => cli, getOwner: () => owner },
      typeof text === 'string' ? { text, ...extra } : text,
    ),
  };
}

describe('sendNotification', () => {
  it('向已绑定用户发送并返回消息标识', async () => {
    const { result, calls } = send('hello', 'ou_1');
    await expect(result).resolves.toEqual({ ok: true, parts: 1, messageId: 'om_sent' });
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
    await expect(result).resolves.toEqual({ ok: true, parts: 1, messageId: 'om_sent' });
    expect(calls).toHaveLength(1);
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

  it('超过单条上限时按顺序拆分', async () => {
    const text = 'x'.repeat(20_000);
    const { result, calls } = send(text, 'ou_1', [{ ok: true }, { ok: true }]);
    const value = await result;
    expect(value.ok).toBe(true);
    expect(value.parts).toBe(2);
    expect(calls).toHaveLength(2);
    expect(calls.map((call) => call.options.input).join('')).toBe(text);
  });

  it('发送失败返回错误而不抛出', async () => {
    const { result } = send('hello', 'ou_1', [{ ok: false }]);
    const value = await result;
    expect(value.ok).toBe(false);
    expect(value.error?.code).toBe('send-failed');
  });

  it('带 reply_to 时用回复接口发送', async () => {
    const { result, calls } = send('收到', 'ou_1', undefined, { reply_to: 'om_1' });
    await expect(result).resolves.toEqual({
      ok: true,
      parts: 1,
      messageId: 'om_sent',
      replyTo: 'om_1',
    });
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
    const value = await result;
    expect(value.ok).toBe(true);
    expect(value.parts).toBe(2);
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
});

/** 构造带桥接判定的工具。 */
function makeTool(isBridge: boolean, results?: Array<{ ok: boolean }>) {
  const { cli, calls } = makeCli(results);
  const tool = buildNotifyTool({
    getCli: () => cli,
    getOwner: () => 'ou_1',
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
      properties?: Record<string, { type?: string; description?: string }>;
      required?: string[];
    };
    expect(parameters.type).toBe('object');
    expect(parameters.properties?.['text']).toMatchObject({ type: 'string' });
    expect(parameters.properties?.['reply_to']).toMatchObject({ type: 'string' });
    expect(parameters.required).toEqual(['text']);
    expect(parameters).not.toHaveProperty('$schema');
    expect(typeof tool.execute).toBe('function');
    expect(tool.output.render({}, { ok: true, parts: 1 })).toEqual([
      { type: 'text', text: expect.stringContaining('已发送') },
    ]);
    expect(tool.output.render({}, { ok: true, parts: 1, replyTo: 'om_1' })).toEqual([
      { type: 'text', text: expect.stringContaining('已回复') },
    ]);
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

  it('桥接会话执行时仍按现有参数发送', async () => {
    const { tool, calls } = makeTool(true);
    await expect(
      tool.execute({ text: 'hello' }, { agent: { session: { id: 's1' } } } as never),
    ).resolves.toEqual({ ok: true, parts: 1, messageId: 'om_sent' });
    expect(calls[0]?.args.slice(0, 5)).toEqual([
      'im',
      '+messages-send',
      '--as',
      'bot',
      '--user-id',
    ]);
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
