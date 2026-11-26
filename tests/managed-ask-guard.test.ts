// 提问拦截测试：被管理会话代为上报并结束轮次；无 intercept 时退回拒绝并排队 S；等待中的提问可被结束。
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import {
  ASK_BLOCKED_ERROR,
  ASK_REPORTED_NOTICE,
  ASK_TOOL,
  AskGuard,
  type GatewayLike,
  questionReportText,
} from '../src/lark-super-agent/managed/ask-guard.ts';

/** 构造一个提问拦截器；默认只有 worker 被管理。 */
function makeGuard(
  options: {
    managed?: readonly string[];
    gateway?: GatewayLike | undefined;
    intercept?: (sessionId: string, questions: unknown) => Promise<void>;
  } = {},
) {
  const managed = new Set(options.managed ?? ['worker']);
  const warnings: unknown[][] = [];
  const guard = new AskGuard({
    isManaged: async (sessionId) => managed.has(sessionId),
    gateway: () => options.gateway,
    ...(options.intercept === undefined ? {} : { intercept: options.intercept }),
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
  });
  return { guard, warnings, managed };
}

/** 构造一次工具调用。 */
function makeExec(
  sessionId: string | undefined,
  name = ASK_TOOL,
  callId = 'call-1',
  questions?: unknown,
) {
  return {
    name,
    callId,
    signal: new AbortController().signal,
    concludeTurn: vi.fn(),
    ...(questions === undefined ? {} : { arguments: { questions } }),
    ...(sessionId === undefined ? {} : { agent: { session: { id: sessionId } } }),
  };
}

const allow = async () => ({ kind: 'allow' }) as const;
const answered = { isError: false, content: [{ type: 'text', text: 'yes' }] } as never;

/** 构造一个带 pendingRemoteEvents 与 cancelRemoteEvent 的假网关。 */
function makeGateway(
  pendings: Array<{ event: string; agentId: string }>,
  cancel: (pending: unknown, reason: unknown) => unknown = () => undefined,
) {
  const pendingRemoteEvents = new Map(
    pendings.map((frame, index) => [`event-${index}`, { frame }] as const),
  );
  const cancelRemoteEvent = vi.fn(function (this: unknown, pending: unknown, reason: unknown) {
    return cancel.call(this, pending, reason);
  });
  return { pendingRemoteEvents, cancelRemoteEvent };
}

describe('AskGuard 拒绝新提问', () => {
  it('被管理会话的提问一律拒绝并记下需要 S', async () => {
    const { guard } = makeGuard();
    await expect(guard.beforeExecute(makeExec('worker'), allow)).resolves.toEqual({
      kind: 'deny',
      reason: ASK_BLOCKED_ERROR,
    });
    expect(guard.takeRules('worker')).toBe(true);

    await expect(
      guard.beforeExecute(makeExec('worker', ASK_TOOL, 'call-2'), allow),
    ).resolves.toEqual({ kind: 'deny', reason: ASK_BLOCKED_ERROR });
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('待审批的提问改为拒绝，不再进入审批等待', async () => {
    const { guard } = makeGuard();
    const ask = async () => ({ kind: 'ask', reason: 'approval needed' }) as const;
    await expect(guard.beforeExecute(makeExec('worker'), ask)).resolves.toEqual({
      kind: 'deny',
      reason: ASK_BLOCKED_ERROR,
    });
    const cancelled = { kind: 'cancel' } as const;
    await expect(guard.beforeExecute(makeExec('worker'), async () => cancelled)).resolves.toBe(
      cancelled,
    );
  });

  it('未被管理、其他工具或会话缺失时保持原决策', async () => {
    const { guard } = makeGuard();
    await expect(guard.beforeExecute(makeExec('other'), allow)).resolves.toEqual({ kind: 'allow' });
    await expect(guard.beforeExecute(makeExec('worker', 'run_shell'), allow)).resolves.toEqual({
      kind: 'allow',
    });
    await expect(guard.beforeExecute(makeExec(undefined), allow)).resolves.toEqual({
      kind: 'allow',
    });
    const denied = { kind: 'deny', reason: 'host denied' } as const;
    await expect(guard.beforeExecute(makeExec('worker'), async () => denied)).resolves.toBe(denied);
    expect(guard.takeRules('worker')).toBe(false);
  });
});

describe('AskGuard 中止等待中的提问', () => {
  it('tools/execute 装上可中止信号，cancel 后中止并改写结果', async () => {
    const { guard } = makeGuard();
    const exec = makeExec('worker');
    const original = exec.signal;
    let seen: AbortSignal | undefined;
    const next = vi.fn(
      () =>
        new Promise<ToolExecutionResult>((resolve) => {
          seen = exec.signal;
          exec.signal.addEventListener('abort', () =>
            resolve({ isError: true, content: [{ type: 'text', text: 'aborted' }] } as never),
          );
        }),
    );

    const pending = guard.aroundExecute(exec, next);
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    expect(seen).not.toBe(original);
    expect(seen?.aborted).toBe(false);

    guard.cancel('worker');
    await pending;
    expect(seen?.aborted).toBe(true);
    expect(original.aborted).toBe(false);
    expect(exec.signal).toBe(original);
    expect(guard.takeRules('worker')).toBe(true);

    await expect(
      guard.afterExecute(exec, answered, async () => ({ kind: 'continue' }) as never),
    ).resolves.toEqual({ kind: 'block', feedback: [{ type: 'text', text: ASK_BLOCKED_ERROR }] });
    const passthrough = { kind: 'continue' } as never;
    await expect(guard.afterExecute(exec, answered, async () => passthrough)).resolves.toBe(
      passthrough,
    );
  });

  it('正常回答的提问不改写结果，信号恢复原值', async () => {
    const { guard } = makeGuard();
    const exec = makeExec('worker');
    const original = exec.signal;
    await expect(guard.aroundExecute(exec, async () => answered)).resolves.toBe(answered);
    expect(exec.signal).toBe(original);
    const passthrough = { kind: 'continue' } as never;
    await expect(guard.afterExecute(exec, answered, async () => passthrough)).resolves.toBe(
      passthrough,
    );
  });

  it('其他工具直接执行，不被装上信号', async () => {
    const { guard } = makeGuard();
    const exec = makeExec('worker', 'run_shell');
    const original = exec.signal;
    const next = vi.fn(async () => {
      expect(exec.signal).toBe(original);
      return answered;
    });
    await expect(guard.aroundExecute(exec, next)).resolves.toBe(answered);
    expect(next).toHaveBeenCalledOnce();
  });

  it('cancel 只中止目标会话的等待', async () => {
    const { guard } = makeGuard({ managed: ['worker', 'second'] });
    const worker = makeExec('worker');
    const second = makeExec('second', ASK_TOOL, 'call-2');
    const signals: AbortSignal[] = [];
    const hold = (exec: ReturnType<typeof makeExec>) =>
      new Promise<ToolExecutionResult>((resolve) => {
        signals.push(exec.signal);
        exec.signal.addEventListener('abort', () => resolve(answered));
      });
    const first = guard.aroundExecute(worker, () => hold(worker));
    const other = guard.aroundExecute(second, () => hold(second));
    await vi.waitFor(() => expect(signals).toHaveLength(2));

    guard.cancel('worker');
    await first;
    expect(signals[0]?.aborted).toBe(true);
    expect(signals[1]?.aborted).toBe(false);
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('second')).toBe(false);

    guard.cancel('second');
    await other;
  });
});

describe('AskGuard 网关取消', () => {
  it('cancel 只取消该会话等待中的提问请求', () => {
    const gateway = makeGateway([
      { event: 'user-questions/request', agentId: 'worker' },
      { event: 'user-questions/request', agentId: 'other' },
      { event: 'permission/request', agentId: 'worker' },
    ]);
    const { guard } = makeGuard({ gateway });
    guard.cancel('worker');
    expect(gateway.cancelRemoteEvent).toHaveBeenCalledOnce();
    const [pending, reason] = gateway.cancelRemoteEvent.mock.calls[0] ?? [];
    expect(pending).toBe(gateway.pendingRemoteEvents.get('event-0'));
    expect(reason).toBeInstanceOf(Error);
    expect((reason as Error).message).toBe(ASK_BLOCKED_ERROR);
    expect(gateway.cancelRemoteEvent.mock.contexts[0]).toBe(gateway);
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('other')).toBe(false);
  });

  it('没有等待中的请求时不排队 S', () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'other' }]);
    const { guard } = makeGuard({ gateway });
    guard.cancel('worker');
    expect(gateway.cancelRemoteEvent).not.toHaveBeenCalled();
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('网关缺失或结构不符时 cancel 不抛错也不记日志', () => {
    for (const gateway of [
      undefined,
      { pendingRemoteEvents: {}, cancelRemoteEvent: () => undefined },
      { pendingRemoteEvents: new Map() },
    ] as GatewayLike[]) {
      const { guard, warnings } = makeGuard({ gateway });
      expect(() => guard.cancel('worker')).not.toThrow();
      expect(warnings).toHaveLength(0);
      expect(guard.takeRules('worker')).toBe(false);
    }
  });

  it('取消抛错时只记日志，不排队 S', () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'worker' }], () => {
      throw new Error('gateway broke');
    });
    const { guard, warnings } = makeGuard({ gateway });
    expect(() => guard.cancel('worker')).not.toThrow();
    expect(String(warnings[0]?.[0])).toContain('gateway cancel failed');
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('sweep 只为被管理会话取消加载前已在等待的提问', async () => {
    const gateway = makeGateway([
      { event: 'user-questions/request', agentId: 'worker' },
      { event: 'user-questions/request', agentId: 'other' },
    ]);
    const { guard } = makeGuard({ gateway });
    await guard.sweep();
    expect(gateway.cancelRemoteEvent).toHaveBeenCalledOnce();
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('other')).toBe(false);
  });

  it('sweep 跳过非提问事件与没有会话标识的请求', async () => {
    const gateway = makeGateway([
      { event: 'permission/request', agentId: 'worker' },
      { event: 'user-questions/request', agentId: '' },
    ]);
    const { guard } = makeGuard({ gateway, managed: ['worker', ''] });
    await guard.sweep();
    expect(gateway.cancelRemoteEvent).not.toHaveBeenCalled();
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('网关不可用时 sweep 只记一条日志', async () => {
    const { guard, warnings } = makeGuard({ gateway: undefined });
    await expect(guard.sweep()).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0]?.[0])).toContain('cannot cancel a waiting question');
  });
});

describe('AskGuard.takeRules', () => {
  it('需要 S 的标记只生效一次', async () => {
    const { guard } = makeGuard({ managed: ['worker', 'second'] });
    expect(guard.takeRules('worker')).toBe(false);
    await guard.beforeExecute(makeExec('worker'), allow);
    await guard.beforeExecute(makeExec('worker', ASK_TOOL, 'call-2'), allow);
    expect(guard.takeRules('second')).toBe(false);
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('worker')).toBe(false);
  });
});

describe('AskGuard 拦截代为上报', () => {
  it('pre-execute 对被管理提问放行，交给环绕钩子', async () => {
    const { guard } = makeGuard({ intercept: async () => undefined });
    await expect(guard.beforeExecute(makeExec('worker'), allow)).resolves.toEqual({
      kind: 'allow',
    });
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('工具体不运行：代为上报、结束轮次并给出上报说明', async () => {
    const calls: Array<[string, unknown]> = [];
    const questions = [{ id: 'q1', question: '选哪个？' }];
    const { guard } = makeGuard({ intercept: async (s, q) => void calls.push([s, q]) });
    const exec = makeExec('worker', ASK_TOOL, 'call-9', questions);
    const next = vi.fn(async () => answered);
    const result = await guard.aroundExecute(exec as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(calls).toEqual([['worker', questions]]);
    expect(exec.concludeTurn).toHaveBeenCalledOnce();
    expect(result).toEqual({
      isError: false,
      value: { answers: [] },
      content: [{ type: 'text', text: ASK_REPORTED_NOTICE }],
    });
    await expect(
      guard.afterExecute(exec, result, async () => ({ kind: 'continue' }) as never),
    ).resolves.toEqual({ kind: 'accept', content: [{ type: 'text', text: ASK_REPORTED_NOTICE }] });
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('同一会话重复调用逐次拦截上报', async () => {
    const seen: string[] = [];
    const { guard } = makeGuard({ intercept: async (_s, q) => void seen.push(JSON.stringify(q)) });
    for (const callId of ['call-1', 'call-2']) {
      const exec = makeExec('worker', ASK_TOOL, callId, [{ id: callId, question: 'q' }]);
      await guard.aroundExecute(exec as never, async () => answered);
    }
    expect(seen).toHaveLength(2);
    expect(seen[0]).not.toBe(seen[1]);
  });

  it('投递失败退回拒绝反馈并排队 S，不改写结果', async () => {
    const { guard } = makeGuard({
      intercept: async () => {
        throw new Error('deliver failed');
      },
    });
    const exec = makeExec('worker');
    const next = vi.fn(async () => answered);
    const result = await guard.aroundExecute(exec as never, next);
    expect(next).not.toHaveBeenCalled();
    expect(exec.concludeTurn).not.toHaveBeenCalled();
    expect(result.isError).toBe(true);
    expect(guard.takeRules('worker')).toBe(true);
    const passthrough = { kind: 'continue' } as never;
    await expect(guard.afterExecute(exec, result, async () => passthrough)).resolves.toBe(
      passthrough,
    );
  });

  it('未被管理会话照常执行，不上报也不排队 S', async () => {
    const intercept = vi.fn(async () => undefined);
    const { guard } = makeGuard({ managed: [], intercept });
    const exec = makeExec('other');
    const original = exec.signal;
    await expect(guard.aroundExecute(exec as never, async () => answered)).resolves.toBe(answered);
    expect(intercept).not.toHaveBeenCalled();
    expect(exec.concludeTurn).not.toHaveBeenCalled();
    expect(exec.signal).toBe(original);
    expect(guard.takeRules('other')).toBe(false);
  });
});

describe('questionReportText 正文', () => {
  it('列出题面、表头、选项与多选标注', () => {
    const text = questionReportText([
      {
        id: 'a',
        question: '选 A 还是 B',
        header: '方案',
        options: [{ label: 'A（推荐）', description: 'x' }, { label: 'B' }],
      },
      { id: 'b', question: '还有什么要补充？', options: [], multi_select: true },
    ]);
    expect(text).toContain('- Q1 [方案]: 选 A 还是 B');
    expect(text).toContain('options: A（推荐） / B');
    expect(text).toContain('- Q2: 还有什么要补充？');
    expect(text).toContain('(multi-select)');
    expect(text).toContain('Reply in the dispatch session or in Lark');
  });

  it('异常输入回退为固定说明句', () => {
    for (const input of [undefined, [], 'x']) {
      expect(questionReportText(input)).toContain('needs your input');
    }
    const sparse = questionReportText([{}]);
    expect(sparse).toContain('(no question text)');
  });
});
