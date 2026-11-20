// 鉴权状态测试：独立连接状态、完整检测与并发复用。
import { describe, expect, it, vi } from 'vitest';

import { AuthManager, type AuthSnapshot } from '../src/auth.ts';
import { CliError, LarkCli } from '../src/cli.ts';
import type { ConnectionState } from '../src/types.ts';

/** 一条运行器结果。 */
interface Step {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly code?: number;
  readonly throws?: string;
  readonly wait?: Promise<void>;
}

/** 按顺序返回结果的假运行器。 */
function runner(steps: Step[]) {
  const calls: Array<{ args: readonly string[] }> = [];
  const run = async (_command: unknown, args: readonly string[]) => {
    calls.push({ args });
    const step = steps.shift() ?? {};
    await step.wait;
    if (step.throws !== undefined) throw new CliError('spawn-failed', step.throws);
    return { stdout: step.stdout ?? '', stderr: step.stderr ?? '', code: step.code ?? 0 };
  };
  return { run, calls };
}

/** 构造管理器。 */
function manager(steps: Step[]) {
  const fake = runner(steps);
  const cli = new LarkCli(fake.run);
  const changes: AuthSnapshot[] = [];
  const logger = { info: vi.fn(), warn: vi.fn() };
  const auth = new AuthManager({
    getCli: () => cli,
    logger,
    onChange: (snapshot) => changes.push(snapshot),
  });
  return { auth, calls: fake.calls, changes };
}

/** 一条 bot/用户状态的 JSON。 */
function status(bot: string, user?: { status: string; openId?: string; name?: string }) {
  return JSON.stringify({
    appId: 'cli_x',
    identities: {
      bot: { status: bot },
      user:
        user === undefined
          ? { status: 'missing' }
          : { status: user.status, openId: user.openId, userName: user.name },
    },
  });
}

/** 可手动完成的异步步骤。 */
function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

describe('AuthManager', () => {
  it('初始快照的三个连接均为 checking', () => {
    const { auth, changes } = manager([]);

    expect(auth.current).toEqual({
      cli: 'checking',
      bot: 'checking',
      user: 'checking',
      ready: false,
      checkedAt: 0,
      appId: undefined,
      userName: undefined,
      ownerOpenId: undefined,
      detail: undefined,
    });
    expect(changes).toEqual([]);
  });

  it('CLI spawn-failed 时三个连接均为 disconnected', async () => {
    const { auth, calls } = manager([{ throws: 'ENOENT' }]);

    const snapshot = await auth.check();

    expect(snapshot).toMatchObject({
      cli: 'disconnected',
      bot: 'disconnected',
      user: 'disconnected',
      ready: false,
      ownerOpenId: undefined,
    });
    expect(snapshot.checkedAt).toBeGreaterThan(0);
    expect(calls.map((call) => call.args)).toEqual([['--version']]);
  });

  it('auth status 失败时保留 CLI 已连接并记录内部诊断', async () => {
    const { auth, calls } = manager([{ stdout: '1.0' }, { code: 1, stderr: 'not configured' }]);

    const snapshot = await auth.check();

    expect(snapshot).toMatchObject({
      cli: 'connected',
      bot: 'disconnected',
      user: 'disconnected',
      ready: false,
      ownerOpenId: undefined,
    });
    expect(snapshot.detail).toContain('not configured');
    expect(calls.map((call) => call.args)).toEqual([
      ['--version'],
      ['auth', 'status', '--json', '--verify'],
    ]);
  });

  const identityCases: Array<{
    readonly name: string;
    readonly botStatus: string;
    readonly userStatus: { status: string; openId?: string; name?: string };
    readonly bot: ConnectionState;
    readonly user: ConnectionState;
    readonly ready: boolean;
    readonly ownerOpenId: string | undefined;
  }> = [
    {
      name: 'bot 与 user 均未连接',
      botStatus: 'missing',
      userStatus: { status: 'missing' },
      bot: 'disconnected',
      user: 'disconnected',
      ready: false,
      ownerOpenId: undefined,
    },
    {
      name: '仅 user 已连接',
      botStatus: 'missing',
      userStatus: { status: 'ready', openId: 'ou_1', name: '袁' },
      bot: 'disconnected',
      user: 'connected',
      ready: false,
      ownerOpenId: undefined,
    },
    {
      name: '仅 bot 已连接，user 缺少 open_id',
      botStatus: 'ready',
      userStatus: { status: 'ready', name: '袁' },
      bot: 'connected',
      user: 'disconnected',
      ready: false,
      ownerOpenId: undefined,
    },
    {
      name: 'bot 与 user 均已连接',
      botStatus: 'ready',
      userStatus: { status: 'ready', openId: 'ou_1', name: '袁' },
      bot: 'connected',
      user: 'connected',
      ready: true,
      ownerOpenId: 'ou_1',
    },
  ];

  for (const testCase of identityCases) {
    it(testCase.name, async () => {
      const { auth } = manager([
        { stdout: '1.0' },
        { stdout: status(testCase.botStatus, testCase.userStatus) },
      ]);

      const snapshot = await auth.check();

      expect(snapshot).toMatchObject({
        cli: 'connected',
        bot: testCase.bot,
        user: testCase.user,
        ready: testCase.ready,
        ownerOpenId: testCase.ownerOpenId,
      });
    });
  }

  it('整体 ready 时保留内部身份字段并通知 onChange', async () => {
    const { auth, changes } = manager([
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'ready', openId: 'ou_1', name: '袁' }) },
    ]);

    const snapshot = await auth.check();

    expect(snapshot).toMatchObject({
      cli: 'connected',
      bot: 'connected',
      user: 'connected',
      ready: true,
      appId: 'cli_x',
      userName: '袁',
      ownerOpenId: 'ou_1',
    });
    expect(snapshot.checkedAt).toBeGreaterThan(0);
    expect(auth.current).toBe(snapshot);
    expect(changes).toEqual([snapshot]);
  });

  it('并发 check 共享同一次带 --verify 的完整检查', async () => {
    const pending = deferred();
    const { auth, calls, changes } = manager([
      { stdout: '1.0' },
      {
        stdout: status('ready', { status: 'ready', openId: 'ou_1', name: '袁' }),
        wait: pending.promise,
      },
    ]);

    const first = auth.check();
    const second = auth.check();

    expect(second).toBe(first);
    await vi.waitFor(() => expect(calls).toHaveLength(2));
    expect(calls.map((call) => call.args)).toEqual([
      ['--version'],
      ['auth', 'status', '--json', '--verify'],
    ]);
    expect(changes).toEqual([]);

    pending.resolve();
    const [firstSnapshot, secondSnapshot] = await Promise.all([first, second]);

    expect(secondSnapshot).toBe(firstSnapshot);
    expect(calls).toHaveLength(2);
    expect(changes).toEqual([firstSnapshot]);
  });
});
