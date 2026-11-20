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
function send(text: unknown, owner: string | undefined, results?: Array<{ ok: boolean }>) {
  const { cli, calls } = makeCli(results);
  return {
    calls,
    result: sendNotification(
      { getCli: () => cli, getOwner: () => owner },
      typeof text === 'string' ? { text } : text,
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
});

describe('buildNotifyTool', () => {
  it('定义字段完整', () => {
    const { cli } = makeCli();
    const tool = buildNotifyTool({
      getCli: () => cli,
      getOwner: () => 'ou_1',
    });
    expect(tool.name).toBe('lark_notify');
    expect(tool.parameters['text']).toMatchObject({ required: true, type: 'string' });
    expect(typeof tool.execute).toBe('function');
    expect(tool.output.render({}, { ok: true, parts: 1 })).toEqual([
      { type: 'text', text: expect.stringContaining('已发送') },
    ]);
  });
});
