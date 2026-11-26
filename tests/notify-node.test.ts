// lark_notify 正文卡片节点测试：成功识别、正文解析、历史窗口与 Chat 节点产出。
import { describe, expect, it } from 'vitest';

import {
  buildNotifyNode,
  isSuccessfulNotifyResult,
  NOTIFY_DEFINITION_KIND,
  NOTIFY_NODE_KIND,
  notifyDefinition,
  parseNotifyText,
  registerNotifyDefinition,
} from '../src/client/notify-node.ts';
import { makeClientCtx } from './helpers.ts';

type ResultEvent = Parameters<typeof isSuccessfulNotifyResult>[0];

/** 构造工具调用事件。 */
function callEvent(seq: number, name = 'lark_notify', args: unknown = { text: '第一行\n第二行' }) {
  return {
    type: 'tool/call',
    seq,
    time: seq,
    data: {
      turn: 1,
      step: 1,
      callId: 'call-1',
      name,
      arguments: typeof args === 'string' ? args : JSON.stringify(args),
    },
  };
}

/** 构造工具结果事件。 */
function resultEvent(
  seq: number,
  text = '已发送给用户（2 条）',
  options: { isError?: boolean; surfaceOp?: string } = {},
) {
  return {
    type: 'tool/result',
    seq,
    time: seq,
    surfaceOp: options.surfaceOp ?? 'append',
    data: {
      turn: 1,
      step: 1,
      message: {
        role: 'tool',
        source: { kind: 'tool', callId: 'call-1' },
        toolCallId: 'call-1',
        content: [{ type: 'text', text }],
        isError: options.isError ?? false,
      },
    },
  } as unknown as ResultEvent;
}

/** 构造 Definition Context。 */
const LOCATION = { kind: 'step' } as const;
function contextOf(events: readonly unknown[], current?: unknown) {
  return {
    key: 'ctx-key',
    kind: NOTIFY_DEFINITION_KIND,
    id: 'call-1',
    matches: events.map((event) => ({ event, role: 'start', location: LOCATION })),
    start: undefined,
    state: null,
    current: new Map(current === undefined ? [] : [['chat', current]]),
  } as unknown as Parameters<typeof buildNotifyNode>[0];
}

describe('parseNotifyText', () => {
  it('只读取 text 并保留完整换行', () => {
    expect(parseNotifyText(JSON.stringify({ text: '第一行\n第二行', reply_to: 'om_1' }))).toBe(
      '第一行\n第二行',
    );
  });

  it('缺失、非法 JSON 与非字符串正文都返回空字符串', () => {
    expect(parseNotifyText(undefined)).toBe('');
    expect(parseNotifyText('{"text":')).toBe('');
    expect(parseNotifyText('42')).toBe('');
    expect(parseNotifyText(JSON.stringify({ text: 3 }))).toBe('');
  });
});

describe('isSuccessfulNotifyResult', () => {
  it('只接受现有的两种成功结果', () => {
    expect(isSuccessfulNotifyResult(resultEvent(2))).toBe(true);
    expect(isSuccessfulNotifyResult(resultEvent(2, '已回复给用户（1 条）'))).toBe(true);
  });

  it('失败、其他文本与替换副本都不算成功', () => {
    expect(isSuccessfulNotifyResult(resultEvent(2, '发送失败（send-failed）：x'))).toBe(false);
    expect(
      isSuccessfulNotifyResult(resultEvent(2, '已发送给用户（1 条）', { isError: true })),
    ).toBe(false);
    expect(
      isSuccessfulNotifyResult(resultEvent(2, '已发送给用户（1 条）', { surfaceOp: 'replace' })),
    ).toBe(false);
  });
});

describe('notifyDefinition.match', () => {
  const match = notifyDefinition.match as (event: unknown) => unknown;

  it('调用与成功结果开启同一个 Context', () => {
    expect(match(callEvent(1))).toEqual({ id: 'call-1', role: 'start' });
    expect(match(resultEvent(2))).toEqual({ id: 'call-1', role: 'start' });
  });

  it('其他工具与失败结果不匹配', () => {
    expect(match(callEvent(1, 'send_report'))).toBeNull();
    expect(match(resultEvent(2, '发送失败（send-failed）：x'))).toBeNull();
    expect(match({ type: 'assistant/message' })).toBeNull();
  });
});

describe('buildNotifyNode', () => {
  it('成功结果与正文同时存在时产出轮次层级卡片', () => {
    const node = buildNotifyNode(contextOf([callEvent(1), resultEvent(5)]));
    expect(node).toMatchObject({
      key: 'ctx-key',
      kind: NOTIFY_NODE_KIND,
      target: 'chat',
      visibility: 'visible',
      groupTree: 'turn',
      anchorSeq: 5.5,
      location: LOCATION,
      data: { text: '第一行\n第二行' },
    });
  });

  it('进行中、空正文与历史缺调用都不产生空卡片', () => {
    expect(buildNotifyNode(contextOf([callEvent(1)]))).toBeNull();
    expect(
      buildNotifyNode(contextOf([callEvent(1, 'lark_notify', { text: '' }), resultEvent(2)])),
    ).toBeNull();
    expect(buildNotifyNode(contextOf([resultEvent(2)]))).toBeNull();
  });

  it('内容未变时复用节点，调用补载后重新解析', () => {
    const result = resultEvent(5);
    const call = callEvent(1);
    const first = buildNotifyNode(contextOf([call, result]));
    expect(buildNotifyNode(contextOf([call, result], first))).toBe(first);
    const changed = callEvent(1, 'lark_notify', { text: '补载后的正文' });
    const reloaded = buildNotifyNode(contextOf([changed, result], first));
    expect(reloaded).not.toBe(first);
    expect(reloaded?.data.text).toBe('补载后的正文');
  });
});

describe('registerNotifyDefinition', () => {
  it('注册调用与结果匹配，注销后移除', () => {
    const ctx = makeClientCtx();
    const dispose = registerNotifyDefinition(ctx);
    const definition = ctx._conversationDefinitions[0] as {
      kind: string;
      target: string;
      match: Record<string, unknown>;
    };
    expect(definition.kind).toBe(NOTIFY_DEFINITION_KIND);
    expect(definition.target).toBe('chat');
    expect(Object.keys(definition.match).sort()).toEqual(['tool/call', 'tool/result']);
    expect(ctx._activeConversationDefinitions.size).toBe(1);
    dispose();
    expect(ctx._activeConversationDefinitions.size).toBe(0);
  });
});
