// 桥接提醒测试：文案规则、pre-step 补注、去重与压缩后的补注。
import type { PreStepDecision } from '@deepseek-ai/dsh-agent';
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { describe, expect, it, vi } from 'vitest';

import { isReminderMessage, LARK_SOURCE } from '../src/message.ts';
import {
  BRIDGE_REMINDER,
  createReminderMessage,
  installReminderGuard,
  surfaceHasReminder,
} from '../src/reminder.ts';

/** 构造一条飞书消息块。 */
function larkMessage(id = 'om_1'): UserMessage {
  return createUserMessage({
    content: [
      {
        type: 'text',
        text: `<lark-message message_id="${id}" time="2026-11-20 23:20:23">\n你好\n</lark-message>`,
      },
    ],
    source: LARK_SOURCE,
  });
}

/** 构造一条本地用户消息。 */
function localMessage(): UserMessage {
  return createUserMessage({
    content: [{ type: 'text', text: '本地消息' }],
    source: { kind: 'user' },
  });
}

/** 构造只读表层。 */
function sessionStub(events: readonly { type: string; data: unknown }[] = [], id = 's1') {
  const bySeq = new Map(events.map((event, index) => [index, event]));
  return {
    id,
    surface: {
      nodes: events.map((_event, index) => index),
      replaceGeneration: 0,
      contentGeneration: 0,
    },
    eventAt: (seq: number) => bySeq.get(seq),
  };
}

/** 取出 pre-step 处理器并执行一次。 */
function harness(options: { bridge?: boolean; failure?: unknown } = {}) {
  type Handler = (
    payload: { agent: { session: ReturnType<typeof sessionStub> }; step: number },
    next: () => Promise<PreStepDecision>,
  ) => Promise<PreStepDecision>;
  let handler: Handler | undefined;
  const ctx = {
    on: (type: string, fn: Handler) => {
      if (type === 'agent/pre-step') handler = fn;
      return () => true;
    },
  };
  const isBridgeSession = vi.fn(async () => {
    if (options.failure !== undefined) throw options.failure;
    return options.bridge ?? true;
  });
  const logger = { warn: vi.fn() };
  installReminderGuard({ ctx: ctx as never, sessions: { isBridgeSession } as never, logger });
  return {
    isBridgeSession,
    logger,
    async run(
      session: ReturnType<typeof sessionStub>,
      messages: UserMessage[],
      decision?: PreStepDecision,
      step = 1,
    ): Promise<PreStepDecision> {
      if (handler === undefined) throw new Error('pre-step handler not installed');
      return handler(
        { agent: { session }, step },
        async () => decision ?? { kind: 'enter', messages },
      );
    },
  };
}

describe('BRIDGE_REMINDER', () => {
  it('覆盖四条回复规则', () => {
    expect(BRIDGE_REMINDER).toContain('lark_notify');
    expect(BRIDGE_REMINDER).toContain('远程发送');
    expect(BRIDGE_REMINDER).toContain('只回复一次');
    expect(BRIDGE_REMINDER).toContain('其他来源的用户消息');
  });

  it('包装成 system-reminder 且来源带标记', () => {
    const message = createReminderMessage();
    expect(message.source).toEqual({ kind: 'lark-bridge', reminder: true });
    expect(isReminderMessage(message)).toBe(true);
    const [block] = message.content;
    expect(block).toMatchObject({ type: 'text' });
    if (block?.type === 'text') {
      expect(block.text.startsWith('<system-reminder>')).toBe(true);
      expect(block.text).toContain('</system-reminder>');
    }
  });
});

describe('surfaceHasReminder', () => {
  it('识别表层中的提醒', () => {
    const reminder = { type: 'user/message', data: createReminderMessage() };
    expect(surfaceHasReminder(sessionStub([reminder]) as never)).toBe(true);
  });

  it('普通消息不算提醒', () => {
    const block = { type: 'user/message', data: larkMessage() };
    expect(surfaceHasReminder(sessionStub([block]) as never)).toBe(false);
  });
});

describe('installReminderGuard', () => {
  it('把提醒插到第一条块之前', async () => {
    const { run } = harness();
    const block = larkMessage();
    const local = localMessage();
    const decision = await run(sessionStub(), [local, block]);
    expect(decision.kind).toBe('enter');
    if (decision.kind !== 'enter') return;
    expect(decision.messages[0]).toBe(local);
    expect(decision.messages[1]?.source).toMatchObject({ reminder: true });
    expect(decision.messages[2]).toBe(block);
  });

  it('表层已有提醒时不补注', async () => {
    const reminder = { type: 'user/message', data: createReminderMessage() };
    const { run } = harness();
    const block = larkMessage();
    const decision = await run(sessionStub([reminder]), [block]);
    expect(decision.kind === 'enter' && decision.messages).toHaveLength(1);
  });

  it('本批已有提醒时不补注', async () => {
    const { run } = harness();
    const reminder = createReminderMessage();
    const block = larkMessage();
    const decision = await run(sessionStub(), [reminder, block]);
    expect(decision.kind === 'enter' && decision.messages).toHaveLength(2);
  });

  it('非桥接会话不补注', async () => {
    const { run, isBridgeSession } = harness({ bridge: false });
    const decision = await run(sessionStub(), [larkMessage()]);
    expect(isBridgeSession).toHaveBeenCalledTimes(1);
    expect(decision.kind === 'enter' && decision.messages).toHaveLength(1);
  });

  it('reject 与第一步空批次原样返回', async () => {
    const { run, isBridgeSession } = harness();
    expect(await run(sessionStub(), [], { kind: 'reject' })).toEqual({ kind: 'reject' });
    expect(await run(sessionStub(), [], undefined, 1)).toEqual({ kind: 'enter', messages: [] });
    expect(isBridgeSession).not.toHaveBeenCalled();
  });

  it('后续步骤的空批次也补回提醒', async () => {
    const { run } = harness();
    const decision = await run(sessionStub(), [], undefined, 2);
    expect(decision.kind).toBe('enter');
    if (decision.kind !== 'enter') return;
    expect(decision.messages).toHaveLength(1);
    expect(decision.messages[0]?.source).toMatchObject({ reminder: true });
  });

  it('会话判定失败时记录警告并继续', async () => {
    const { run, logger } = harness({ failure: new Error('state broken') });
    const block = larkMessage();
    const decision = await run(sessionStub(), [block]);
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(decision.kind === 'enter' && decision.messages).toHaveLength(1);
  });

  it('压缩后的表层缺少提醒时补回一条', async () => {
    const { run } = harness();
    const summary = createUserMessage({
      content: [{ type: 'text', text: '历史摘要' }],
      source: { kind: 'user' },
    });
    const decision = await run(sessionStub([{ type: 'user/message', data: summary }]), [
      larkMessage(),
    ]);
    expect(decision.kind).toBe('enter');
    if (decision.kind !== 'enter') return;
    expect(decision.messages).toHaveLength(2);
    expect(decision.messages[0]?.source).toMatchObject({ reminder: true });
  });

  it('连续多次 pre-step 保持一条提醒', async () => {
    const { run } = harness();
    const first = await run(sessionStub(), [larkMessage()]);
    if (first.kind !== 'enter') throw new Error('expected enter');
    const reminder = first.messages[0];
    if (reminder === undefined) throw new Error('expected reminder');
    const session = sessionStub([{ type: 'user/message', data: reminder }]);
    const second = await run(session, [larkMessage('om_2')]);
    expect(second.kind === 'enter' && second.messages).toHaveLength(1);
  });
});
