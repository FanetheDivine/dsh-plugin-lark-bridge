/**
 * 桥接消息来源：声明 `lark-bridge` 来源类型，区分飞书消息块与桥接提醒。
 * 导出 LARK_SOURCE、REMINDER_SOURCE、isLarkMessage 与 isReminderMessage。
 */
import type { Message } from '@deepseek-ai/dsh-llm';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-bridge': { kind: 'lark-bridge'; reminder?: true };
  }
}

/** 飞书消息块的来源标记。 */
export const LARK_SOURCE = { kind: 'lark-bridge' } as const;

/** 桥接提醒的来源标记。 */
export const REMINDER_SOURCE = { kind: 'lark-bridge', reminder: true } as const;

/** 判断消息是否由本插件注入。 */
export function isLarkMessage(message: Message): boolean {
  return message.role === 'user' && message.source.kind === 'lark-bridge';
}

/** 判断消息是否是一条桥接提醒。 */
export function isReminderMessage(message: Message): boolean {
  if (!isLarkMessage(message)) return false;
  return message.source.kind === 'lark-bridge' && message.source.reminder === true;
}
