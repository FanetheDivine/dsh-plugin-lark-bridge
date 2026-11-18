// lark-cli 适配层测试：命令解析、JSON 解包、非零退出与超时错误。
import { describe, expect, it } from 'vitest';

import { CliError, LarkCli, parseJsonOutput, resolveLarkCli } from '../src/cli.ts';

/** 记录调用并按预设返回的假运行器。 */
function makeRunner(outputs: Array<{ stdout?: string; stderr?: string; code?: number }>) {
  const calls: Array<{ args: readonly string[]; input?: string }> = [];
  const runner = async (
    _command: { file: string; args: readonly string[] },
    args: readonly string[],
    options: { input?: string },
  ) => {
    calls.push({ args, ...(options.input === undefined ? {} : { input: options.input }) });
    const next = outputs.shift() ?? {};
    return {
      stdout: next.stdout ?? '',
      stderr: next.stderr ?? '',
      code: next.code ?? 0,
    };
  };
  return { runner, calls };
}

describe('resolveLarkCli', () => {
  it('显式路径优先，脚本交给 Node 运行', () => {
    expect(resolveLarkCli('C:/tools/lark-cli.exe').file).toBe('C:/tools/lark-cli.exe');
    const script = resolveLarkCli('C:/tools/run.js', {}, 'node');
    expect(script).toEqual({ file: 'node', args: ['C:/tools/run.js'] });
  });

  it('LARK_CLI 环境变量次之', () => {
    expect(resolveLarkCli('', { LARK_CLI: '/opt/lark-cli' }, 'node').file).toBe('/opt/lark-cli');
  });

  it('空配置回落到包内或 PATH 命令', () => {
    const resolved = resolveLarkCli('', { PATH: '' }, 'node');
    expect(resolved.file.length).toBeGreaterThan(0);
  });
});

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
  it('运行成功并解析 JSON', async () => {
    const { runner, calls } = makeRunner([{ stdout: '{"ok":true}' }]);
    const cli = new LarkCli('fake', runner);
    await expect(cli.json(['profile', 'list'])).resolves.toEqual({ ok: true });
    expect(calls[0]?.args).toEqual(['profile', 'list']);
  });

  it('非零退出抛出 CliError，allowFailure 保留结果', async () => {
    const { runner } = makeRunner([
      { code: 2, stderr: 'boom' },
      { code: 2, stderr: 'boom' },
    ]);
    const cli = new LarkCli('fake', runner);
    await expect(cli.run(['auth', 'status'])).rejects.toThrow('boom');
    const result = await cli.run(['auth', 'status'], { allowFailure: true });
    expect(result.code).toBe(2);
  });

  it('stdin 文本传给运行器', async () => {
    const { runner, calls } = makeRunner([{ stdout: '{}' }]);
    const cli = new LarkCli('fake', runner);
    await cli.run(['profile', 'add'], { input: 'secret\n' });
    expect(calls[0]?.input).toBe('secret\n');
  });
});
