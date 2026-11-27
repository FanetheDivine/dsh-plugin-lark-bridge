// 提问拦截测试：被管理会话的提问以 S 作答；等待中的提问可被结束。
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import {
  ASK_BLOCKED_ERROR,
  ASK_TOOL,
  AskGuard,
  type GatewayLike,
} from '../src/lark-super-agent/managed/ask-guard.ts';
import { TASK_RULES_TEXT } from '../src/lark-super-agent/managed/task-rules.ts';

/** 构造一个提问拦截器；默认只有 worker 被管理。 */
function makeGuard(
  options: { managed?: readonly string[]; gateway?: GatewayLike | undefined } = {},
) {
  const managed = new Set(options.managed ?? ['worker']);
  const warnings: unknown[][] = [];
  const guard = new AskGuard({
    isManaged: async (sessionId) => managed.has(sessionId),
    gateway: () => options.gateway,
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

describe('AskGuard 放行被管理会话的提问', () => {
  it('被管理会话的提问放行给环绕钩子，不排队 S', async () => {
    const { guard } = makeGuard();
    await expect(guard.beforeExecute(makeExec('worker'), allow)).resolves.toEqual({
      kind: 'allow',
    });
    expect(guard.takeRules('worker')).toBe(false);

    await expect(
      guard.beforeExecute(makeExec('worker', ASK_TOOL, 'call-2'), allow),
    ).resolves.toEqual({ kind: 'allow' });
  });

  it('待审批的提问改为放行，不再进入审批等待', async () => {
    const { guard } = makeGuard();
    const ask = async () => ({ kind: 'ask', reason: 'approval needed' }) as const;
    await expect(guard.beforeExecute(makeExec('worker'), ask)).resolves.toEqual({
      kind: 'allow',
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

describe('AskGuard 以 S 作答', () => {
  it('并发调用只改写各自的结果，不依赖 callId 是否相同', async () => {
    const { guard } = makeGuard({ managed: ['worker', 'second'] });
    const worker = makeExec('worker');
    const second = makeExec('second');
    const other = makeExec('other');
    const next = vi.fn(async () => answered);
    await Promise.all([worker, other, second].map((exec) => guard.aroundExecute(exec, next)));
    expect(next).toHaveBeenCalledOnce();

    const accept = { kind: 'accept' } as const;
    for (const exec of [other, second, worker]) {
      const result = await guard.afterExecute(exec, answered, async () => accept);
      expect(result).toEqual(
        exec === other ? accept : { ...accept, content: [{ type: 'text', text: TASK_RULES_TEXT }] },
      );
    }
    expect(guard.takeRules('worker')).toBe(false);
    expect(guard.takeRules('second')).toBe(false);
  });

  it('保留宿主对以 S 作答的调用产生的错误结果', async () => {
    const { guard } = makeGuard();
    const exec = makeExec('worker');
    await guard.aroundExecute(exec, async () => answered);
    const accept = { kind: 'accept' } as const;
    const error = { isError: true, error: { message: 'aborted' }, content: [] } as const;
    await expect(guard.afterExecute(exec, error, async () => accept)).resolves.toBe(accept);
  });
});

describe('AskGuard 中止等待中的提问', () => {
  it('tools/execute 装上可中止信号，cancel 后中止并改写结果', async () => {
    const { guard } = makeGuard({ managed: [] });
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
    const { guard } = makeGuard({ managed: [] });
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
    const { guard } = makeGuard({ managed: [] });
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
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'second' }]);
    const { guard } = makeGuard({ gateway });
    guard.cancel('second');
    expect(guard.takeRules('worker')).toBe(false);
    expect(guard.takeRules('second')).toBe(true);
    expect(guard.takeRules('second')).toBe(false);
  });
});
