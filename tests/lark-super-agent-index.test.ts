// 全局行测试：共享服务归属当前 fiber，被管理会话能力与在场状态路由随行注册与注销。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readPresenceAlarms, readPresenceSwitches } from '../src/lark-super-agent/config.ts';
import { apply, Config } from '../src/lark-super-agent/index.ts';
import { ASK_TOOL, AWAY_ERROR } from '../src/lark-super-agent/managed/ask-guard.ts';
import { TASK_RULES_SOURCE_KIND } from '../src/lark-super-agent/managed/task-rules.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { PRESENCE_PATH } from '../src/lark-super-agent/routes.ts';
import { SuperAgentService } from '../src/lark-super-agent/service.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

type RowCtx = ReturnType<typeof makeCtx>;

/** 一条生成的决策。 */
interface Decision {
  kind: string;
  messages?: unknown[];
}

// 行启用时会取一次节假日数据：隔离状态目录并让网络直接失败，避免写入真实目录。
beforeEach(() => {
  process.env['DSH_HOME'] = mkdtempSync(join(tmpdir(), 'rdt-053-dsh-'));
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => {
      throw new Error('offline');
    }),
  );
});

afterEach(() => {
  const home = process.env['DSH_HOME'];
  if (home !== undefined) rmSync(home, { recursive: true, force: true });
  delete process.env['DSH_HOME'];
  vi.unstubAllGlobals();
});

/** 写入桥接状态。 */
function writeBridgeState(state: {
  workspaceRoot?: string | null;
  sessionId?: string | null;
}): void {
  const home = process.env['DSH_HOME'] ?? '';
  mkdirSync(join(home, 'lark-bridge'), { recursive: true });
  writeFileSync(join(home, 'lark-bridge', 'state.json'), JSON.stringify(state), 'utf8');
}

/** 在任务台账中为一个会话写入被管理任务。 */
function writeManagedTask(workspaceRoot: string, sessionId: string, taskId: string): void {
  const at = '2026-01-01T00:00:00+08:00';
  writeFileSync(
    join(workspaceRoot, 'message-task-status.json'),
    JSON.stringify({
      version: 2,
      tasks: [
        {
          id: taskId,
          title: '被管理的会话',
          status: 'in_progress',
          sessionId,
          workspaceId: 'workspace-a',
          cwd: '/project',
          reportIds: [],
          messages: [{ text: 'start', time: at }],
          createdAt: at,
          updatedAt: at,
        },
      ],
    }),
    'utf8',
  );
}

/** 在公共 ctx 模拟上补充 provide 与 inject，并记录两者的调用。 */
function makeRowCtx(services: Record<string, unknown> = {}) {
  const base = makeCtx({ services });
  const provided: Array<[string, unknown]> = [];
  const injected: string[][] = [];
  const ctx = Object.assign(base, {
    provide(name: string, value: unknown) {
      provided.push([name, value]);
      return () => undefined;
    },
    inject(deps: string[], callback: (scoped: unknown) => void) {
      injected.push([...deps]);
      if (deps.every((dep) => base.get(dep) !== undefined)) callback(ctx);
      return () => true;
    },
  });
  return { ctx: ctx as unknown as Context, base, provided, injected };
}

/** 启动一行并返回它的服务实例。 */
function startRow(
  options: { services?: Record<string, unknown>; config?: unknown } = {},
): { base: RowCtx; service: SuperAgentService } & ReturnType<typeof makeRowCtx> {
  const row = makeRowCtx(options.services ?? {});
  apply(row.ctx, options.config);
  const service = row.provided[0]?.[1] as SuperAgentService;
  return { ...row, service };
}

/** 按注册顺序串起 agent/pre-step 监听，末端返回给定决策。 */
async function runPreStep(
  base: RowCtx,
  payload: unknown,
  decide: () => Promise<Decision>,
): Promise<Decision> {
  const listeners = base._onCallbacks.get('agent/pre-step') ?? [];
  let next: () => Promise<Decision> = decide;
  for (const listener of [...listeners].reverse()) {
    const after = next;
    next = async () => (await listener(payload, after)) as Decision;
  }
  return next();
}

/** 构造一条带来源的文本消息。 */
function sourcedMessage(kind: string, text = 'hello') {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind },
  };
}

const enterWith = (messages: unknown[]) => async () => ({ kind: 'enter', messages });

describe('lark-super-agent 全局行', () => {
  it('提供带在场状态的 larkSuperAgent', () => {
    const { provided, service } = startRow();
    expect(provided).toHaveLength(1);
    expect(provided[0]?.[0]).toBe('larkSuperAgent');
    expect(service).toBeInstanceOf(SuperAgentService);
    expect(service.presence).toBeInstanceOf(PresenceStore);
    expect(service.presence.get().presence).toBe('local');
  });

  it('导出两个默认开启的开关与空的闹钟列表', () => {
    const config = Config({});
    expect(readPresenceSwitches(config)).toEqual({
      guiInputSetsLocal: true,
      larkInputSetsRemote: true,
    });
    expect(readPresenceAlarms(config)).toEqual([]);
  });

  it('到点调度随行启停', () => {
    vi.useFakeTimers();
    try {
      const { base, ctx } = makeRowCtx();
      apply(ctx);
      expect(vi.getTimerCount()).toBe(1);
      base._dispose();
      expect(vi.getTimerCount()).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('webServer 作为可选依赖等待就绪', () => {
    const { injected } = startRow();
    expect(injected).toEqual([['webServer']]);
  });

  it('有 webServer 时注册在场状态路由，卸载时注销', () => {
    const routes = new Set<string>();
    const webServer = {
      getOrigin: () => 'http://127.0.0.1:1',
      register: (route: { path: string }) => {
        routes.add(route.path);
        return () => routes.delete(route.path);
      },
    };
    const { base } = startRow({ services: { webServer } });
    expect([...routes]).toEqual([PRESENCE_PATH]);
    base._dispose();
    expect(routes.size).toBe(0);
  });

  it('全局 pre-step 观察任一会话的输入，reject 不观察', async () => {
    const { base, service } = startRow();
    const payload = { agent: { session: { id: 'any' } } };
    const lark = sourcedMessage('lark-bridge');
    await runPreStep(base, payload, async () => ({ kind: 'reject', messages: [lark] }));
    expect(service.presence.get().presence).toBe('local');
    const decision = { kind: 'enter', messages: [sourcedMessage('lark-bridge')] };
    expect(await runPreStep(base, payload, async () => decision)).toBe(decision);
    expect(service.presence.get().presence).toBe('remote');
  });

  it('pre-step 把调度会话转来的消息包进 dispatch_session_message', async () => {
    const { base } = startRow();
    const dispatched = sourcedMessage('dsh-plugin-meta-tools', 'run the tests');
    const result = await runPreStep(
      base,
      { agent: { session: { id: 'worker' } } },
      enterWith([dispatched]),
    );
    const first = result.messages?.[0] as { content: { text: string }[] } | undefined;
    expect(first?.content.map((block) => block.text).join('')).toBe(
      '<dispatch_session_message>\nrun the tests\n</dispatch_session_message>',
    );
  });

  it('开关读取行配置的实时值', () => {
    const { service } = startRow({
      config: { guiInputSetsLocal: true, larkInputSetsRemote: false },
    });
    service.presence.observe([
      { role: 'user', content: [], source: { kind: 'lark-bridge' } },
    ] as never);
    expect(service.presence.get().presence).toBe('local');
  });

  it('taskModel 与 taskPreset 读取行配置的实时值', () => {
    const { service } = startRow({
      config: {
        taskProvider: 'deepseek',
        taskModel: 'deepseek-chat',
        taskEffort: 'high',
        taskPreset: 'task-session',
      },
    });
    expect(service.taskModel()).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    expect(service.taskPreset()).toBe('task-session');
  });

  it('未配置模型时 taskModel 为空、taskPreset 为空串', () => {
    const { service } = startRow();
    expect(service.taskModel()).toBeUndefined();
    expect(service.taskPreset()).toBe('');
  });

  it('send_report 对除调度会话外的会话可见', async () => {
    writeBridgeState({ workspaceRoot: null, sessionId: 'dispatch' });
    const { base } = startRow();
    const visibleFor = (sessionId?: string) =>
      base._toolWhen(
        'send_report',
        sessionId === undefined ? {} : { agent: { session: { id: sessionId } } },
      );
    await expect(visibleFor('worker')).resolves.toBe(true);
    await expect(visibleFor('dispatch')).resolves.toBe(false);
    await expect(visibleFor('')).resolves.toBe(false);
    await expect(visibleFor()).resolves.toBe(false);
  });

  it('没有调度会话时 send_report 对所有会话可见', async () => {
    const { base } = startRow();
    await expect(
      base._toolWhen('send_report', { agent: { session: { id: 'dispatch' } } }),
    ).resolves.toBe(true);
  });

  it('归档被管理会话时通知调度会话', () => {
    const { base, service } = startRow();
    const notify = vi.spyOn(service, 'notifyArchived').mockResolvedValue(undefined);
    base._emit('workspace/session-archived', { sessionId: 'worker' });
    expect(notify).toHaveBeenCalledExactlyOnceWith('worker');
    base._emit('workspace/session-archived', { sessionId: '' });
    base._emit('workspace/session-archived', {});
    expect(notify).toHaveBeenCalledOnce();
  });

  it('轮次以错误结束时通知被管理会话', () => {
    const { base, service } = startRow();
    const notify = vi.spyOn(service, 'notifyFailure').mockResolvedValue(undefined);
    const session = { id: 'worker' };
    base._emit('session/event', session, {
      type: 'turn/end',
      data: { turn: 1, reason: { kind: 'error', error: 'boom' } },
    });
    expect(notify).toHaveBeenCalledExactlyOnceWith('worker', 'boom');
    base._emit('session/event', session, {
      type: 'turn/end',
      data: { turn: 2, reason: { kind: 'completed' } },
    });
    expect(notify).toHaveBeenCalledOnce();
  });

  it('离开期间提问被拒后，下一次模型请求前注入一次 S', async () => {
    const workspaceRoot = join(process.env['DSH_HOME'] ?? '', 'dispatch');
    mkdirSync(workspaceRoot, { recursive: true });
    writeBridgeState({ workspaceRoot, sessionId: 'dispatch' });
    writeManagedTask(workspaceRoot, 'worker', 'task-20260101000000-0001');
    const { base, service } = startRow();
    service.presence.set('remote');

    const beforeExecute = base._onCallbacks.get('tools/pre-execute')?.[0];
    if (beforeExecute === undefined) throw new Error('missing tools/pre-execute listener');
    const exec = { name: ASK_TOOL, callId: 'call-1', agent: { session: { id: 'worker' } } };
    await expect(beforeExecute(exec, async () => ({ kind: 'allow' }))).resolves.toEqual({
      kind: 'deny',
      reason: AWAY_ERROR,
    });

    const messages = [sourcedMessage('user')];
    const injected = await runPreStep(
      base,
      { agent: { session: { id: 'worker' } } },
      enterWith(messages),
    );
    expect(injected.messages).toHaveLength(2);
    const rules = injected.messages?.[0] as { source: { kind: string } } | undefined;
    expect(rules?.source.kind).toBe(TASK_RULES_SOURCE_KIND);
    expect(injected.messages?.[1]).toBe(messages[0]);

    const again = await runPreStep(
      base,
      { agent: { session: { id: 'worker' } } },
      enterWith(messages),
    );
    expect(again.messages).toHaveLength(1);
  });
});
