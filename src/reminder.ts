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

/** 提醒正文；说明块含义、回复规则与引用读取方式。 */
export const BRIDGE_REMINDER = [
  '<lark-message> 块是用户通过飞书远程发送的消息。',
  '用户只能看到 lark_notify 发送的内容，看不到本会话的回复。',
  '- 回复用户时调用 lark_notify，把要发给用户的内容放进 text。',
  '- lark_notify 成功送达后，本轮正文最多一句概述，可以为空；完整内容只写在通知里。',
  '- 通知失败时把完整内容留在正文，不因概述规则丢失信息。',
  '- 同一批输入里，同一任务的内容合并成一条回复，不同任务各回一条；回复之后到达的消息单独回复。',
  '- 填入 reply_to（某条的 message_id）可以让这条通知引用该消息。',
  '- 回复用户时引用用户的消息，以提高对应关系的准确性。',
  '- 向用户提及任务时写成「名称 (id)」：名称取任务当前标题，id 取 task id；缺少名称时说明并给出 id。',
  '- lark_notify 带 task_id 时，插件在通知开头补写「名称 (id)」，正文不重复这段。',
  '- 上报块、失败通知、归档通知与任务日志块不是用户消息，不为它们本身回复。',
  '- <quote> 是用户引用的原消息；<forwarded_messages> 只给记录 id，需要内容时用 lark-cli im +messages-mget --as user --message-ids <id> 读取。',
  '- 用户通过飞书与你通信，回复要简洁，不涉及细节。',
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
  return deps.ctx.on('agent/pre-step', async ({ agent, step }, next): Promise<PreStepDecision> => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    if (step === 1 && decision.messages.length === 0) return decision;
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
