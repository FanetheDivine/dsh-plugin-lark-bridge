// CLI 进程构造测试：跨平台命令形状、安全参数与同步启动异常。
import { describe, expect, it, vi } from 'vitest';

import { type CliCommand, CliError, createCliProcess, createSpawnSpec } from '../src/cli.ts';

const LOCAL_COMMAND: CliCommand = { file: 'lark-cli', args: [] };

describe('createSpawnSpec', () => {
  it('Unix 使用 lark-cli 与独立参数数组，不启用 shell', () => {
    expect(createSpawnSpec(LOCAL_COMMAND, ['auth', 'status', '--json'], 'linux')).toEqual({
      file: 'lark-cli',
      args: ['auth', 'status', '--json'],
      shell: false,
    });
  });

  it('Windows 把安全 token 组成单一命令字符串，不传参数数组', () => {
    expect(
      createSpawnSpec(
        LOCAL_COMMAND,
        ['im', '+messages-send', '--user-id', 'ou_1', '--text', '-'],
        'win32',
      ),
    ).toEqual({
      file: 'lark-cli im +messages-send --user-id ou_1 --text -',
      args: [],
      shell: true,
    });
  });

  it.each(['hello world', 'line\nbreak', '%PATH%', '!COMSPEC!', '&whoami', 'a|b', 'a>b'])(
    'Windows 拒绝危险参数 %j',
    (value) => {
      expect(() => createSpawnSpec(LOCAL_COMMAND, [value], 'win32')).toThrowError(CliError);
      try {
        createSpawnSpec(LOCAL_COMMAND, [value], 'win32');
      } catch (error) {
        expect((error as CliError).code).toBe('unsafe-arg');
      }
    },
  );
});

describe('createCliProcess', () => {
  it('Windows shell 调用不接收参数数组', () => {
    const spawn = vi.fn(() => ({}) as never);
    createCliProcess(LOCAL_COMMAND, ['--version'], {}, 'win32', spawn as never);
    expect(spawn).toHaveBeenCalledWith('lark-cli --version', { shell: true });
  });

  it('同步 spawn 异常转换为 spawn-failed', () => {
    const spawn = vi.fn(() => {
      throw new Error('EINVAL');
    });
    try {
      createCliProcess(LOCAL_COMMAND, ['--version'], {}, 'win32', spawn as never);
      throw new Error('should throw');
    } catch (error) {
      expect(error).toBeInstanceOf(CliError);
      expect((error as CliError).code).toBe('spawn-failed');
      expect((error as CliError).message).toContain('EINVAL');
    }
  });
});
