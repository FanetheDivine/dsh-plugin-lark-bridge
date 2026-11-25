// 提问拦截测试：离开期间拒绝、中止与取消被管理会话的 ask_user_question。
import type { ToolExecutionResult } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import {
  ASK_TOOL,
  AskGuard,
  AWAY_ERROR,
  type GatewayLike,
} from '../src/lark-super-agent/managed/ask-guard.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';

/** 构造一个提问拦截器；默认只有 worker 被管理。 */
function makeGuard(
  options: { managed?: readonly string[]; gateway?: GatewayLike | undefined } = {},
) {
  const presence = new PresenceStore({
    switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
  });
  const managed = new Set(options.managed ?? ['worker']);
  const warnings: unknown[][] = [];
  const guard = new AskGuard({
    presence,
    isManaged: async (sessionId) => managed.has(sessionId),
    gateway: () => options.gateway,
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
  });
  return { guard, presence, warnings };
}

/** 构造一次工具调用。 */
function makeExec(sessionId: string | undefined, name = ASK_TOOL, callId = 'call-1') {
  return {
    name,
    callId,
    signal: new AbortController().signal,
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
  it('离开时拒绝被管理会话的提问并记下需要 S', async () => {
    const { guard, presence } = makeGuard();
    presence.set('remote');
    await expect(guard.beforeExecute(makeExec('worker'), allow)).resolves.toEqual({
      kind: 'deny',
      reason: AWAY_ERROR,
    });
    expect(guard.takeRules('worker')).toBe(true);
  });

  it('在电脑旁、未被管理或其他工具时保持原决策', async () => {
    const { guard, presence } = makeGuard();
    await expect(guard.beforeExecute(makeExec('worker'), allow)).resolves.toEqual({
      kind: 'allow',
    });
    presence.set('remote');
    await expect(guard.beforeExecute(makeExec('other'), allow)).resolves.toEqual({
      kind: 'allow',
    });
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
  it('tools/execute 装上可中止信号，切为离开时中止并改写结果', async () => {
    const { guard, presence } = makeGuard();
    const stop = guard.start();
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

    presence.set('remote');
    await pending;
    expect(seen?.aborted).toBe(true);
    expect(original.aborted).toBe(false);
    expect(exec.signal).toBe(original);
    expect(guard.takeRules('worker')).toBe(true);

    await expect(
      guard.afterExecute(exec, answered, async () => ({ kind: 'continue' }) as never),
    ).resolves.toEqual({ kind: 'block', feedback: [{ type: 'text', text: AWAY_ERROR }] });
    const passthrough = { kind: 'continue' } as never;
    await expect(guard.afterExecute(exec, answered, async () => passthrough)).resolves.toBe(
      passthrough,
    );
    stop();
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

  it('未被管理的会话与其他工具直接执行', async () => {
    const { guard } = makeGuard();
    for (const exec of [makeExec('other'), makeExec('worker', 'run_shell')]) {
      const original = exec.signal;
      const next = vi.fn(async () => {
        expect(exec.signal).toBe(original);
        return answered;
      });
      await expect(guard.aroundExecute(exec, next)).resolves.toBe(answered);
      expect(next).toHaveBeenCalledOnce();
    }
  });

  it('离开期间 tools/execute 直接返回离开错误', async () => {
    const { guard, presence } = makeGuard();
    presence.set('remote');
    const next = vi.fn(async () => answered);
    await expect(guard.aroundExecute(makeExec('worker'), next)).resolves.toEqual({
      isError: true,
      error: { code: 'ASK_ABORTED', message: AWAY_ERROR },
      content: [{ type: 'text', text: AWAY_ERROR }],
    });
    expect(next).not.toHaveBeenCalled();
    expect(guard.takeRules('worker')).toBe(true);

    await expect(guard.aroundExecute(makeExec('other'), next)).resolves.toBe(answered);
  });

  it('取消订阅后切为离开不再中止', async () => {
    const { guard, presence } = makeGuard();
    guard.start()();
    const exec = makeExec('worker');
    let seen: AbortSignal | undefined;
    let finish: () => void = () => undefined;
    const pending = guard.aroundExecute(
      exec,
      () =>
        new Promise<ToolExecutionResult>((resolve) => {
          seen = exec.signal;
          finish = () => resolve(answered);
        }),
    );
    await vi.waitFor(() => expect(seen).toBeDefined());
    presence.set('remote');
    expect(seen?.aborted).toBe(false);
    finish();
    await expect(pending).resolves.toBe(answered);
  });
});

describe('AskGuard 网关取消', () => {
  it('只取消该会话等待中的提问请求', () => {
    const gateway = makeGateway([
      { event: 'user-questions/request', agentId: 'worker' },
      { event: 'user-questions/request', agentId: 'other' },
      { event: 'permission/request', agentId: 'worker' },
    ]);
    const { guard } = makeGuard({ gateway });
    guard.cancelPending('worker');
    expect(gateway.cancelRemoteEvent).toHaveBeenCalledOnce();
    const [pending, reason] = gateway.cancelRemoteEvent.mock.calls[0] ?? [];
    expect(pending).toBe(gateway.pendingRemoteEvents.get('event-0'));
    expect(reason).toBeInstanceOf(Error);
    expect((reason as Error).message).toBe(AWAY_ERROR);
    expect(gateway.cancelRemoteEvent.mock.contexts[0]).toBe(gateway);
    expect(guard.takeRules('worker')).toBe(true);
  });

  it('切为离开时中止等待中的调用并取消网关中残留的请求', async () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'worker' }]);
    const { guard, presence } = makeGuard({ gateway });
    const exec = makeExec('worker');
    const next = vi.fn(
      () =>
        new Promise<ToolExecutionResult>((resolve) => {
          exec.signal.addEventListener('abort', () => resolve(answered));
        }),
    );
    const pending = guard.aroundExecute(exec, next);
    const stop = guard.start();
    await vi.waitFor(() => expect(next).toHaveBeenCalledOnce());
    presence.set('remote');
    await pending;
    expect(gateway.cancelRemoteEvent).toHaveBeenCalledOnce();
    stop();
  });

  it('离开期间的新调用取消插件加载前就已在网关等待的请求', async () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'worker' }]);
    const { guard, presence } = makeGuard({ gateway });
    presence.set('remote');
    await guard.aroundExecute(makeExec('worker'), async () => answered);
    expect(gateway.cancelRemoteEvent).toHaveBeenCalledOnce();
  });

  it('没有等待中的请求时不调用取消，也不要求 S', () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'other' }]);
    const { guard } = makeGuard({ gateway });
    guard.cancelPending('worker');
    expect(gateway.cancelRemoteEvent).not.toHaveBeenCalled();
    expect(guard.takeRules('worker')).toBe(false);
  });

  it('网关缺失或结构不符时只记日志不抛错', () => {
    for (const gateway of [
      undefined,
      { pendingRemoteEvents: {}, cancelRemoteEvent: () => undefined },
      { pendingRemoteEvents: new Map() },
    ] as GatewayLike[]) {
      const { guard, warnings } = makeGuard({ gateway });
      expect(() => guard.cancelPending('worker')).not.toThrow();
      expect(warnings).toHaveLength(1);
      expect(String(warnings[0]?.[0])).toContain('cannot cancel a waiting question');
      expect(warnings[0]?.[1]).toEqual({ sessionId: 'worker' });
    }
  });

  it('取消抛错时只记日志', () => {
    const gateway = makeGateway([{ event: 'user-questions/request', agentId: 'worker' }], () => {
      throw new Error('gateway broke');
    });
    const { guard, warnings } = makeGuard({ gateway });
    expect(() => guard.cancelPending('worker')).not.toThrow();
    expect(String(warnings[0]?.[0])).toContain('gateway cancel failed');
    expect(guard.takeRules('worker')).toBe(false);
  });
});

describe('AskGuard.takeRules', () => {
  it('需要 S 的标记只生效一次', async () => {
    const { guard, presence } = makeGuard({ managed: ['worker', 'second'] });
    expect(guard.takeRules('worker')).toBe(false);
    presence.set('remote');
    await guard.beforeExecute(makeExec('worker'), allow);
    await guard.beforeExecute(makeExec('worker', ASK_TOOL, 'call-2'), allow);
    expect(guard.takeRules('second')).toBe(false);
    expect(guard.takeRules('worker')).toBe(true);
    expect(guard.takeRules('worker')).toBe(false);
  });
});
