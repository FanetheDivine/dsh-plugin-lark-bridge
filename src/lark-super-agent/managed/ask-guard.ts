/**
 * 被管理会话的提问直接返回 S，要求会话用 send_report 上报。
 * 结束已在等待的提问时，为下一步排队 S。
 */
import type {
  PostToolDecision,
  PreToolDecision,
  ToolExecutionResult,
} from '@deepseek-ai/dsh-tools';

import { TASK_RULES_TEXT } from './task-rules.ts';

/** 被拦截的工具名。 */
export const ASK_TOOL = 'ask_user_question';

/** 结束等待中的提问时使用的错误。 */
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

/** 被管理会话提问的拦截与旧等待的取消。 */
export class AskGuard {
  private readonly options: AskGuardOptions;
  /** 会话到正在等待的提问中止控制器。 */
  private readonly waiting = new Map<string, Map<ExecuteLike, AbortController>>();
  /** 由插件中止的调用，用于把结果改写为统一反馈。 */
  private readonly aborted = new WeakSet<ExecuteLike>();
  /** 以 S 作答的调用，用于把结果内容固定为 S。 */
  private readonly answered = new WeakSet<ExecuteLike>();
  /** 需要在下一次模型请求前收到 S 的会话。 */
  private readonly pendingRules = new Set<string>();

  constructor(options: AskGuardOptions) {
    this.options = options;
  }

  /** 取走一次「需要 S」的标记。 */
  takeRules(sessionId: string): boolean {
    return this.pendingRules.delete(sessionId);
  }

  /** 结束该会话等待中的提问；确实结束过时排队 S。 */
  cancel(sessionId: string): void {
    if (sessionId === '') return;
    const aborted = this.abortWaiting(sessionId);
    const cancelled = this.cancelGateway(sessionId);
    if (aborted || cancelled) this.pendingRules.add(sessionId);
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

  /** 被管理会话的提问放行给环绕钩子作答，不进入审批等待；他方已拒绝或取消时保持原决定。 */
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
    return { kind: 'allow' };
  }

  /** 被管理会话的提问以 S 作答；其他会话的提问换上可中止信号，开始被管理时可以结束等待。 */
  async aroundExecute(
    exec: DispatchExecutionLike,
    next: () => Promise<ToolExecutionResult>,
  ): Promise<ToolExecutionResult> {
    if (exec.name !== ASK_TOOL) return next();
    const sessionId = exec.agent?.session?.id;
    if (sessionId === undefined || sessionId === '') return next();
    if (await this.options.isManaged(sessionId)) {
      this.pendingRules.delete(sessionId);
      this.answered.add(exec);
      return {
        isError: false,
        value: { answers: [] },
        content: [{ type: 'text', text: TASK_RULES_TEXT }],
      };
    }

    const controller = new AbortController();
    const calls = this.waiting.get(sessionId) ?? new Map<ExecuteLike, AbortController>();
    calls.set(exec, controller);
    this.waiting.set(sessionId, calls);
    const original = exec.signal;
    exec.signal = AbortSignal.any([original, controller.signal]);
    try {
      return await next();
    } finally {
      calls.delete(exec);
      if (calls.size === 0) this.waiting.delete(sessionId);
      exec.signal = original;
    }
  }

  /** 以 S 作答的调用固定结果内容；插件中止的调用改写为统一反馈。 */
  afterExecute(
    exec: ExecuteLike,
    result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> {
    if (exec.name !== ASK_TOOL) return next();
    // 宿主先用工具定义渲染成功结果，再执行此钩子。
    if (this.answered.delete(exec) && !result.isError) {
      return Promise.resolve({
        kind: 'accept',
        content: [{ type: 'text', text: TASK_RULES_TEXT }],
      });
    }
    if (!this.aborted.delete(exec)) return next();
    return Promise.resolve({
      kind: 'block',
      feedback: [{ type: 'text', text: ASK_BLOCKED_ERROR }],
    });
  }

  /** 中止该会话正在等待的提问；返回是否中止了调用。 */
  private abortWaiting(sessionId: string): boolean {
    const calls = this.waiting.get(sessionId);
    if (calls === undefined) return false;
    for (const [exec, controller] of calls) {
      this.aborted.add(exec);
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
  readonly agent?: { session?: { id?: string } };
}

interface DispatchExecutionLike extends ExecuteLike {
  signal: AbortSignal;
}
