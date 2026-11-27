// 轮次结束自动上报测试：只在被管理会话正常结束、本轮未上报且无子代理时投递。
import { describe, expect, it, vi } from 'vitest';

import type { LarkSuperAgentService, Task } from '../src/lark-super-agent/api.ts';
import { assistantText, TurnReporter } from '../src/lark-super-agent/managed/turn-report.ts';
import { textBlock } from './helpers.ts';

/** 一条被管理任务。 */
const TASK = { id: 'task-20260101000000-0001', sessionId: 'worker' } as Task;

/** 假服务：记录 sendReport 调用；默认只有 worker 被管理。 */
function makeService(managed: readonly string[] = ['worker']) {
  const managedTask = vi.fn(async (sessionId: string) =>
    managed.includes(sessionId) ? { ...TASK, sessionId } : undefined,
  );
  const sendReport = vi.fn(async () => ({
    reportId: 'report-20260101000000-abcdef',
    taskId: TASK.id,
    delivered: true as const,
  }));
  return { managedTask, sendReport };
}

function makeReporter(
  options: {
    managed?: readonly string[];
    subagent?: boolean;
    failReport?: Error;
    undelivered?: boolean;
  } = {},
) {
  const service = makeService(options.managed);
  if (options.failReport !== undefined) service.sendReport.mockRejectedValue(options.failReport);
  if (options.undelivered === true) {
    service.sendReport.mockResolvedValue({
      reportId: 'report-20260101000000-abcdef',
      taskId: TASK.id,
      delivered: false,
      reason: 'delivery_failed: dispatch offline',
    } as never);
  }
  const warnings: unknown[][] = [];
  const reporter = new TurnReporter({
    service: service as unknown as LarkSuperAgentService,
    hasRunningSubagent: () => options.subagent ?? false,
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
  });
  return { reporter, service, warnings };
}

/** 等待 finish 中的异步链结束。 */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

const start = (turn: number) => ({ type: 'turn/start', data: { turn } });
const say = (turn: number, ...texts: string[]) => ({
  type: 'assistant/message',
  data: { turn, message: { role: 'assistant', content: texts.map(textBlock) } },
});
const toolCall = (turn: number, name: string) => ({ type: 'tool/call', data: { turn, name } });
const end = (turn: number, kind = 'completed') => ({
  type: 'turn/end',
  data: { turn, reason: { kind } },
});

/** 把一组事件按顺序交给 reporter。 */
async function play(reporter: TurnReporter, sessionId: string, events: unknown[]): Promise<void> {
  for (const event of events) reporter.observe(sessionId, event);
  await settle();
}

describe('TurnReporter 自动上报', () => {
  it('正常结束且未上报时把最后一段文本作为 turn_end 上报', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [
      start(1),
      say(1, 'first draft'),
      toolCall(1, 'read_file'),
      say(1, 'final', 'answer'),
      end(1),
    ]);
    expect(service.sendReport).toHaveBeenCalledExactlyOnceWith(
      { kind: 'progress', text: 'final\nanswer' },
      'worker',
      'turn_end',
    );
  });

  it('只有空白文本的助手消息不覆盖之前的文本', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), say(1, 'kept'), say(1, '   '), end(1)]);
    expect(service.sendReport).toHaveBeenCalledWith(
      { kind: 'progress', text: 'kept' },
      'worker',
      'turn_end',
    );
  });

  it('本轮已调用 send_report 时不投递', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), toolCall(1, 'send_report'), say(1, 'done'), end(1)]);
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it('上一轮的上报不影响下一轮', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), toolCall(1, 'send_report'), say(1, 'a'), end(1)]);
    await play(reporter, 'worker', [start(2), say(2, 'b'), end(2)]);
    expect(service.sendReport).toHaveBeenCalledExactlyOnceWith(
      { kind: 'progress', text: 'b' },
      'worker',
      'turn_end',
    );
  });

  it('仍有运行中的子代理时不投递', async () => {
    const { reporter, service } = makeReporter({ subagent: true });
    await play(reporter, 'worker', [start(1), say(1, 'waiting for subagent'), end(1)]);
    expect(service.managedTask).not.toHaveBeenCalled();
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it.each(['error', 'cancelled', 'aborted', ''])('结束原因为「%s」时不投递', async (kind) => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), say(1, 'partial'), end(1, kind)]);
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it('未被管理的会话不投递', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'other', [start(1), say(1, 'hello'), end(1)]);
    expect(service.managedTask).toHaveBeenCalledWith('other');
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it('最后文本为空时不投递', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), toolCall(1, 'read_file'), end(1)]);
    await play(reporter, 'worker', [start(2), say(2, '  \n '), end(2)]);
    expect(service.managedTask).not.toHaveBeenCalled();
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it('缺少 turn/start 时按事件中的轮次累计', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [start(1), say(1, 'stale'), say(2, 'fresh'), end(2)]);
    expect(service.sendReport).toHaveBeenCalledExactlyOnceWith(
      { kind: 'progress', text: 'fresh' },
      'worker',
      'turn_end',
    );
  });

  it('不同会话的轮次互不影响', async () => {
    const { reporter, service } = makeReporter({ managed: ['worker', 'second'] });
    reporter.observe('worker', start(1));
    reporter.observe('second', start(1));
    reporter.observe('second', toolCall(1, 'send_report'));
    reporter.observe('worker', say(1, 'worker text'));
    reporter.observe('second', say(1, 'second text'));
    reporter.observe('worker', end(1));
    reporter.observe('second', end(1));
    await settle();
    expect(service.sendReport).toHaveBeenCalledExactlyOnceWith(
      { kind: 'progress', text: 'worker text' },
      'worker',
      'turn_end',
    );
  });

  it('投递失败只记日志', async () => {
    const { reporter, warnings } = makeReporter({ failReport: new Error('dispatch offline') });
    await play(reporter, 'worker', [start(1), say(1, 'done'), end(1)]);
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0]?.[0])).toContain('turn-end report was not delivered');
    expect(warnings[0]?.[1]).toEqual(new Error('dispatch offline'));
  });

  it('上报未送达时只记日志', async () => {
    const { reporter, warnings, service } = makeReporter({ undelivered: true });
    await play(reporter, 'worker', [start(1), say(1, 'done'), end(1)]);
    expect(service.sendReport).toHaveBeenCalledOnce();
    expect(warnings).toHaveLength(1);
    expect(warnings[0]?.[1]).toBe('delivery_failed: dispatch offline');
  });

  it('忽略没有轮次号或不是对象的事件', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [
      null,
      'turn/end',
      { type: 'turn/end', data: { reason: { kind: 'completed' } } },
    ]);
    expect(service.sendReport).not.toHaveBeenCalled();
  });

  it('接受顶层携带 type 与轮次的事件', async () => {
    const { reporter, service } = makeReporter();
    await play(reporter, 'worker', [
      { type: 'turn/start', turn: 1 },
      { type: 'assistant/message', turn: 1, message: { content: [textBlock('flat')] } },
      { type: 'turn/end', turn: 1, reason: { kind: 'completed' } },
    ]);
    expect(service.sendReport).toHaveBeenCalledWith(
      { kind: 'progress', text: 'flat' },
      'worker',
      'turn_end',
    );
  });
});

describe('assistantText', () => {
  it('只拼接非空文本块', () => {
    expect(
      assistantText([
        textBlock('a'),
        { type: 'tool_use', id: 'x' },
        textBlock(''),
        { type: 'text', text: 1 },
        null,
        textBlock('b'),
      ]),
    ).toBe('a\nb');
    expect(assistantText(undefined)).toBe('');
    expect(assistantText('text')).toBe('');
  });
});
