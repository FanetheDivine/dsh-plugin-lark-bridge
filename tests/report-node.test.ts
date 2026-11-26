// 上报卡片节点测试：事件匹配、参数解析、回执判定与 Chat 节点产出。
import { describe, expect, it } from 'vitest';

import {
  buildReportNode,
  deliveryOf,
  parseReportArgs,
  REPORT_DEFINITION_KIND,
  REPORT_NODE_KIND,
  registerReportDefinition,
  reportDefinition,
} from '../src/client/report-node.ts';
import { makeClientCtx } from './helpers.ts';

type Event = Parameters<typeof deliveryOf>[0];

/** 一份完整的调用参数。 */
const ARGS = {
  kind: 'question',
  desc: '修复登录重试',
  text: '需要你决定重试次数。',
  files: ['/tmp/plan.md', 3, ''],
};

/** 构造 `tool/call` 事件。 */
function callEvent(seq: number, name = 'send_report', args: unknown = ARGS) {
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

/** 构造 `tool/result` 事件。 */
function resultEvent(
  seq: number,
  body: unknown,
  options: { isError?: boolean; surfaceOp?: string; callId?: string } = {},
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
        source: { kind: 'tool', callId: options.callId ?? 'call-1' },
        toolCallId: options.callId ?? 'call-1',
        content: [{ type: 'text', text: typeof body === 'string' ? body : JSON.stringify(body) }],
        isError: options.isError ?? false,
      },
    },
  } as unknown as Event;
}

/** 成功回执。 */
const RECEIPT = { reportId: 'report-9', taskId: 'task-1', delivered: true };

/** 由事件构造 Context 快照；位置取同一个对象，便于断言。 */
const LOCATION = { kind: 'step' } as const;
function contextOf(events: readonly unknown[], current?: unknown) {
  return {
    key: 'ctx-key',
    kind: REPORT_DEFINITION_KIND,
    id: 'call-1',
    matches: events.map((event) => ({ event, role: 'start', location: LOCATION })),
    start: undefined,
    state: null,
    current: new Map(current === undefined ? [] : [['chat', current]]),
  } as unknown as Parameters<typeof buildReportNode>[0];
}

describe('parseReportArgs', () => {
  it('读出四个字段，过滤非字符串与空文件', () => {
    expect(parseReportArgs(JSON.stringify(ARGS))).toEqual({
      kind: 'question',
      desc: '修复登录重试',
      text: '需要你决定重试次数。',
      files: ['/tmp/plan.md'],
    });
  });

  it('缺失、非法 JSON 与错误类型都退为空字段', () => {
    const empty = { kind: '', desc: '', text: '', files: [] };
    expect(parseReportArgs(undefined)).toEqual(empty);
    expect(parseReportArgs('{"kind":')).toEqual(empty);
    expect(parseReportArgs('42')).toEqual(empty);
    expect(parseReportArgs(JSON.stringify({ kind: 1, desc: null, files: 'x' }))).toEqual(empty);
  });
});

describe('deliveryOf', () => {
  it('成功投递返回上报编号', () => {
    expect(deliveryOf(resultEvent(2, RECEIPT))).toEqual({ reportId: 'report-9', taskId: 'task-1' });
  });

  it('错误结果、非 JSON、未送达与缺编号都不算成功', () => {
    expect(deliveryOf(resultEvent(2, RECEIPT, { isError: true }))).toBeNull();
    expect(deliveryOf(resultEvent(2, 'send_report requires a managed session'))).toBeNull();
    expect(deliveryOf(resultEvent(2, { ...RECEIPT, delivered: false }))).toBeNull();
    expect(deliveryOf(resultEvent(2, { delivered: true }))).toBeNull();
  });
});

describe('reportDefinition.match', () => {
  const match = reportDefinition.match as (event: unknown) => unknown;

  it('send_report 调用与成功结果都开启同一个 Context', () => {
    expect(match(callEvent(1))).toEqual({ id: 'call-1', role: 'start' });
    expect(match(resultEvent(2, RECEIPT))).toEqual({ id: 'call-1', role: 'start' });
  });

  it('其他工具、失败结果与替换副本都不匹配', () => {
    expect(match(callEvent(1, 'lark_notify'))).toBeNull();
    expect(match(resultEvent(2, RECEIPT, { isError: true }))).toBeNull();
    expect(match(resultEvent(2, RECEIPT, { surfaceOp: 'replace' }))).toBeNull();
    expect(match({ type: 'assistant/message' })).toBeNull();
  });
});

describe('buildReportNode', () => {
  it('成功结果产出轮次层级的卡片节点，紧跟结果之后', () => {
    const node = buildReportNode(contextOf([callEvent(1), resultEvent(5, RECEIPT)]));
    expect(node).toMatchObject({
      key: 'ctx-key',
      kind: REPORT_NODE_KIND,
      target: 'chat',
      visibility: 'visible',
      groupTree: 'turn',
      anchorSeq: 5.5,
      location: LOCATION,
      data: {
        kind: 'question',
        desc: '修复登录重试',
        text: '需要你决定重试次数。',
        files: ['/tmp/plan.md'],
        reportId: 'report-9',
      },
    });
  });

  it('只有调用、尚无成功结果时不产出节点', () => {
    expect(buildReportNode(contextOf([callEvent(1)]))).toBeNull();
  });

  it('调用不在窗口内时仍产出卡片，参数字段为空', () => {
    const node = buildReportNode(contextOf([resultEvent(5, RECEIPT)]));
    expect(node?.data).toEqual({ kind: '', desc: '', text: '', files: [], reportId: 'report-9' });
  });

  it('内容未变时复用上一次的节点，调用补载后重新解析', () => {
    const result = resultEvent(5, RECEIPT);
    const first = buildReportNode(contextOf([result]));
    expect(buildReportNode(contextOf([result], first))).toBe(first);
    const reloaded = buildReportNode(contextOf([callEvent(1), result], first));
    expect(reloaded).not.toBe(first);
    expect(reloaded?.data.desc).toBe('修复登录重试');
  });
});

describe('registerReportDefinition', () => {
  it('按事件类型注册调用与结果两个匹配，注销后移除', () => {
    const ctx = makeClientCtx();
    const dispose = registerReportDefinition(ctx);
    const definition = ctx._conversationDefinitions[0] as {
      kind: string;
      target: string;
      match: Record<string, unknown>;
    };
    expect(definition.kind).toBe(REPORT_DEFINITION_KIND);
    expect(definition.target).toBe('chat');
    expect(Object.keys(definition.match).sort()).toEqual(['tool/call', 'tool/result']);
    expect(ctx._activeConversationDefinitions.size).toBe(1);
    dispose();
    expect(ctx._activeConversationDefinitions.size).toBe(0);
  });
});
