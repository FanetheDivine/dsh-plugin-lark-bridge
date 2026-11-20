// lark-cli 适配层测试：直接命令调用、JSON 解包、非零退出与超时错误。
import { afterEach, describe, expect, it, vi } from 'vitest';

import { CliError, LarkCli, parseJsonOutput } from '../src/cli.ts';

/** 记录调用并按预设返回的假运行器。 */
function makeRunner(outputs: Array<{ stdout?: string; stderr?: string; code?: number }>) {
  const calls: Array<{
    command: { file: string; args: readonly string[] };
    args: readonly string[];
    input?: string;
  }> = [];
  const runner = async (
    command: { file: string; args: readonly string[] },
    args: readonly string[],
    options: { input?: string },
  ) => {
    calls.push({
      command,
      args,
      ...(options.input === undefined ? {} : { input: options.input }),
    });
    const next = outputs.shift() ?? {};
    return {
      stdout: next.stdout ?? '',
      stderr: next.stderr ?? '',
      code: next.code ?? 0,
    };
  };
  return { runner, calls };
}

describe('JSON 输出', () => {
  it('解包 ok/data envelope', () => {
    expect(parseJsonOutput('{"ok":true,"data":{"name":"x"}}')).toEqual({ name: 'x' });
  });

  it('普通 JSON 原样返回', () => {
    expect(parseJsonOutput('{"a":1}')).toEqual({ a: 1 });
  });

  it('ok:false 抛出带消息的 CliError', () => {
    expect(() => parseJsonOutput('{"ok":false,"error":{"message":"not configured"}}')).toThrowError(
      'not configured',
    );
  });

  it('非 JSON 输出抛出 invalid-json', () => {
    try {
      parseJsonOutput('hello');
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe('invalid-json');
    }
  });
});

describe('LarkCli', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('直接运行本机 lark-cli 命令', async () => {
    const { runner, calls } = makeRunner([{ stdout: '1.0' }]);
    const cli = new LarkCli(runner);
    await cli.run(['--version']);
    expect(calls[0]?.command).toEqual({ file: 'lark-cli', args: [] });
  });

  it('LARK_CLI 与 PATH 不改变命令', async () => {
    vi.stubEnv('LARK_CLI', '/custom/lark-cli');
    vi.stubEnv('PATH', '/custom/bin');
    const { runner, calls } = makeRunner([{ stdout: '1.0' }]);
    const cli = new LarkCli(runner);
    await cli.run(['--version']);
    expect(calls[0]?.command).toEqual({ file: 'lark-cli', args: [] });
  });

  it('运行成功并解析 JSON', async () => {
    const { runner, calls } = makeRunner([{ stdout: '{"ok":true}' }]);
    const cli = new LarkCli(runner);
    await expect(cli.json(['profile', 'list'])).resolves.toEqual({ ok: true });
    expect(calls[0]?.args).toEqual(['profile', 'list']);
  });

  it('非零退出抛出 CliError，allowFailure 保留结果', async () => {
    const { runner } = makeRunner([
      { code: 2, stderr: 'boom' },
      { code: 2, stderr: 'boom' },
    ]);
    const cli = new LarkCli(runner);
    await expect(cli.run(['auth', 'status'])).rejects.toThrow('boom');
    const result = await cli.run(['auth', 'status'], { allowFailure: true });
    expect(result.code).toBe(2);
  });

  it('stdin 文本传给运行器', async () => {
    const { runner, calls } = makeRunner([{ stdout: '{}' }]);
    const cli = new LarkCli(runner);
    await cli.run(['profile', 'add'], { input: 'secret\n' });
    expect(calls[0]?.input).toBe('secret\n');
  });
});
