/**
 * 离开期间拦截被管理会话的 ask_user_question：
 * 拒绝新调用、中止正在等待的调用，并取消插件加载前就已在等待的请求。
 * 导出 ASK_TOOL、AWAY_ERROR 与 AskGuard。
 */
import type {
  PostToolDecision,
  PreToolDecision,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools';

import type { PresenceStore } from '../presence.ts';

/** 被拦截的工具名。 */
export const ASK_TOOL = 'ask_user_question';

/** 用户离开时提问返回的错误。 */
export const AWAY_ERROR =
  'The user is away from the computer and cannot answer ask_user_question right now. Call send_report with kind question instead.';

/** 宿主网关中等待中的远端事件。 */
interface PendingRemoteEvent {
  readonly frame?: { readonly event?: unknown; readonly agentId?: unknown };
}

/** 宿主网关的最小结构与私有成员。 */
export interface GatewayLike {
  pendingRemoteEvents?: unknown;
  cancelRemoteEvent?(pending: PendingRemoteEvent, reason: unknown): unknown;
}

export interface AskGuardOptions {
  readonly presence: PresenceStore;
  /** 判断会话是否被管理。 */
  readonly isManaged: (sessionId: string) => Promise<boolean>;
  /** 读取宿主网关；不可用时返回 undefined。 */
  readonly gateway: () => GatewayLike | undefined;
  readonly logger: {
    warn?(...args: unknown[]): void;
  };
}

/** 离开期间对等待中提问的拦截。 */
export class AskGuard {
  private readonly options: AskGuardOptions;
  /** 会话到正在等待的提问中止控制器。 */
  private readonly waiting = new Map<string, Map<string, AbortController>>();
  /** 由插件中止的调用，用于把结果改写为离开错误。 */
  private readonly aborted = new Set<string>();
  /** 需要在下一次模型请求前收到 S 的会话。 */
  private readonly pendingRules = new Set<string>();

  constructor(options: AskGuardOptions) {
    this.options = options;
  }

  /** 订阅在场状态；切为离开时中止等待中的提问。 */
  start(): () => void {
    return this.options.presence.subscribe((snapshot) => {
      if (snapshot.presence !== 'remote') return;
      void this.interruptAll();
    });
  }

  /** 取走一次「需要 S」的标记。 */
  takeRules(sessionId: string): boolean {
    return this.pendingRules.delete(sessionId);
  }

  /** 在拒绝或中止一次提问后记下需要 S。 */
  private requireRules(sessionId: string): void {
    this.pendingRules.add(sessionId);
  }

  /** 中止全部等待中的提问，并取消网关中残留的请求。 */
  async interruptAll(): Promise<void> {
    for (const [sessionId, calls] of [...this.waiting]) {
      for (const [callId, controller] of calls) {
        this.aborted.add(callId);
        controller.abort();
      }
      this.requireRules(sessionId);
      this.cancelPending(sessionId);
    }
  }

  /** 取消宿主网关中该会话等待中的提问请求。 */
  cancelPending(sessionId: string): void {
    const gateway = this.options.gateway();
    const pendings = gateway?.pendingRemoteEvents;
    const cancel = gateway?.cancelRemoteEvent;
    if (!(pendings instanceof Map) || typeof cancel !== 'function') {
      this.options.logger.warn?.(
        'lark-super-agent: the host gateway cannot cancel a waiting question; it keeps waiting',
        { sessionId },
      );
      return;
    }
    for (const pending of [...(pendings as Map<unknown, PendingRemoteEvent>).values()]) {
      if (pending?.frame?.event !== 'user-questions/request') continue;
      if (pending.frame.agentId !== sessionId) continue;
      try {
        cancel.call(gateway, pending, new Error(AWAY_ERROR));
        this.requireRules(sessionId);
      } catch (error) {
        this.options.logger.warn?.('lark-super-agent: gateway cancel failed', error);
      }
    }
  }

  /** 离开期间拒绝被管理会话的新提问。 */
  async beforeExecute(
    exec: ExecuteLike,
    next: () => Promise<PreToolDecision>,
  ): Promise<PreToolDecision> {
    const decision = await next();
    if (exec.name !== ASK_TOOL || decision.kind !== 'allow') return decision;
    const sessionId = exec.agent?.session?.id;
    if (sessionId === undefined || sessionId === '') return decision;
    if (this.options.presence.get().presence !== 'remote') return decision;
    if (!(await this.options.isManaged(sessionId))) return decision;
    this.requireRules(sessionId);
    return { kind: 'deny', reason: AWAY_ERROR };
  }

  /** 给等待中的被管理会话提问装上可由插件中止的信号。 */
  async aroundExecute(
    exec: DispatchExecutionLike,
    next: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> {
    if (exec.name !== ASK_TOOL) return next();
    const sessionId = exec.agent?.session?.id;
    if (sessionId === undefined || sessionId === '') return next();
    if (this.options.presence.get().presence === 'remote') {
      if (await this.options.isManaged(sessionId)) {
        this.requireRules(sessionId);
        this.cancelPending(sessionId);
        return {
          isError: true,
          error: { code: 'ASK_ABORTED', message: AWAY_ERROR },
          content: [{ type: 'text', text: AWAY_ERROR }],
        } as ToolExecutionResult;
      }
      return next();
    }
    if (!(await this.options.isManaged(sessionId))) return next();

    const controller = new AbortController();
    const calls = this.waiting.get(sessionId) ?? new Map<string, AbortController>();
    calls.set(String(exec.callId), controller);
    this.waiting.set(sessionId, calls);
    const original = exec.signal;
    exec.signal = AbortSignal.any([original, controller.signal]);
    try {
      return await next();
    } finally {
      calls.delete(String(exec.callId));
      if (calls.size === 0) this.waiting.delete(sessionId);
      exec.signal = original;
    }
  }

  /** 把插件中止的提问结果改写为离开错误。 */
  afterExecute(
    exec: ExecuteLike,
    _result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> {
    if (exec.name !== ASK_TOOL || !this.aborted.delete(String(exec.callId))) return next();
    return Promise.resolve({
      kind: 'block',
      feedback: [{ type: 'text', text: AWAY_ERROR }],
    });
  }
}

interface ExecuteLike {
  readonly name: string;
  readonly callId: unknown;
  readonly agent?: { session?: { id?: string } };
}

interface DispatchExecutionLike extends ExecuteLike {
  signal: AbortSignal;
}
