/**
 * lark-cli 连接状态机：独立探测 CLI、bot 身份与用户身份。
 * 导出 AuthSnapshot 与 AuthManager。
 */
import { CliError, type LarkCli } from './cli.ts';
import type { ConnectionState } from './types.ts';
import { describeError } from './utils.ts';

/** 一次完整检测的结果。 */
export interface AuthSnapshot {
  readonly cli: ConnectionState;
  readonly bot: ConnectionState;
  readonly user: ConnectionState;
  readonly ready: boolean;
  readonly checkedAt: number;
  readonly appId: string | undefined;
  readonly userName: string | undefined;
  readonly ownerOpenId: string | undefined;
  readonly detail: string | undefined;
}

/** 只使用一次的日志接口。 */
export interface AuthLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** AuthManager 的依赖。 */
export interface AuthDeps {
  /** 本机 CLI 实例。 */
  getCli: () => LarkCli;
  readonly logger: AuthLogger;
  /** 状态变化通知。 */
  readonly onChange?: (snapshot: AuthSnapshot) => void;
}

/** 把未知值收窄为对象。 */
function recordOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}

/** 读取 auth status 的身份信息。 */
function statusIdentities(value: unknown): {
  appId: string | undefined;
  bot: string | undefined;
  user: { openId: string | undefined; name: string | undefined };
} {
  const root = recordOf(value);
  const identities = recordOf(root['identities']);
  const bot = recordOf(identities['bot']);
  const user = recordOf(identities['user']);
  return {
    appId: typeof root['appId'] === 'string' ? root['appId'] : undefined,
    bot: typeof bot['status'] === 'string' ? bot['status'] : undefined,
    user: {
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

/** 构造检测完成后的基础快照。 */
function disconnected(checkedAt: number): AuthSnapshot {
  return {
    cli: 'disconnected',
    bot: 'disconnected',
    user: 'disconnected',
    ready: false,
    checkedAt,
    appId: undefined,
    userName: undefined,
    ownerOpenId: undefined,
    detail: undefined,
  };
}

/** 完整检测与状态发布。 */
export class AuthManager {
  private readonly deps: AuthDeps;
  private snapshot: AuthSnapshot;
  private checking: Promise<AuthSnapshot> | undefined;

  constructor(deps: AuthDeps) {
    this.deps = deps;
    this.snapshot = {
      ...disconnected(0),
      cli: 'checking',
      bot: 'checking',
      user: 'checking',
    };
  }

  /** 最近一次检测结果。 */
  get current(): AuthSnapshot {
    return this.snapshot;
  }

  /** 完整检测；并发调用共享同一次检查。 */
  check(): Promise<AuthSnapshot> {
    if (this.checking !== undefined) return this.checking;
    this.checking = this.runCheck().finally(() => {
      this.checking = undefined;
    });
    return this.checking;
  }

  private async runCheck(): Promise<AuthSnapshot> {
    const cli = this.deps.getCli();
    const base = disconnected(Date.now());
    let next: AuthSnapshot;
    if (!(await probeCli(cli))) {
      next = base;
    } else {
      try {
        const status = await cli.json(['auth', 'status', '--json', '--verify'], {
          timeoutMs: 60_000,
        });
        const identities = statusIdentities(status);
        const owner = identities.user.openId;
        const botReady = identities.bot === 'ready';
        const userReady = owner !== undefined && owner !== '';
        const ready = botReady && userReady;
        next = {
          ...base,
          cli: 'connected',
          bot: botReady ? 'connected' : 'disconnected',
          user: userReady ? 'connected' : 'disconnected',
          ready,
          appId: identities.appId,
          userName: identities.user.name,
          ownerOpenId: ready ? owner : undefined,
        };
      } catch (error) {
        next = {
          ...base,
          cli: 'connected',
          detail: describeError(error),
        };
      }
    }
    this.publish(next);
    return next;
  }

  /** 更新快照并通知订阅者。 */
  private publish(next: AuthSnapshot): void {
    this.snapshot = next;
    this.deps.onChange?.(next);
  }
}
