/**
 * 轮次结束自动上报：累计每轮是否上报过、最后一段助手文本，并在正常结束且无运行中子代理时上报。
 * 导出 TurnReporter。
 */
import type { LarkSuperAgentService } from '../api.ts';

/** 触发自动上报判断的信息。 */
export interface TurnEndInfo {
  readonly sessionId: string;
  readonly reason: string;
  readonly reported: boolean;
  readonly text: string;
}

export interface TurnReporterOptions {
  readonly service: LarkSuperAgentService;
  /** 会话是否仍有运行中的子代理。 */
  readonly hasRunningSubagent: (sessionId: string) => boolean;
  readonly logger: {
    warn?(...args: unknown[]): void;
  };
}

/** 单轮累计状态。 */
interface TurnState {
  turn: number;
  reported: boolean;
  text: string;
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

/** 会话事件的轮次累计与结束处理。 */
export class TurnReporter {
  private readonly options: TurnReporterOptions;
  private readonly turns = new Map<string, TurnState>();

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
      this.turns.set(sessionId, { turn, reported: false, text: '' });
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
      const info: TurnEndInfo = {
        sessionId,
        reason: kind,
        reported: current.reported,
        text: current.text,
      };
      this.turns.delete(sessionId);
      void this.finish(info);
    }
  }

  /** 取当前轮次状态；事件缺少开启记录时按该轮新建。 */
  private current(sessionId: string, turn: number): TurnState {
    const existing = this.turns.get(sessionId);
    if (existing !== undefined && existing.turn === turn) return existing;
    const created: TurnState = { turn, reported: false, text: '' };
    this.turns.set(sessionId, created);
    return created;
  }

  /** 把会话当前轮标记为已上报；拦截代为上报后轮次结束不再补进度上报。 */
  markIntercepted(sessionId: string): void {
    const state = this.turns.get(sessionId);
    if (state !== undefined) state.reported = true;
  }

  /** 正常结束、本轮未上报、无运行中子代理时投递 progress 上报。 */
  private async finish(info: TurnEndInfo): Promise<void> {
    if (info.reason !== 'completed') return;
    if (info.reported) return;
    if (info.text.trim() === '') return;
    try {
      if (this.options.hasRunningSubagent(info.sessionId)) return;
      if ((await this.options.service.managedTask(info.sessionId)) === undefined) return;
      await this.options.service.sendReport(
        { kind: 'progress', text: info.text },
        info.sessionId,
        'turn_end',
      );
    } catch (error) {
      this.options.logger.warn?.('lark-super-agent: turn-end report was not delivered', error);
    }
  }
}
