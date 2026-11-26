/**
 * 任务日志观察：被管理会话收到用户直接发来的消息、或用户主动停止轮次时写一条日志。
 * 不唤醒调度会话；归档引发的取消不记录。导出 TaskLogObserver。
 */
import type { LarkSuperAgentService } from '../api.ts';

/** 观察器依赖。 */
export interface TaskLogObserverOptions {
  readonly service: LarkSuperAgentService;
  /** 已归档会话标识；宿主先写归档集合再请求停止，据此排除归档引发的取消。 */
  readonly archivedSessionIds: () => readonly string[];
  readonly logger: { warn?(...args: unknown[]): void };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 拼接消息中的文本块。 */
function textOf(content: unknown): string {
  if (!Array.isArray(content)) return '';
  return content
    .flatMap((block) =>
      isRecord(block) && block.type === 'text' && typeof block.text === 'string'
        ? [block.text]
        : [],
    )
    .join('\n')
    .trim();
}

/** 观察会话事件并写任务日志。 */
export class TaskLogObserver {
  private readonly options: TaskLogObserverOptions;

  constructor(options: TaskLogObserverOptions) {
    this.options = options;
  }

  /**
   * 观察一条会话事件。
   * @param sessionId - 事件所属会话。
   * @param event - `session/event` 事件。
   */
  observe(sessionId: string, event: unknown): void {
    if (!isRecord(event)) return;
    const seq = typeof event.seq === 'number' ? event.seq : undefined;
    if (seq === undefined) return;
    const data = isRecord(event.data) ? event.data : undefined;
    if (data === undefined) return;
    if (event.type === 'user/message') {
      const source = isRecord(data.source) ? data.source : undefined;
      if (source?.kind !== 'user') return;
      const text = textOf(data.content);
      if (text === '') return;
      this.write(sessionId, { seq, type: 'user_message', text });
      return;
    }
    if (event.type === 'turn/end') {
      const reason = isRecord(data.reason) ? data.reason : undefined;
      const cause = isRecord(reason?.reason) ? reason.reason : undefined;
      if (reason?.kind !== 'aborted' || cause?.kind !== 'user') return;
      if (this.options.archivedSessionIds().includes(sessionId)) return;
      this.write(sessionId, { seq, type: 'user_stop', text: '' });
    }
  }

  /** 写一条日志；会话未被管理或任务已结束时由服务丢弃。 */
  private write(
    sessionId: string,
    input: { seq: number; type: 'user_message' | 'user_stop'; text: string },
  ): void {
    void this.options.service.appendTaskLog(sessionId, input).catch((error: unknown) => {
      this.options.logger.warn?.('lark-super-agent: task log entry was not written', error);
    });
  }
}
