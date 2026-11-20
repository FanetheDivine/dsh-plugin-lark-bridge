// 鉴权状态机测试：四阶段检测、设备码授权与取消。
import { describe, expect, it, vi } from 'vitest';

import { AuthManager } from '../src/auth.ts';
import { CliError, LarkCli } from '../src/cli.ts';

/** 一条运行器结果。 */
interface Step {
  readonly stdout?: string;
  readonly stderr?: string;
  readonly code?: number;
  readonly throws?: string;
}

/** 按顺序返回结果的假运行器。 */
function runner(steps: Step[]) {
  const calls: Array<{ args: readonly string[]; input?: string }> = [];
  const run = async (_command: unknown, args: readonly string[], options: { input?: string }) => {
    calls.push({ args, ...(options.input === undefined ? {} : { input: options.input }) });
    const step = steps.shift() ?? {};
    if (step.throws !== undefined) throw new CliError('spawn-failed', step.throws);
    return { stdout: step.stdout ?? '', stderr: step.stderr ?? '', code: step.code ?? 0 };
  };
  return { run, calls };
}

/** 构造管理器。 */
function manager(steps: Step[]) {
  const fake = runner(steps);
  const cli = new LarkCli(fake.run);
  const changes: string[] = [];
  const logger = { info: vi.fn(), warn: vi.fn() };
  const auth = new AuthManager({
    getCli: () => cli,
    logger,
    onChange: (snapshot) => changes.push(snapshot.stage),
  });
  return { auth, calls: fake.calls, changes, logger };
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

describe('AuthManager.check', () => {
  it('CLI 启动失败时为 cli-missing', async () => {
    const { auth } = manager([{ throws: 'ENOENT' }]);
    const snapshot = await auth.check();
    expect(snapshot.stage).toBe('cli-missing');
    expect(snapshot.ready).toBe(false);
  });

  it('lark-cli 没有可用配置时为 bot-unavailable，并带上失败原因', async () => {
    const { auth, calls } = manager([{ stdout: '1.0' }, { code: 1, stderr: 'not configured' }]);
    const snapshot = await auth.check();
    expect(snapshot.stage).toBe('bot-unavailable');
    expect(snapshot.detail).toContain('not configured');
    expect(calls[1]?.args).toEqual(['auth', 'status', '--json']);
  });

  it('bot 未就绪时为 bot-unavailable', async () => {
    const { auth } = manager([{ stdout: '1.0' }, { stdout: status('missing') }]);
    const snapshot = await auth.check();
    expect(snapshot.stage).toBe('bot-unavailable');
  });

  it('bot 就绪但没有用户时为 user-missing', async () => {
    const { auth } = manager([
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'missing' }) },
    ]);
    expect((await auth.check()).stage).toBe('user-missing');
  });

  it('bot 与用户都就绪时为 ready，并记录用户', async () => {
    const { auth, changes } = manager([
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'ready', openId: 'ou_1', name: '袁' }) },
    ]);
    const snapshot = await auth.check();
    expect(snapshot).toMatchObject({
      stage: 'ready',
      ready: true,
      ownerOpenId: 'ou_1',
      userName: '袁',
    });
    expect(changes).toEqual(['ready']);
  });

  it('显式 verify 追加 --verify', async () => {
    const { auth, calls } = manager([
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'ready', openId: 'ou_1' }) },
    ]);
    await auth.check({ verify: true });
    expect(calls[1]?.args).toContain('--verify');
  });
});

describe('AuthManager.startLogin', () => {
  it('解析授权链接并在后台完成设备码', async () => {
    const { auth, calls } = manager([
      {
        stdout: JSON.stringify({
          device_code: 'dev-1',
          expires_in: 600,
          verification_url: 'https://example.com/verify',
        }),
      },
      { stdout: '{"ok":true}' },
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'ready', openId: 'ou_1' }) },
      { stdout: '1.0' },
      { stdout: status('ready', { status: 'ready', openId: 'ou_1' }) },
    ]);
    const flow = await auth.startLogin();
    expect(calls[0]?.args).toEqual([
      'auth',
      'login',
      '--no-wait',
      '--json',
      '--scope',
      'auth:user.id:read',
    ]);
    expect(flow.verificationUrl).toBe('https://example.com/verify');
    expect(auth.pendingLogin?.deviceCode).toBe('dev-1');
    const snapshot = await auth.whenLoginSettled();
    expect(calls[1]?.args).toEqual(['auth', 'login', '--device-code', 'dev-1', '--json']);
    expect(snapshot?.ready).toBe(true);
    expect(auth.pendingLogin).toBeUndefined();
  });

  it('取消后丢弃后台结果', async () => {
    const { auth } = manager([
      {
        stdout: JSON.stringify({
          device_code: 'dev-1',
          expires_in: 600,
          verification_url: 'https://example.com/verify',
        }),
      },
      { code: 1, stderr: 'cancelled' },
    ]);
    await auth.startLogin();
    auth.cancelLogin();
    await auth.whenLoginSettled();
    expect(auth.pendingLogin).toBeUndefined();
  });
});
