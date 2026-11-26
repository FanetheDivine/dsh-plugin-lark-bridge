/**
 * 被管理会话的提问拦截：无条件拒绝 `ask_user_question`，结束已在等待的提问并排队 S。
 * 导出 ASK_TOOL、ASK_BLOCKED_ERROR、GatewayLike 与 AskGuard。
 */
import type {
  PostToolDecision,
  PreToolDecision,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools';

/** 被拦截的工具名。 */
export const ASK_TOOL = 'ask_user_question';

/** 被管理会话提问时返回的错误。 */
export const ASK_BLOCKED_ERROR =
  'This session is managed by the dispatch session and cannot ask the user directly. Call send_report with kind question instead.';

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
  /** 判断会话是否被管理。 */
  readonly isManaged: (sessionId: string) => Promise<boolean>;
  /** 读取宿主网关；不可用时返回 undefined。 */
  readonly gateway: () => GatewayLike | undefined;
  readonly logger: {
    warn?(...args: unknown[]): void;
  };
}

/** 被管理会话对等待中提问的拦截。 */
export class AskGuard {
  private readonly options: AskGuardOptions;
  /** 会话到正在等待的提问中止控制器。 */
  private readonly waiting = new Map<string, Map<string, AbortController>>();
  /** 由插件中止的调用，用于把结果改写为统一反馈。 */
  private readonly aborted = new Set<string>();
  /** 需要在下一次模型请求前收到 S 的会话。 */
  private readonly pendingRules = new Set<string>();

  constructor(options: AskGuardOptions) {
    this.options = options;
  }

  /** 取走一次「需要 S」的标记。 */
  takeRules(sessionId: string): boolean {
    return this.pendingRules.delete(sessionId);
  }

  /** 在拒绝或中止一次提问后记下需要 S。 */
  private requireRules(sessionId: string): void {
    this.pendingRules.add(sessionId);
  }

  /** 结束该会话等待中的提问；确实结束过时排队 S。 */
  cancel(sessionId: string): void {
    if (sessionId === '') return;
    const aborted = this.abortWaiting(sessionId);
    const cancelled = this.cancelGateway(sessionId);
    if (aborted || cancelled) this.requireRules(sessionId);
  }

  /** 扫描网关，取消被管理会话在插件加载前就开始等待的提问。 */
  async sweep(): Promise<void> {
    const pendings = this.pendings();
    if (pendings === undefined) {
      this.options.logger.warn?.(
        'lark-super-agent: the host gateway cannot cancel a waiting question; it keeps waiting',
      );
      return;
    }
    const sessions = new Set<string>();
    for (const pending of pendings.values()) {
      if (pending?.frame?.event !== 'user-questions/request') continue;
      const agentId = pending.frame.agentId;
      if (typeof agentId !== 'string' || agentId === '') continue;
      if (!(await this.options.isManaged(agentId))) continue;
      sessions.add(agentId);
    }
    for (const sessionId of sessions) this.cancel(sessionId);
  }

  /** 被管理会话的新提问一律拒绝；他方已拒绝或取消时保持原决定。 */
  async beforeExecute(
    exec: ExecuteLike,
    next: () => Promise<PreToolDecision>,
  ): Promise<PreToolDecision> {
    const decision = await next();
    if (exec.name !== ASK_TOOL) return decision;
    if (decision.kind === 'deny' || decision.kind === 'cancel') return decision;
    const sessionId = exec.agent?.session?.id;
    if (sessionId === undefined || sessionId === '') return decision;
    if (!(await this.options.isManaged(sessionId))) return decision;
    this.cancel(sessionId);
    this.requireRules(sessionId);
    return { kind: 'deny', reason: ASK_BLOCKED_ERROR };
  }

  /** 给等待中的提问装上可由插件中止的信号；会话中途被管理时据此结束等待。 */
  async aroundExecute(
    exec: DispatchExecutionLike,
    next: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> {
    if (exec.name !== ASK_TOOL) return next();
    const sessionId = exec.agent?.session?.id;
    if (sessionId === undefined || sessionId === '') return next();

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

  /** 把插件中止的提问结果改写为统一反馈。 */
  afterExecute(
    exec: ExecuteLike,
    _result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> {
    if (exec.name !== ASK_TOOL || !this.aborted.delete(String(exec.callId))) return next();
    return Promise.resolve({
      kind: 'block',
      feedback: [{ type: 'text', text: ASK_BLOCKED_ERROR }],
    });
  }

  /** 中止该会话正在等待的提问；返回是否中止了调用。 */
  private abortWaiting(sessionId: string): boolean {
    const calls = this.waiting.get(sessionId);
    if (calls === undefined) return false;
    for (const [callId, controller] of calls) {
      this.aborted.add(callId);
      controller.abort();
    }
    return true;
  }

  /** 取消网关中该会话等待中的提问请求；返回是否取消成功。 */
  private cancelGateway(sessionId: string): boolean {
    const gateway = this.options.gateway();
    const pendings = gateway?.pendingRemoteEvents;
    const cancel = gateway?.cancelRemoteEvent;
    if (!(pendings instanceof Map) || typeof cancel !== 'function') return false;
    let cancelled = false;
    for (const pending of [...(pendings as Map<unknown, PendingRemoteEvent>).values()]) {
      if (pending?.frame?.event !== 'user-questions/request') continue;
      if (pending.frame.agentId !== sessionId) continue;
      try {
        cancel.call(gateway, pending, new Error(ASK_BLOCKED_ERROR));
        cancelled = true;
      } catch (error) {
        this.options.logger.warn?.('lark-super-agent: gateway cancel failed', error);
      }
    }
    return cancelled;
  }

  /** 读取网关里的等待事件；网关缺失或结构不符时返回 undefined。 */
  private pendings(): Map<unknown, PendingRemoteEvent> | undefined {
    const pendings = this.options.gateway()?.pendingRemoteEvents;
    return pendings instanceof Map ? (pendings as Map<unknown, PendingRemoteEvent>) : undefined;
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
