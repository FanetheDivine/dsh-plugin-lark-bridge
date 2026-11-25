/** 把调度会话经 meta-tools 投递的消息包装为带来源标记的块，先剥掉 meta-tools 的 system-reminder 帧。 */
import type { ContentBlock, UserMessage } from '@deepseek-ai/dsh-llm';

import { freezeMessage } from './host.ts';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'dsh-plugin-meta-tools': {
      kind: 'dsh-plugin-meta-tools';
    };
  }
}

/** meta-tools 投递消息的来源标识。 */
const DISPATCH_SOURCE = 'dsh-plugin-meta-tools';

/** 调度消息块的开标签与闭标签。 */
const OPEN_TAG = '<dispatch_session_message>';
const CLOSE_TAG = '</dispatch_session_message>';

/** meta-tools `session_send` 帧的开标签与闭标签。 */
const REMINDER_OPEN = '<system-reminder>';
const REMINDER_CLOSE = '</system-reminder>';
const REMINDER_ESCAPED_CLOSE = '<\\/system-reminder>';

/** 首个文本块已带开标签时视为已包装。 */
function isWrapped(message: UserMessage): boolean {
  const first = message.content[0];
  return first?.type === 'text' && first.text.startsWith(OPEN_TAG);
}

/** 整段恰好是一个 system-reminder 帧时返回正文，其余返回 undefined。 */
function unwrapReminder(content: readonly ContentBlock[]): ContentBlock[] | undefined {
  const block = content.length === 1 ? content[0] : undefined;
  if (block?.type !== 'text') return undefined;
  const text = block.text.trim();
  if (!text.startsWith(`${REMINDER_OPEN}\n`) || !text.endsWith(`\n${REMINDER_CLOSE}`)) {
    return undefined;
  }
  const body = text.slice(REMINDER_OPEN.length + 1, text.length - REMINDER_CLOSE.length - 1);
  if (body.includes(REMINDER_OPEN) || body.includes(REMINDER_CLOSE)) return undefined;
  return [{ type: 'text', text: body.replaceAll(REMINDER_ESCAPED_CLOSE, REMINDER_CLOSE) }];
}

/** 去掉整帧后加反斜杠转义闭标签，再包进调度消息块。 */
function wrapContent(content: readonly ContentBlock[]): ContentBlock[] {
  const inner = unwrapReminder(content) ?? content;
  const escaped = inner.map((block) =>
    block.type === 'text'
      ? { ...block, text: block.text.replaceAll(CLOSE_TAG, '<\\/dispatch_session_message>') }
      : block,
  );
  return [
    { type: 'text', text: `${OPEN_TAG}\n` },
    ...escaped,
    { type: 'text', text: `\n${CLOSE_TAG}` },
  ];
}

/**
 * 包装 meta-tools 来源的消息，其他消息原样保留。
 * 保留原消息 id 与 source；无需包装时返回入参数组本身。
 */
export function wrapDispatchMessages(messages: readonly UserMessage[]): UserMessage[] {
  let changed = false;
  const wrapped = messages.map((message) => {
    if (message.source.kind !== DISPATCH_SOURCE || isWrapped(message)) return message;
    changed = true;
    return freezeMessage({ ...message, content: wrapContent(message.content) });
  });
  return changed ? wrapped : (messages as UserMessage[]);
}
