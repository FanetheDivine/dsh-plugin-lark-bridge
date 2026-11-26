// 全局行测试：共享服务归属当前 fiber，被管理会话能力随行注册与注销。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apply, Config, inject } from '../src/lark-super-agent/index.ts';
import { ASK_BLOCKED_ERROR, ASK_TOOL } from '../src/lark-super-agent/managed/ask-guard.ts';
import { SEND_REPORT_DESCRIPTION } from '../src/lark-super-agent/managed/report-tool.ts';
import {
  TASK_RULES_SOURCE_KIND,
  TASK_RULES_TEXT,
} from '../src/lark-super-agent/managed/task-rules.ts';
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
});

afterEach(() => {
  const home = process.env['DSH_HOME'];
  if (home !== undefined) rmSync(home, { recursive: true, force: true });
  delete process.env['DSH_HOME'];
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
  it('声明 tools 依赖，宿主据此允许读取工具注册表', () => {
    expect(inject).toContain('tools');
  });

  it('提供 larkSuperAgent 服务', () => {
    const { provided, service } = startRow();
    expect(provided).toHaveLength(1);
    expect(provided[0]?.[0]).toBe('larkSuperAgent');
    expect(service).toBeInstanceOf(SuperAgentService);
  });

  it('旧在场配置键被忽略', () => {
    const { service } = startRow({
      config: {
        guiInputSetsLocal: false,
        larkInputSetsRemote: false,
        presenceAlarms: [{ id: 'a', time: '09:00', action: 'remote' }],
        commonTaskProvider: 'deepseek',
        commonTaskModel: 'deepseek-chat',
      },
    });
    expect(service.taskModel('common')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
    });
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

  it('taskModel 与 taskPreset 读取行配置的实时值，支持按任务类型与默认任务类型读取', () => {
    const { service } = startRow({
      config: {
        commonTaskProvider: 'deepseek',
        commonTaskModel: 'deepseek-chat',
        commonTaskEffort: 'low',
        complexTaskProvider: 'anthropic',
        complexTaskModel: 'claude-opus',
        complexTaskEffort: 'high',
        defaultTaskType: 'complex',
        taskPreset: 'task-session',
      },
    });
    expect(service.taskModel()).toEqual({
      provider: 'anthropic',
      model: 'claude-opus',
      reasoningEffort: 'high',
    });
    expect(service.taskModel('common')).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'low',
    });
    expect(service.taskModel('complex')).toEqual({
      provider: 'anthropic',
      model: 'claude-opus',
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

  it('send_report 描述规定上报送达后正文只作简短收尾', () => {
    expect(SEND_REPORT_DESCRIPTION).toContain('Call it only when you are asked to report');
    expect(SEND_REPORT_DESCRIPTION).toContain('relays it to the user');
    expect(SEND_REPORT_DESCRIPTION).toContain('a second copy of it');
    expect(SEND_REPORT_DESCRIPTION).toContain('at most one short closing line');
    expect(SEND_REPORT_DESCRIPTION).toContain('An empty body is fine');
    expect(SEND_REPORT_DESCRIPTION).toContain('belong in the report alone');
    expect(SEND_REPORT_DESCRIPTION).toContain('When a report was not delivered');
    expect(SEND_REPORT_DESCRIPTION).not.toContain('never in both');
    expect(SEND_REPORT_DESCRIPTION).not.toMatch(/card/i);
  });

  it('临时指令与 send_report 描述同口径要求正文收尾', () => {
    expect(TASK_RULES_TEXT).toContain('Put everything for the user in the report');
    expect(TASK_RULES_TEXT).toContain('at most one short closing line, or stays empty');
    expect(TASK_RULES_TEXT).not.toContain('Keep the response body minimal');
    expect(TASK_RULES_TEXT).not.toMatch(/card/i);
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

  it('被管理会话的提问被拒后，下一次模型请求前注入一次 S', async () => {
    const workspaceRoot = join(process.env['DSH_HOME'] ?? '', 'dispatch');
    mkdirSync(workspaceRoot, { recursive: true });
    writeBridgeState({ workspaceRoot, sessionId: 'dispatch' });
    writeManagedTask(workspaceRoot, 'worker', 'task-20260101000000-0001');
    const { base } = startRow();

    const beforeExecute = base._onCallbacks.get('tools/pre-execute')?.[0];
    if (beforeExecute === undefined) throw new Error('missing tools/pre-execute listener');
    const exec = { name: ASK_TOOL, callId: 'call-1', agent: { session: { id: 'worker' } } };
    await expect(beforeExecute(exec, async () => ({ kind: 'allow' }))).resolves.toEqual({
      kind: 'deny',
      reason: ASK_BLOCKED_ERROR,
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
