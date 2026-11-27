/**
 * 轮次结束自动上报：保留每轮是否上报过、最后一段助手文本与结束原因，并在正常结束且无运行中子代理时上报。
 * 会话被接管时用同一判定补发最后轮次文本；两种上报按会话串行，同一轮只投递一次。
 * 导出 TurnReporter 与 assistantText。
 */
import type { LarkSuperAgentService } from '../api.ts';

export interface TurnReporterOptions {
  readonly service: LarkSuperAgentService;
  /** 会话是否仍有运行中的子代理。 */
  readonly hasRunningSubagent: (sessionId: string) => boolean;
  readonly logger: {
    warn?(...args: unknown[]): void;
  };
}

/** 单轮累计状态；轮次结束后保留，供接管时补发。 */
interface TurnState {
  turn: number;
  reported: boolean;
  text: string;
  /** 是否已观察到该轮的 turn/end。 */
  settled: boolean;
  /** turn/end 的 reason.kind；未结束时为空串。 */
  reason: string;
  /** 该轮自动上报已投递到的任务标识。 */
  reportedTaskId?: string;
}

/** 报告工具名；本轮调用过时不再自动上报。 */
const REPORT_TOOL = 'send_report';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 取一条助手消息中的文本块拼接结果。 */
export function assistantText(content: unknown): string {
  if (!Array.isArray(content)) return '';
  const parts: string[] = [];
  for (const block of content) {
    if (!isRecord(block) || block.type !== 'text') continue;
    if (typeof block.text === 'string' && block.text !== '') parts.push(block.text);
  }
  return parts.join('\n');
}

/** 会话事件的轮次累计、结束处理与接管补发。 */
export class TurnReporter {
  private readonly options: TurnReporterOptions;
  private readonly turns = new Map<string, TurnState>();
  /** 每会话的判定链；轮次结束与接管补发串行执行。 */
  private readonly chains = new Map<string, Promise<void>>();

  constructor(options: TurnReporterOptions) {
    this.options = options;
  }

  /** 观察一条会话事件。 */
  observe(sessionId: string, event: unknown): void {
    if (!isRecord(event)) return;
    const data = isRecord(event.data) ? event.data : event;
    const type = event.type ?? data.type;
    const turn = typeof data.turn === 'number' ? data.turn : undefined;
    if (turn === undefined) return;

    if (type === 'turn/start') {
      this.turns.set(sessionId, state(turn));
      return;
    }

    const current = this.current(sessionId, turn);

    if (type === 'tool/call' && data.name === REPORT_TOOL) {
      current.reported = true;
      return;
    }

    if (type === 'assistant/message') {
      const message = isRecord(data.message) ? data.message : undefined;
      const text = assistantText(message?.content);
      if (text.trim() !== '') current.text = text;
      return;
    }

    if (type === 'turn/end') {
      const reason = isRecord(data.reason) ? data.reason : undefined;
      const kind = typeof reason?.kind === 'string' ? reason.kind : '';
      current.settled = true;
      current.reason = kind;
      this.finish(sessionId, current);
    }
  }

  /** 会话被接管时补发最后轮次的文本；判定条件与轮次结束上报相同。 */
  async catchUp(sessionId: string, taskId: string): Promise<void> {
    await this.enqueue(sessionId, async () => {
      const current = this.turns.get(sessionId);
      if (current === undefined || !current.settled) return;
      if (!this.shouldReport(sessionId, current)) return;
      if (current.reportedTaskId === taskId) return;
      await this.deliver(sessionId, current, taskId);
    });
  }

  /** 取当前轮次状态；事件缺少开启记录时按该轮新建。 */
  private current(sessionId: string, turn: number): TurnState {
    const existing = this.turns.get(sessionId);
    if (existing !== undefined && existing.turn === turn) return existing;
    const created = state(turn);
    this.turns.set(sessionId, created);
    return created;
  }

  /** 轮次结束；把判定与投递排入该会话的判定链。 */
  private finish(sessionId: string, current: TurnState): void {
    void this.enqueue(sessionId, async () => {
      if (!this.shouldReport(sessionId, current)) return;
      const task = await this.options.service.managedTask(sessionId);
      if (task === undefined) return;
      await this.deliver(sessionId, current, task.id);
    });
  }

  /** 正常结束、本轮未上报、文本非空且无运行中子代理时才上报。 */
  private shouldReport(sessionId: string, current: TurnState): boolean {
    if (current.reason !== 'completed') return false;
    if (current.reported) return false;
    if (current.text.trim() === '') return false;
    return !this.options.hasRunningSubagent(sessionId);
  }

  /** 存档并投递一条 progress 上报；失败只写日志，并记下已投递的任务标识。 */
  private async deliver(sessionId: string, current: TurnState, taskId: string): Promise<void> {
    try {
      const result = await this.options.service.sendReport(
        { kind: 'progress', text: current.text },
        sessionId,
        'turn_end',
      );
      current.reportedTaskId = taskId;
      if (!result.delivered) {
        this.options.logger.warn?.(
          'lark-super-agent: turn-end report was not delivered',
          result.reason,
        );
      }
    } catch (error) {
      this.options.logger.warn?.('lark-super-agent: turn-end report was not delivered', error);
    }
  }

  /** 按会话串行执行判定；前一项失败不阻塞后一项。 */
  private enqueue(sessionId: string, task: () => Promise<void>): Promise<void> {
    const previous = this.chains.get(sessionId) ?? Promise.resolve();
    const result = previous.catch(() => undefined).then(task);
    const tail = result.then(
      () => undefined,
      () => undefined,
    );
    this.chains.set(sessionId, tail);
    void tail.then(() => {
      if (this.chains.get(sessionId) === tail) this.chains.delete(sessionId);
    });
    return result;
  }
}

/** 新建一条未结束的轮次状态。 */
function state(turn: number): TurnState {
  return { turn, reported: false, text: '', settled: false, reason: '' };
}
