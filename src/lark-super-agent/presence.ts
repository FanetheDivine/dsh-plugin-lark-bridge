/**
 * 全局在场状态：内存中唯一的用户位置，按手动切换与消息来源更新，并生成两个预设共用的在场提醒。
 * 导出 UserPresence、PresenceSnapshot、PresenceStore、PRESENCE_SOURCE_KIND 与 latestPresenceReminder。
 */
import { createUserMessage, type UserMessage } from '@deepseek-ai/dsh-llm';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'sa-presence': {
      kind: 'sa-presence';
      form: 'notice';
      presence: 'local' | 'remote';
    };
  }
}

/** 在场提醒的来源类型；识别提醒只看这个属性。 */
export const PRESENCE_SOURCE_KIND = 'sa-presence';

/** 两个预设共用的提醒正文，只陈述用户位置。 */
export const PRESENCE_REMINDER_TEXT = {
  local: `<system-reminder>
User presence: the user is at the computer and reads this session in the Web GUI.
</system-reminder>`,
  remote: `<system-reminder>
User presence: the user is away from the computer and reachable only through Lark.
</system-reminder>`,
} as const;

/** 读取会话表层所需的最小结构。 */
export interface PresenceSessionLike {
  readonly surface: { readonly nodes: Iterable<number> };
  eventAt(seq: number): { type: string; data?: unknown } | undefined;
}

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

/**
 * 会话表层最近一条在场提醒所记的状态；只读 `source.kind` 与 `source.presence`。
 * 没有提醒或属性不合法时返回 undefined。
 */
export function latestPresenceReminder(session: PresenceSessionLike): UserPresence | undefined {
  const nodes = [...session.surface.nodes];
  for (let index = nodes.length - 1; index >= 0; index -= 1) {
    const seq = nodes[index];
    if (seq === undefined) continue;
    const event = session.eventAt(seq);
    if (event?.type !== 'user/message') continue;
    const source = (event.data as { source?: { kind?: unknown; presence?: unknown } } | undefined)
      ?.source;
    if (source?.kind !== PRESENCE_SOURCE_KIND) continue;
    return isUserPresence(source.presence) ? source.presence : undefined;
  }
  return undefined;
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

  /**
   * 观察本批消息后，为会话生成需要插入的在场提醒。
   * 表层最近一条提醒与当前状态一致时返回 undefined。
   */
  reminderFor(
    session: PresenceSessionLike,
    messages: readonly UserMessage[],
  ): UserMessage | undefined {
    const { presence } = this.observe(messages);
    if (latestPresenceReminder(session) === presence) return undefined;
    return createUserMessage({
      content: [{ type: 'text', text: PRESENCE_REMINDER_TEXT[presence] }],
      source: { kind: PRESENCE_SOURCE_KIND, form: 'notice', presence },
    });
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
