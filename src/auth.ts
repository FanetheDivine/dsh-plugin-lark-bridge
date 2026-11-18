/**
 * lark-cli 鉴权状态机：探测 CLI、bot 身份与用户授权。
 * 导出 AuthStage、AuthSnapshot、AuthManager 与 LoginFlow。
 */
import { CliError, type LarkCli } from './cli.ts';
import { DEFAULT_LOGIN_SCOPE } from './constants.ts';
import { describeError } from './utils.ts';

/** 鉴权阶段，按依赖顺序排列。 */
export type AuthStage = 'cli-missing' | 'bot-unavailable' | 'user-missing' | 'ready';

/** 一次鉴权检测的结果。 */
export interface AuthSnapshot {
  readonly stage: AuthStage;
  readonly ready: boolean;
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
    const cli = this.deps.getCli();
    const base: AuthSnapshot = {
      stage: 'cli-missing',
      ready: false,
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
      try {
        const status = await cli.json(
          ['auth', 'status', '--json', ...(options.verify === true ? ['--verify'] : [])],
          { timeoutMs: 60_000 },
        );
        const identities = statusIdentities(status);
        const owner = identities.user.openId;
        if (identities.bot !== 'ready') {
          next = { ...base, stage: 'bot-unavailable', appId: identities.appId };
        } else if (owner === undefined || owner === '') {
          next = {
            ...base,
            stage: 'user-missing',
            appId: identities.appId,
            botStatus: identities.bot,
            userName: identities.user.name,
          };
        } else {
          next = {
            ...base,
            stage: 'ready',
            ready: true,
            appId: identities.appId,
            botStatus: identities.bot,
            userName: identities.user.name,
            ownerOpenId: owner,
          };
        }
      } catch (error) {
        next = { ...base, stage: 'bot-unavailable', detail: describeError(error) };
      }
    }
    this.publish(next);
    return next;
  }

  /**
   * 启动设备码授权。
   * @returns 授权链接与设备码；完成后台轮询。
   */
  async startLogin(): Promise<LoginFlow> {
    const cli = this.deps.getCli();
    const scope = this.deps.loginScope ?? DEFAULT_LOGIN_SCOPE;
    const value = await cli.json(['auth', 'login', '--no-wait', '--json', '--scope', scope], {
      timeoutMs: 60_000,
    });
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
      await cli.run(['auth', 'login', '--device-code', flow.deviceCode, '--json'], {
        timeoutMs: remaining,
      });
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
