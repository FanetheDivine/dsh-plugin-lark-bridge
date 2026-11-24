/**
 * 全局在场状态：内存中唯一的用户位置，按手动切换与消息来源更新。
 * 导出 UserPresence、PresenceSnapshot、PresenceStore。
 */
import type { UserMessage } from '@deepseek-ai/dsh-llm';

/** 用户状态：local 表示在电脑旁，remote 表示离开。 */
export type UserPresence = 'local' | 'remote';

/** 状态快照。 */
export interface PresenceSnapshot {
  readonly presence: UserPresence;
  readonly updatedAt: number;
}

/** 两个自动更新开关的实时取值。 */
export interface PresenceSwitches {
  readonly guiInputSetsLocal: boolean;
  readonly larkInputSetsRemote: boolean;
}

/** 状态仓库的依赖。 */
export interface PresenceStoreOptions {
  /** 读取开关的实时值。 */
  readonly switches: () => PresenceSwitches;
  readonly now?: () => number;
}

/** 判断取值是否为合法状态。 */
export function isUserPresence(value: unknown): value is UserPresence {
  return value === 'local' || value === 'remote';
}

/** 读取一条消息按开关判定的目标状态；不可判定或开关关闭时返回 undefined。 */
function presenceOf(message: UserMessage, switches: PresenceSwitches): UserPresence | undefined {
  const source = message.source as { kind?: string; reminder?: boolean } | undefined;
  if (source?.kind === 'user') return switches.guiInputSetsLocal ? 'local' : undefined;
  if (source?.kind === 'lark-bridge' && source.reminder !== true) {
    return switches.larkInputSetsRemote ? 'remote' : undefined;
  }
  return undefined;
}

/** 内存中的全局在场状态；初始为在电脑旁。 */
export class PresenceStore {
  private readonly options: PresenceStoreOptions;
  private snapshot: PresenceSnapshot;
  private readonly observed = new WeakSet<object>();
  private readonly listeners = new Set<(snapshot: PresenceSnapshot) => void>();

  constructor(options: PresenceStoreOptions) {
    this.options = options;
    this.snapshot = { presence: 'local', updatedAt: this.now() };
  }

  /** 当前快照。 */
  get(): PresenceSnapshot {
    return this.snapshot;
  }

  /** 手动切换到目标状态。 */
  set(presence: UserPresence): PresenceSnapshot {
    this.snapshot = { presence, updatedAt: this.now() };
    for (const listener of this.listeners) listener(this.snapshot);
    return this.snapshot;
  }

  /**
   * 按本批消息自动更新。
   * 同一消息对象只生效一次；同批以最后一条可判定消息为准。
   */
  observe(messages: readonly UserMessage[]): PresenceSnapshot {
    const switches = this.options.switches();
    let target: UserPresence | undefined;
    for (const message of messages) {
      if (this.observed.has(message)) continue;
      this.observed.add(message);
      const presence = presenceOf(message, switches);
      if (presence !== undefined) target = presence;
    }
    if (target === undefined || target === this.snapshot.presence) return this.snapshot;
    return this.set(target);
  }

  /** 订阅状态变化。 */
  subscribe(listener: (snapshot: PresenceSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}
