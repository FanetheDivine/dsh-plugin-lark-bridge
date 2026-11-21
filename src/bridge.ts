/**
 * 飞书事件桥：消费 bot 身份事件、过滤与去重，并把消息注入桥接会话。
 * 导出 EventBridge 与 formatLarkMessage。
 */
import { createInterface } from 'node:readline';
import type { AuthSnapshot } from './auth.ts';
import type { LarkCli } from './cli.ts';
import { killChildTree } from './cli.ts';
import { RESTART_MAX_MS, RESTART_MIN_MS } from './constants.ts';
import { formatQuote, type QuotedMessage, readQuoted } from './quote.ts';
import type { SessionManager } from './sessions.ts';
import type { StateStore } from './state.ts';
import {
  describeError,
  escapeAttribute,
  escapeBlockText,
  formatTime,
  parseTimestamp,
} from './utils.ts';

/** `im.message.receive_v1` 的可用字段。 */
export interface FeishuEvent {
  readonly message_id?: string;
  readonly id?: string;
  readonly chat_id?: string;
  readonly chat_type?: string;
  readonly sender_id?: string;
  readonly sender_type?: string;
  readonly message_type?: string;
  readonly msg_type?: string;
  readonly content?: string;
  readonly create_time?: string;
  readonly timestamp?: string;
  readonly [key: string]: unknown;
}

/** 日志接口。 */
export interface BridgeLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** EventBridge 的依赖。 */
export interface BridgeDeps {
  readonly getCli: () => LarkCli;
  readonly getAuth: () => AuthSnapshot;
  /** 当前工作区是否仍是有效注册项。 */
  readonly getWorkspaceReady: () => boolean;
  readonly store: StateStore;
  readonly sessions: SessionManager;
  readonly logger: BridgeLogger;
}

/** 等待注入的一条飞书消息。 */
interface QueuedMessage {
  readonly id: string;
  readonly createdAt: number;
  readonly receivedAt: number;
  readonly block: string;
}

/** 把队列条目拼成日志用的 `id@创建时间/到达时间` 列表。 */
function describeQueue(items: readonly QueuedMessage[]): string {
  return items
    .map((item) => `${item.id}@${formatTime(item.createdAt)}/${formatTime(item.receivedAt)}`)
    .join(',');
}

/** 返回事件的消息标识。 */
function messageId(event: FeishuEvent): string {
  return String(event.message_id ?? event.id ?? '');
}

/** 返回事件的被引消息标识；没有引用时为空串。 */
export function replyToId(event: FeishuEvent): string {
  return typeof event.reply_to === 'string' ? event.reply_to.trim() : '';
}

/** 把一条飞书消息渲染为 `<lark-message>` 块。 */
export function formatLarkMessage(event: FeishuEvent, quote?: QuotedMessage): string {
  const time = formatTime(parseTimestamp(event.timestamp ?? event.create_time));
  const text = typeof event.content === 'string' ? event.content.trim() : '';
  const type = String(event.message_type ?? event.msg_type ?? 'text');
  const id = escapeAttribute(messageId(event));
  const replyTo = escapeAttribute(replyToId(event));
  const attributes = [`message_id="${id}"`];
  if (replyTo !== '') attributes.push(`reply_to="${replyTo}"`);
  if (time !== '') attributes.push(`time="${time}"`);
  let body = text === '' ? `[${type} 消息]` : escapeBlockText(text);
  if (type === 'merge_forward') body = `<forwarded_messages message_id="${id}"/>`;
  const inner = quote === undefined ? body : `${formatQuote(quote)}\n${body}`;
  return `<lark-message ${attributes.join(' ')}>\n${inner}\n</lark-message>`;
}

/** 判断事件是否来自目标用户的私聊。 */
export function acceptEvent(event: FeishuEvent, ownerOpenId: string): boolean {
  if (event.chat_type !== 'p2p') return false;
  if (event.sender_type !== 'user') return false;
  return event.sender_id === ownerOpenId;
}

/** 事件消费与注入。 */
export class EventBridge {
  private readonly deps: BridgeDeps;
  private child: ReturnType<LarkCli['spawn']> | undefined;
  private restartTimer: NodeJS.Timeout | undefined;
  private backoff = RESTART_MIN_MS;
  private startedAt = 0;
  private stopped = true;
  private readonly queue: QueuedMessage[] = [];
  private draining = false;
  private delivery: Promise<void> = Promise.resolve();

  constructor(deps: BridgeDeps) {
    this.deps = deps;
  }

  /** 是否正在监听。 */
  get running(): boolean {
    return this.child !== undefined;
  }

  /** 鉴权与工作区均有效时启动；否则保持停止。 */
  start(): void {
    if (this.deps.getAuth().ready !== true || !this.deps.getWorkspaceReady()) return;
    this.stopped = false;
    this.spawn();
  }

  /** 停止并终止子进程。 */
  stop(): void {
    this.stopped = true;
    if (this.restartTimer !== undefined) clearTimeout(this.restartTimer);
    this.restartTimer = undefined;
    if (this.queue.length > 0) {
      this.deps.logger.warn(
        `lark-bridge: dropped ${this.queue.length} queued message(s) [${describeQueue(this.queue)}] on stop`,
      );
      this.queue.length = 0;
    }
    const child = this.child;
    this.child = undefined;
    if (child !== undefined) killChildTree(child);
  }

  /** 鉴权或工作区状态变化时同步监听；工作区变化不停止已运行的监听。 */
  sync(snapshot: AuthSnapshot): void {
    if (!snapshot.ready) {
      this.stop();
      return;
    }
    if (!this.running && this.deps.getWorkspaceReady()) this.start();
  }

  /** 启动一个消费者子进程。 */
  private spawn(): void {
    if (this.stopped || this.child !== undefined) return;
    const cli = this.deps.getCli();
    let child: ReturnType<LarkCli['spawn']>;
    try {
      child = cli.spawn([
        'event',
        'consume',
        'im.message.receive_v1',
        '--as',
        'bot',
        '--quiet',
        '--timeout',
        '0',
      ]);
    } catch (error) {
      this.deps.logger.warn(`lark-bridge: cannot start event consumer: ${describeError(error)}`);
      this.scheduleRestart();
      return;
    }
    this.child = child;
    this.startedAt = Date.now();
    const stdout = child.stdout;
    if (stdout === null) {
      this.child = undefined;
      killChildTree(child);
      this.deps.logger.warn('lark-bridge: event consumer has no stdout pipe');
      this.scheduleRestart();
      return;
    }
    this.deps.logger.info('lark-bridge: event consumer started');
    const lines = createInterface({ input: stdout });
    lines.on('line', (line) => {
      const text = line.trim();
      if (!text.startsWith('{')) return;
      let payload: FeishuEvent;
      try {
        payload = JSON.parse(text) as FeishuEvent;
      } catch {
        return;
      }
      void this.handleEvent(payload).catch((error: unknown) => {
        this.deps.logger.warn(`lark-bridge: event handling failed: ${describeError(error)}`);
      });
    });
    child.stderr?.on('data', (chunk: Buffer) => {
      const text = chunk.toString('utf8').trim();
      if (text !== '') this.deps.logger.warn(`lark-bridge: consumer stderr: ${text.slice(0, 500)}`);
    });
    let finished = false;
    const finish = (reason: string): void => {
      if (finished) return;
      finished = true;
      if (this.child === child) this.child = undefined;
      if (this.stopped) return;
      if (Date.now() - this.startedAt > 30_000) this.backoff = RESTART_MIN_MS;
      this.deps.logger.warn(`lark-bridge: event consumer exited (${reason})`);
      this.scheduleRestart();
    };
    child.on('error', (error) => finish(`error: ${describeError(error)}`));
    child.on('close', (code) => finish(`exit ${code ?? 'unknown'}`));
  }

  /** 按退避重试。 */
  private scheduleRestart(): void {
    if (this.stopped) return;
    const delay = this.backoff;
    this.backoff = Math.min(this.backoff * 2, RESTART_MAX_MS);
    this.deps.logger.info(`lark-bridge: restarting event consumer in ${delay}ms`);
    this.restartTimer = setTimeout(() => {
      this.restartTimer = undefined;
      this.spawn();
    }, delay);
    this.restartTimer.unref?.();
  }

  /** 处理一条事件：过滤、去重、过滤过期消息、读取引用并放入队列。 */
  async handleEvent(event: FeishuEvent): Promise<boolean> {
    const id = messageId(event);
    if (id === '') return false;
    const auth = this.deps.getAuth();
    const owner = auth.ownerOpenId;
    if (auth.ready !== true || owner === undefined || owner === '') {
      this.deps.logger.warn(`lark-bridge: dropped ${id}: auth not ready`);
      return false;
    }
    if (!acceptEvent(event, owner)) return false;
    const createdAt = parseTimestamp(event.timestamp ?? event.create_time);
    const receivedAt = Date.now();
    if (!(await this.deps.store.markSeen(id, createdAt))) return false;
    if (createdAt < this.startedAt) {
      this.deps.logger.warn(
        `lark-bridge: filtered ${id} created=${formatTime(createdAt)} received=${formatTime(receivedAt)} listenerStart=${formatTime(this.startedAt)}`,
      );
      return false;
    }
    const quote = await this.readQuote(event);
    this.queue.push({ id, createdAt, receivedAt, block: formatLarkMessage(event, quote) });
    await this.requestDrain();
    return true;
  }

  /** 把一次 drain 追加到投递链；前一次投递完成后按创建时间顺序继续。 */
  private requestDrain(): Promise<void> {
    const next = this.delivery.then(() => this.drain());
    this.delivery = next.catch((error: unknown) => {
      this.deps.logger.warn(`lark-bridge: drain failed: ${describeError(error)}`);
    });
    return this.delivery;
  }

  /** 逐条注入队列中的消息，每条按创建时间升序排列。失败的条目记录后继续。 */
  private async drain(): Promise<void> {
    if (this.draining || this.queue.length === 0) return;
    this.draining = true;
    try {
      while (this.queue.length > 0) {
        this.queue.sort((a, b) => a.createdAt - b.createdAt);
        const item = this.queue.shift() as QueuedMessage;
        const ids = `${item.id}@${formatTime(item.createdAt)}/${formatTime(item.receivedAt)}`;
        try {
          const result = await this.deps.sessions.inject(item.block);
          this.deps.logger.info(
            `lark-bridge: delivered 1 message(s) [${ids}] to session ${result.sessionId} (created=${String(result.created)})`,
          );
        } catch (error) {
          this.deps.logger.warn(
            `lark-bridge: failed 1 message(s) [${ids}]: ${describeError(error)}`,
          );
        }
      }
    } finally {
      this.draining = false;
    }
  }

  /** 读取被引消息；没有引用或读取失败时返回降级模型。 */
  private async readQuote(event: FeishuEvent): Promise<QuotedMessage | undefined> {
    const replyTo = replyToId(event);
    if (replyTo === '') return undefined;
    const quote = await readQuoted(this.deps.getCli(), replyTo);
    if (quote.unavailable) {
      this.deps.logger.warn(`lark-bridge: cannot read quoted message ${replyTo}`);
    }
    return quote;
  }
}
