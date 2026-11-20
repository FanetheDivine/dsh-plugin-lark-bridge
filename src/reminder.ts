/**
 * 桥接提醒：说明 `<lark-message>` 块的回复规则，并在表层缺失时补注。
 * 导出 BRIDGE_REMINDER、createReminderMessage 与 installReminderGuard。
 */
import type { PreStepDecision } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Session } from '@deepseek-ai/dsh-session';

import { isLarkMessage, isReminderMessage, REMINDER_SOURCE } from './message.ts';
import type { SessionManager } from './sessions.ts';
import type { Context } from './types.ts';
import { describeError, reminder } from './utils.ts';

/** 提醒正文；说明块含义与回复规则。 */
export const BRIDGE_REMINDER = [
  '<lark-message> 块是用户通过飞书远程发送的消息。',
  '用户只能看到 lark_notify 发送的内容，看不到本会话的回复。',
  '- 回复飞书消息时调用 lark_notify，把要发给用户的内容放进 text。',
  '- 用户连续发来多条 <lark-message> 时只回复一次，用一次 lark_notify 覆盖全部内容。',
  '- 会话里的 text 块用户看不到，尽量少输出，说明性文字也放进 lark_notify。',
  '- 其他来源的用户消息按普通方式回复，不调用 lark_notify。',
].join('\n');

/** 构造提醒消息。 */
export function createReminderMessage() {
  return createUserMessage({
    content: [{ type: 'text', text: reminder(BRIDGE_REMINDER) }],
    source: REMINDER_SOURCE,
  });
}

/** 表层是否已有桥接提醒。 */
export function surfaceHasReminder(session: Session): boolean {
  for (const seq of session.surface.nodes) {
    const event = session.eventAt(seq);
    if (event?.type === 'user/message' && isReminderMessage(event.data)) return true;
  }
  return false;
}

/** 提醒补注的依赖。 */
export interface ReminderGuardDeps {
  readonly ctx: Context;
  readonly sessions: SessionManager;
  readonly logger: { warn(message: string): void };
}

/**
 * 注册 `agent/pre-step` 补注：桥接会话表层缺少提醒时，把它插到本批第一条块之前。
 * @param deps - 上下文、会话判定与日志。
 * @returns 注销函数。
 */
export function installReminderGuard(deps: ReminderGuardDeps): () => void {
  return deps.ctx.on('agent/pre-step', async ({ agent }, next): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    if (decision.messages.length === 0) return decision;
    const session = agent.session;
    let bridge = false;
    try {
      bridge = await deps.sessions.isBridgeSession(session);
    } catch (error) {
      deps.logger.warn(`lark-bridge: cannot resolve reminder state: ${describeError(error)}`);
      return decision;
    }
    if (!bridge) return decision;
    if (surfaceHasReminder(session)) return decision;
    if (decision.messages.some(isReminderMessage)) return decision;
    const index = decision.messages.findIndex(isLarkMessage);
    const messages = decision.messages.toSpliced(
      index === -1 ? 0 : index,
      0,
      createReminderMessage(),
    );
    return { ...decision, messages };
  });
}
