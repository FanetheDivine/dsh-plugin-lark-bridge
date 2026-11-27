/**
 * 被管理会话的提问拦截：拒绝调用、记下问题并排队 S，让会话自行用 send_report 上报；
 * 轮次结束仍未上报时交出问题供补投。也负责结束已在等待的提问。
 * 导出 ASK_TOOL、ASK_BLOCKED_ERROR、questionReportText、GatewayLike 与 AskGuard。
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
  'The user did not see these questions: this session is managed by the dispatch session and cannot ask the user directly. Call send_report with kind question now, with the task goal, the current state, and each question with its options.';

/** 宿主网关中等待中的远端事件。 */
interface PendingRemoteEvent {
  readonly frame?: { readonly event?: unknown; readonly agentId?: unknown };
}

/** 宿主网关的最小结构与私有成员。 */
export interface GatewayLike {
  pendingRemoteEvents?: unknown;
  cancelRemoteEvent?(pending: PendingRemoteEvent, reason: unknown): unknown;
}

/** 判断值是否为纯对象。 */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 把一次调用的问题列表转成上报正文；异常输入回退为固定说明句。 */
export function questionReportText(questions: unknown): string {
  if (!Array.isArray(questions) || questions.length === 0) {
    return 'The task session needs your input to continue. Reply in the dispatch session or in Lark.';
  }
  const lines = ['The task session needs your input to continue:'];
  for (const [index, item] of questions.entries()) {
    const question = isRecord(item) ? item : {};
    const text = typeof question.question === 'string' ? question.question.trim() : '';
    const header = typeof question.header === 'string' ? question.header.trim() : '';
    lines.push(
      `- Q${index + 1}${header === '' ? '' : ` [${header}]`}: ${text === '' ? '(no question text)' : text}`,
    );
    if (Array.isArray(question.options) && question.options.length > 0) {
      const labels = question.options
        .map((option) =>
          isRecord(option) && typeof option.label === 'string' ? option.label.trim() : '',
        )
        .filter((label) => label !== '');
      if (labels.length > 0) lines.push(`  options: ${labels.join(' / ')}`);
    }
    if (question.multi_select === true) lines.push('  (multi-select)');
  }
  lines.push('Reply in the dispatch session or in Lark; the task resumes when you answer.');
  return lines.join('\n');
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

/** 会话级待处理提问：是否待注入 S，以及被拦截而尚未上报的问题。 */
interface PendingAsk {
  rules: boolean;
  /** 是否有被拦截的调用；参数缺失时问题列表为空但仍需补投。 */
  blocked: boolean;
  readonly questions: unknown[];
  readonly keys: Set<string>;
}

/** 被管理会话提问的拦截：拒绝调用、记下问题、排队 S，轮次结束时交出未上报的问题。 */
export class AskGuard {
  private readonly options: AskGuardOptions;
  /** 会话到正在等待的提问中止控制器。 */
  private readonly waiting = new Map<string, Map<string, AbortController>>();
  /** 由插件中止的调用，用于把结果改写为统一反馈。 */
  private readonly aborted = new Set<string>();
  /** 会话到待处理提问。 */
  private readonly pending = new Map<string, PendingAsk>();

  constructor(options: AskGuardOptions) {
    this.options = options;
  }

  /** 取走一次「需要 S」的标记；需要时返回被拦截的问题，否则返回 undefined。 */
  takeRules(sessionId: string): readonly unknown[] | undefined {
    const entry = this.pending.get(sessionId);
    if (entry === undefined || !entry.rules) return undefined;
    entry.rules = false;
    if (!entry.blocked) this.pending.delete(sessionId);
    return [...entry.questions];
  }

  /** 取走轮次结束时仍未上报的问题并清空该会话；没有被拦截的调用时返回 undefined。 */
  takeFallback(sessionId: string): readonly unknown[] | undefined {
    const entry = this.pending.get(sessionId);
    this.pending.delete(sessionId);
    if (entry === undefined || !entry.blocked) return undefined;
    return [...entry.questions];
  }

  /** 会话已自行上报提问：清空待注入的 S 与待补投的问题。 */
  noteReported(sessionId: string): void {
    this.pending.delete(sessionId);
  }

  /** 记下需要 S；带问题时同时记为待补投，相同问题只保留一份。 */
  private requireRules(sessionId: string, questions?: unknown): void {
    const entry = this.pending.get(sessionId) ?? {
      rules: false,
      blocked: false,
      questions: [],
      keys: new Set<string>(),
    };
    entry.rules = true;
    if (questions !== undefined) {
      entry.blocked = true;
      for (const question of Array.isArray(questions) ? questions : []) {
        const key = JSON.stringify(question) ?? '';
        if (entry.keys.has(key)) continue;
        entry.keys.add(key);
        entry.questions.push(question);
      }
    }
    this.pending.set(sessionId, entry);
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

  /** 拒绝被管理会话的提问并记下问题；他方已拒绝或取消时保持原决定。 */
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
    this.requireRules(sessionId, exec.arguments?.questions ?? null);
    return { kind: 'deny', reason: ASK_BLOCKED_ERROR };
  }

  /** 未被管理会话的提问换上可中止信号，会话开始被管理时可以结束等待。 */
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

  /** 插件中止的调用改写为统一反馈。 */
  afterExecute(
    exec: ExecuteLike,
    _result: Readonly<ToolExecutionResult>,
    next: () => Promise<PostToolDecision>,
  ): Promise<PostToolDecision> {
    if (exec.name !== ASK_TOOL) return next();
    if (!this.aborted.delete(String(exec.callId))) return next();
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
  readonly arguments?: { readonly questions?: unknown };
}

interface DispatchExecutionLike extends ExecuteLike {
  signal: AbortSignal;
}
