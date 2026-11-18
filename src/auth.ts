/**
 * lark-cli 鉴权状态机：探测 CLI、专用档案、bot 身份与用户授权。
 * 导出 AuthStage、AuthSnapshot、AuthManager 与 LoginFlow。
 */
import { CliError, type LarkCli } from './cli.ts';
import type { PluginConfig } from './config.ts';
import { DEFAULT_LOGIN_SCOPE } from './constants.ts';
import { describeError } from './utils.ts';

/** 鉴权阶段，按依赖顺序排列。 */
export type AuthStage =
  | 'cli-missing'
  | 'app-missing'
  | 'bot-unavailable'
  | 'user-missing'
  | 'ready';

/** 一次鉴权检测的结果。 */
export interface AuthSnapshot {
  readonly stage: AuthStage;
  readonly ready: boolean;
  readonly profile: string;
  readonly appId: string | undefined;
  readonly botStatus: string | undefined;
  readonly userName: string | undefined;
  readonly ownerOpenId: string | undefined;
  readonly checkedAt: number;
  readonly detail: string | undefined;
}

/** 已启动的设备码授权。 */
export interface LoginFlow {
  readonly verificationUrl: string;
  readonly deviceCode: string;
  readonly expiresAt: number;
}

/** 只使用一次的日志接口。 */
export interface AuthLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** AuthManager 的依赖。 */
export interface AuthDeps {
  /** 读取当前配置。 */
  readonly getConfig: () => Readonly<PluginConfig>;
  /** 受配置控制的 CLI 实例；配置热重载时可替换。 */
  getCli: () => LarkCli;
  readonly logger: AuthLogger;
  /** 状态变化通知。 */
  readonly onChange?: (snapshot: AuthSnapshot) => void;
  /** 覆盖默认登录 scope。 */
  readonly loginScope?: string;
}

/** 把未知值收窄为对象。 */
function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** 从 profile list 输出中找出目标档案。 */
function findProfile(value: unknown, name: string): Record<string, unknown> | undefined {
  const list = Array.isArray(value)
    ? value
    : Array.isArray(recordOf(value)['profiles'])
      ? (recordOf(value)['profiles'] as unknown[])
      : [];
  return list.map(recordOf).find((item) => item['name'] === name);
}

/** 读取设备码输出。 */
function parseLoginFlow(value: unknown): LoginFlow {
  const record = recordOf(value);
  const url = record['verification_url'];
  const code = record['device_code'];
  const expires = Number(record['expires_in']);
  if (typeof url !== 'string' || url === '') {
    throw new CliError('invalid-login', 'lark-cli did not return a verification URL');
  }
  if (typeof code !== 'string' || code === '') {
    throw new CliError('invalid-login', 'lark-cli did not return a device code');
  }
  return {
    verificationUrl: url,
    deviceCode: code,
    expiresAt: Date.now() + (Number.isFinite(expires) && expires > 0 ? expires : 600) * 1000,
  };
}

/** 读取 auth status 的身份信息。 */
function statusIdentities(value: unknown): {
  appId: string | undefined;
  bot: string | undefined;
  user: { status: string | undefined; openId: string | undefined; name: string | undefined };
} {
  const root = recordOf(value);
  const identities = recordOf(root['identities']);
  const bot = recordOf(identities['bot']);
  const user = recordOf(identities['user']);
  return {
    appId: typeof root['appId'] === 'string' ? root['appId'] : undefined,
    bot: typeof bot['status'] === 'string' ? bot['status'] : undefined,
    user: {
      status: typeof user['status'] === 'string' ? user['status'] : undefined,
      openId: typeof user['openId'] === 'string' ? user['openId'] : undefined,
      name: typeof user['userName'] === 'string' ? user['userName'] : undefined,
    },
  };
}

/** 判断 CLI 是否可执行。 */
async function probeCli(cli: LarkCli): Promise<boolean> {
  try {
    await cli.run(['--version'], { timeoutMs: 60_000, allowFailure: true });
    return true;
  } catch (error) {
    if (error instanceof CliError && error.code === 'spawn-failed') return false;
    return true;
  }
}

/** 鉴权检查与授权动作。 */
export class AuthManager {
  private readonly deps: AuthDeps;
  private snapshot: AuthSnapshot;
  private checking: Promise<AuthSnapshot> | undefined;
  private flow: LoginFlow | undefined;
  private completing: Promise<AuthSnapshot> | undefined;
  private cancelled = 0;

  constructor(deps: AuthDeps) {
    this.deps = deps;
    this.snapshot = {
      stage: 'cli-missing',
      ready: false,
      profile: deps.getConfig().profile,
      appId: undefined,
      botStatus: undefined,
      userName: undefined,
      ownerOpenId: undefined,
      checkedAt: 0,
      detail: undefined,
    };
  }

  /** 最近一次检测结果。 */
  get current(): AuthSnapshot {
    return this.snapshot;
  }

  /** 当前已启动的授权流程。 */
  get pendingLogin(): LoginFlow | undefined {
    return this.flow;
  }

  /** 重新检测；并发调用共享同一次检查。 */
  check(options: { verify?: boolean } = {}): Promise<AuthSnapshot> {
    if (this.checking !== undefined) return this.checking;
    this.checking = this.runCheck(options).finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  }

  private async runCheck(options: { verify?: boolean }): Promise<AuthSnapshot> {
    const config = this.deps.getConfig();
    const cli = this.deps.getCli();
    const base: AuthSnapshot = {
      stage: 'cli-missing',
      ready: false,
      profile: config.profile,
      appId: undefined,
      botStatus: undefined,
      userName: undefined,
      ownerOpenId: undefined,
      checkedAt: Date.now(),
      detail: undefined,
    };
    let next: AuthSnapshot;
    if (!(await probeCli(cli))) {
      next = base;
    } else {
      let profiles: unknown;
      try {
        profiles = await cli.json(['profile', 'list'], { timeoutMs: 30_000 });
      } catch (error) {
        next = { ...base, detail: describeError(error) };
        this.publish(next);
        return next;
      }
      if (findProfile(profiles, config.profile) === undefined) {
        next = { ...base, stage: 'app-missing' };
      } else {
        try {
          const status = await cli.json(
            [
              '--profile',
              config.profile,
              'auth',
              'status',
              '--json',
              ...(options.verify === true ? ['--verify'] : []),
            ],
            { timeoutMs: 60_000 },
          );
          const identities = statusIdentities(status);
          const owner = config.ownerOpenId !== '' ? config.ownerOpenId : identities.user?.openId;
          if (identities.bot !== 'ready') {
            next = { ...base, stage: 'bot-unavailable', appId: identities.appId };
          } else if (owner === undefined || owner === '') {
            next = {
              ...base,
              stage: 'user-missing',
              appId: identities.appId,
              botStatus: identities.bot,
              userName: identities.user?.name,
              detail: undefined,
            };
          } else {
            next = {
              stage: 'ready',
              ready: true,
              profile: config.profile,
              appId: identities.appId,
              botStatus: identities.bot,
              userName: identities.user?.name,
              ownerOpenId: owner,
              checkedAt: Date.now(),
              detail: undefined,
            };
          }
        } catch (error) {
          next = { ...base, stage: 'bot-unavailable', detail: describeError(error) };
        }
      }
    }
    this.publish(next);
    return next;
  }

  /**
   * 用 App ID 与 App Secret 创建或更新专用档案。
   * Secret 只写入子进程 stdin，不进入日志或配置。
   */
  async bindApp(appId: string, appSecret: string): Promise<AuthSnapshot> {
    const config = this.deps.getConfig();
    const cli = this.deps.getCli();
    const id = appId.trim();
    const secret = appSecret.trim();
    if (!/^cli_[A-Za-z0-9]+$/.test(id)) {
      throw new CliError('invalid-app-id', 'App ID 应以 cli_ 开头');
    }
    if (secret === '') throw new CliError('invalid-app-secret', 'App Secret 不能为空');
    const input = `${secret}\n`;
    const add = [
      'profile',
      'add',
      '--name',
      config.profile,
      '--app-id',
      id,
      '--app-secret-stdin',
      '--brand',
      'feishu',
    ];
    try {
      await cli.run(add, { input, timeoutMs: 120_000 });
    } catch (error) {
      const text = describeError(error);
      if (!/exist|duplicate|already/i.test(text)) throw error;
      this.deps.logger.warn(`lark-bridge: replacing existing profile "${config.profile}"`);
      await cli.run(['profile', 'remove', config.profile], { timeoutMs: 30_000 });
      await cli.run(add, { input, timeoutMs: 120_000 });
    }
    return this.check({ verify: true });
  }

  /**
   * 启动设备码授权。
   * @returns 授权链接与设备码；完成后台轮询。
   */
  async startLogin(): Promise<LoginFlow> {
    const config = this.deps.getConfig();
    const cli = this.deps.getCli();
    const scope = this.deps.loginScope ?? DEFAULT_LOGIN_SCOPE;
    const value = await cli.json(
      ['--profile', config.profile, 'auth', 'login', '--no-wait', '--json', '--scope', scope],
      { timeoutMs: 60_000 },
    );
    const flow = parseLoginFlow(value);
    this.flow = flow;
    this.cancelled += 1;
    const generation = this.cancelled;
    this.deps.logger.info(
      `lark-bridge: device login started, expires at ${new Date(flow.expiresAt).toISOString()}`,
    );
    this.completing = this.completeLogin(flow, generation);
    return flow;
  }

  /** 后台完成设备码授权；失败时记录并刷新状态。 */
  private async completeLogin(flow: LoginFlow, generation: number): Promise<AuthSnapshot> {
    const cli = this.deps.getCli();
    const remaining = Math.max(30_000, flow.expiresAt - Date.now() + 15_000);
    try {
      await cli.run(
        [
          '--profile',
          this.deps.getConfig().profile,
          'auth',
          'login',
          '--device-code',
          flow.deviceCode,
          '--json',
        ],
        { timeoutMs: remaining },
      );
      if (generation !== this.cancelled) return this.snapshot;
      this.flow = undefined;
      return await this.check({ verify: true });
    } catch (error) {
      if (generation !== this.cancelled) return this.snapshot;
      this.flow = undefined;
      this.deps.logger.warn(`lark-bridge: device login failed: ${describeError(error)}`);
      return this.check();
    }
  }

  /** 等待后台授权结束；测试与关闭流程使用。 */
  async whenLoginSettled(): Promise<AuthSnapshot | undefined> {
    return this.completing === undefined ? undefined : this.completing;
  }

  /** 取消当前授权；后台轮询的结果会被丢弃。 */
  cancelLogin(): void {
    this.cancelled += 1;
    this.flow = undefined;
  }

  /** 更新快照并通知订阅者。 */
  private publish(next: AuthSnapshot): void {
    this.snapshot = next;
    this.deps.onChange?.(next);
  }
}
