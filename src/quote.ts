/**
 * 被引消息：按 `reply_to` 读取原消息并渲染 `<quote>` 块。
 * 导出 QuotedMessage、readQuoted、toQuotedMessage、truncateQuote 与 formatQuote。
 */
import type { LarkCli } from './cli.ts';
import { QUOTE_MAX_CHARS, QUOTE_TIMEOUT_MS } from './constants.ts';
import { escapeAttribute, formatTime, isRecord, splitText } from './utils.ts';

/** 发送者身份。 */
export type QuoteFrom = 'user' | 'bot';

/** 引用正文的呈现分支。 */
export type QuoteKind = 'text' | 'forwarded' | 'other';

/** 一条被引消息的呈现模型。 */
export interface QuotedMessage {
  /** 被引消息标识。 */
  readonly messageId: string;
  /** 发送者身份。 */
  readonly from: QuoteFrom;
  /** 已格式化时间；不可得为空串。 */
  readonly time: string;
  /** 渲染分支。 */
  readonly kind: QuoteKind;
  /** 截断前的正文或类型占位。 */
  readonly text: string;
  /** 读取失败标记。 */
  readonly unavailable: boolean;
}

/** 读取身份顺序：user 优先，bot 兜底。 */
const IDENTITIES: readonly QuoteFrom[] = ['user', 'bot'];

/** 读取失败时的引用模型。 */
function unavailableQuote(messageId: string): QuotedMessage {
  return { messageId, from: 'user', time: '', kind: 'text', text: '', unavailable: true };
}

/** 从 mget 输出中取出第一条消息。 */
function firstMessage(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const messages = value['messages'];
  if (!Array.isArray(messages)) return undefined;
  const first: unknown = messages[0];
  return isRecord(first) ? first : undefined;
}

/** mget 已格式化的时间文本（`YYYY-MM-DD HH:mm[:ss]`）。 */
const MGET_TIME = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(?::\d{2})?$/;

/** 归一时间：mget 已在本机时区格式化，直接沿用；其他形式交给 formatTime。 */
function quoteTime(value: unknown): string {
  if (typeof value !== 'string') return '';
  const text = value.trim();
  if (MGET_TIME.test(text)) return text.length === 16 ? `${text}:00` : text;
  return formatTime(text);
}

/**
 * 把一条 mget 消息转成引用模型。
 * @param messageId - 被引消息标识。
 * @param raw - mget 返回的单条消息。
 */
export function toQuotedMessage(messageId: string, raw: Record<string, unknown>): QuotedMessage {
  const sender = isRecord(raw['sender']) ? raw['sender'] : {};
  const senderType = sender['sender_type'];
  const from: QuoteFrom = senderType === 'bot' || senderType === 'app' ? 'bot' : 'user';
  const type = String(raw['msg_type'] ?? 'text');
  const content = typeof raw['content'] === 'string' ? raw['content'].trim() : '';
  const time = quoteTime(raw['create_time']);
  if (type === 'merge_forward') {
    return { messageId, from, time, kind: 'forwarded', text: '', unavailable: false };
  }
  if (type !== 'text' && type !== 'post') {
    return { messageId, from, time, kind: 'other', text: `[${type} 消息]`, unavailable: false };
  }
  const text = content === '' ? `[${type} 消息]` : content;
  return { messageId, from, time, kind: 'text', text, unavailable: false };
}

/**
 * 把引用正文截断到上限，去掉代理对残留。
 * @param text - 原始正文。
 * @param limit - 最大字符数。
 */
export function truncateQuote(text: string, limit = QUOTE_MAX_CHARS): string {
  if (text.length <= limit) return text;
  return `${splitText(text, limit)[0] ?? ''}（已截断）`;
}

/** 转义引用正文中的块结束标记。 */
function escapeBody(text: string): string {
  return text
    .replaceAll('</quote>', '<\\/quote>')
    .replaceAll('</lark-message>', '<\\/lark-message>');
}

/**
 * 渲染 `<quote>` 块。
 * @param quote - 被引消息。
 */
export function formatQuote(quote: QuotedMessage): string {
  const attributes = [`message_id="${escapeAttribute(quote.messageId)}"`, `from="${quote.from}"`];
  if (quote.time !== '') attributes.push(`time="${escapeAttribute(quote.time)}"`);
  let body = '[引用内容读取失败]';
  if (!quote.unavailable) {
    if (quote.kind === 'forwarded') {
      body = `<forwarded_messages message_id="${escapeAttribute(quote.messageId)}"/>`;
    } else {
      body = escapeBody(truncateQuote(quote.text));
    }
  }
  return `<quote ${attributes.join(' ')}>\n${body}\n</quote>`;
}

/**
 * 读取被引消息：user 身份优先，bot 兜底，均失败时返回不可用引用。
 * @param cli - lark-cli 适配层。
 * @param messageId - 被引消息标识。
 * @param timeoutMs - 单次调用超时。
 */
export async function readQuoted(
  cli: LarkCli,
  messageId: string,
  timeoutMs = QUOTE_TIMEOUT_MS,
): Promise<QuotedMessage> {
  for (const identity of IDENTITIES) {
    let value: unknown;
    try {
      value = await cli.json(
        ['im', '+messages-mget', '--as', identity, '--message-ids', messageId, '--no-reactions'],
        { timeoutMs },
      );
    } catch {
      continue;
    }
    const raw = firstMessage(value);
    if (raw === undefined || raw['deleted'] === true) continue;
    return toQuotedMessage(messageId, raw);
  }
  return unavailableQuote(messageId);
}
