// SA-工作会话子行测试：send_report 调用方寻址、提示词、调度消息包装与失败事件过滤。
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import { ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import type { LarkSuperAgentService } from '../src/lark-super-agent/api.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { wrapDispatchMessages } from '../src/sa-worker/dispatch-message.ts';
import { apply, name } from '../src/sa-worker/index.ts';
import { SA_WORKER_PROMPT } from '../src/sa-worker/prompt.ts';
import type { Context } from '../src/types.ts';
import { type FakeSurfaceSession, makeCtx, makeSurfaceSession } from './helpers.ts';

/** 可替换的宿主侧副作用：冻结消息。 */
const hostMocks = vi.hoisted(() => ({
  freezeMessage: vi.fn((message: unknown) => Object.freeze(message as object)),
}));

vi.mock('../src/sa-worker/host.ts', () => hostMocks);

interface PromptSectionLike {
  name: string;
  order: number;
  text: string;
}

function makeService() {
  return {
    createTask: vi.fn(),
    updateTask: vi.fn(),
    setWorkspaceNote: vi.fn(),
    removeWorkspaceNote: vi.fn(),
    listCandidates: vi.fn(),
    sendReport: vi.fn(),
    notifyFailure: vi.fn().mockResolvedValue(undefined),
    workerModel: () => undefined,
    presence: new PresenceStore({
      switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
    }),
  } satisfies LarkSuperAgentService;
}

function mount() {
  const base = makeCtx();
  const service = makeService();
  const sections: PromptSectionLike[] = [];
  const groups: string[][] = [];
  const injected = Object.assign(base, {
    larkSuperAgent: service,
    systemPrompt: {
      section(section: PromptSectionLike) {
        sections.push(section);
        return () => true;
      },
    },
  });
  const ctx = Object.assign(injected, {
    inject(deps: string[], callback: (context: unknown) => void) {
      groups.push([...deps]);
      callback(injected);
      return () => true;
    },
  });
  apply(ctx as unknown as Context);
  return { base, service, sections, groups };
}

function reportTool(base: ReturnType<typeof makeCtx>): ToolDefinition {
  const definition = (base._registeredTools as unknown as ToolDefinition[]).find(
    (entry) => entry.name === 'send_report',
  );
  if (definition === undefined) throw new Error('missing send_report');
  return definition;
}

function exec(sessionId?: string) {
  return {
    agent: sessionId === undefined ? undefined : { session: { id: sessionId } },
  } as never;
}

/** 构造一条带来源的文本消息。 */
function sourcedMessage(kind: string, text = 'task requirements'): UserMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: [{ type: 'text', text }],
    source: { kind },
  } as unknown as UserMessage;
}

/** 拼接消息中全部文本块。 */
function messageText(message: UserMessage | undefined): string {
  return (message?.content ?? [])
    .map((block) => (block.type === 'text' ? block.text : ''))
    .join('');
}

/** 调用子行注册的 agent/pre-step 监听。 */
async function runPreStep(
  host: ReturnType<typeof mount>,
  messages: UserMessage[],
  decision?: { kind: string; messages?: UserMessage[] },
  session: FakeSurfaceSession = makeSurfaceSession(),
) {
  const listener = host.base._onCallbacks.get('agent/pre-step')?.[0];
  if (listener === undefined) throw new Error('missing agent/pre-step listener');
  const next = vi.fn(async () => decision ?? { kind: 'enter', messages });
  const result = (await listener({ agent: { session } }, next)) as {
    kind: string;
    messages?: UserMessage[];
  };
  if (result.kind !== 'reject') session.commit(result.messages ?? []);
  return { result, next, session };
}

describe('SA-工作会话子行', () => {
  it('注入共享服务并注册 send_report、提示词和失败监听', () => {
    const host = mount();

    expect(name).toBe('sa-worker');
    expect(host.groups).toEqual([['larkSuperAgent', 'systemPrompt', 'tools']]);
    expect(host.sections).toEqual([
      { name: 'sa-worker:instructions', order: 700, text: SA_WORKER_PROMPT },
    ]);
    expect(host.base._registeredTools.map((entry) => entry.name)).toEqual(['send_report']);
    expect(host.base._onCallbacks.get('session/event')).toHaveLength(1);
    expect(host.base._onCallbacks.get('agent/pre-step')).toHaveLength(1);
  });

  it('send_report 使用 exec.agent.session.id 并保留服务结果', async () => {
    const host = mount();
    host.service.sendReport.mockResolvedValue({
      reportId: 'report-1',
      taskId: 'task-1',
      delivered: true,
      warning: 'commit failed',
    });

    const result = await reportTool(host.base).execute(
      { kind: 'question', text: 'Need a decision', files: ['result.md'] },
      exec('session-1'),
    );

    expect(host.service.sendReport).toHaveBeenCalledWith(
      { kind: 'question', text: 'Need a decision', files: ['result.md'] },
      'session-1',
    );
    expect(result).toEqual({
      reportId: 'report-1',
      taskId: 'task-1',
      delivered: true,
      warning: 'commit failed',
    });
  });

  it('send_report 保留缺省 text 字段', async () => {
    const host = mount();
    host.service.sendReport.mockResolvedValue({
      reportId: 'report-2',
      taskId: null,
      delivered: true,
    });

    await reportTool(host.base).execute(
      { kind: 'completed', files: ['result.md'] },
      exec('session-1'),
    );

    expect(host.service.sendReport).toHaveBeenCalledWith(
      { kind: 'completed', files: ['result.md'] },
      'session-1',
    );
  });

  it('send_report 缺少调用会话时抛错且不调用服务', async () => {
    const host = mount();

    await expect(
      reportTool(host.base).execute({ kind: 'progress', text: 'status' }, exec()),
    ).rejects.toThrow('send_report requires an agent session');
    await expect(
      reportTool(host.base).execute({ kind: 'progress', text: 'status' }, { agent: {} } as never),
    ).rejects.toThrow('send_report requires an agent session');
    expect(host.service.sendReport).not.toHaveBeenCalled();
  });

  it('空参数错误由共享服务作为工具执行错误返回', async () => {
    const host = mount();
    host.service.sendReport.mockRejectedValue(new Error('send_report needs text or files'));

    await expect(
      reportTool(host.base).execute({ kind: 'progress' }, exec('session-1')),
    ).rejects.toThrow('send_report needs text or files');
    expect(host.service.sendReport).toHaveBeenCalledWith({ kind: 'progress' }, 'session-1');
  });

  it('send_report 的 kind 必填且只接受四种取值', async () => {
    const host = mount();
    const tool = reportTool(host.base);
    expect(tool.parameters.required).toContain('kind');
    expect(tool.parameters.properties.kind).toMatchObject({
      type: 'string',
      enum: ['progress', 'question', 'completed', 'abandoned'],
    });
    await expect(tool.execute({ text: 'status' }, exec('session-1'))).rejects.toBeInstanceOf(
      ToolArgsError,
    );
    await expect(
      tool.execute({ kind: 'finished', text: 'status' }, exec('session-1')),
    ).rejects.toBeInstanceOf(ToolArgsError);
    expect(host.service.sendReport).not.toHaveBeenCalled();
  });

  it('标准 turn/end error 事件上报失败原因', () => {
    const host = mount();
    const error = { message: 'model failed', code: 'UNKNOWN' };

    host.base._emit(
      'session/event',
      { id: 'session-1' },
      { type: 'turn/end', data: { turn: 1, reason: { kind: 'error', error } } },
    );

    expect(host.service.notifyFailure).toHaveBeenCalledWith('session-1', error);
  });

  it('兼容 event.data 直接携带 type/reason 的事件结构', () => {
    const host = mount();
    const error = { message: 'adapter failed' };

    host.base._emit(
      'session/event',
      { id: 'session-2' },
      { data: { type: 'turn/end', reason: { kind: 'error', error } } },
    );

    expect(host.service.notifyFailure).toHaveBeenCalledWith('session-2', error);
  });

  it('aborted、其他结束原因和其他事件不触发失败上报', () => {
    const host = mount();

    for (const event of [
      {
        type: 'turn/end',
        data: { reason: { kind: 'aborted', reason: { kind: 'user' } } },
      },
      { type: 'turn/end', data: { reason: { kind: 'completed' } } },
      { type: 'step/end', data: { reason: { kind: 'error', error: new Error('ignored') } } },
      { data: { type: 'turn/end', reason: { kind: 'aborted' } } },
    ]) {
      host.base._emit('session/event', { id: 'session-1' }, event);
    }

    expect(host.service.notifyFailure).not.toHaveBeenCalled();
  });

  it('提示词区分调度消息与本机消息并定义两种模式', () => {
    expect(SA_WORKER_PROMPT).toContain('<dispatch_session_message>');
    expect(SA_WORKER_PROMPT).toContain('## Remote mode');
    expect(SA_WORKER_PROMPT).toContain('## Local mode');
    expect(SA_WORKER_PROMPT).toContain('## Follow where the user is');
    expect(SA_WORKER_PROMPT).toMatch(/system reminder tells you where the user is/i);
    expect(SA_WORKER_PROMPT).toMatch(/at the computer means local mode, away means remote mode/i);
    expect(SA_WORKER_PROMPT).not.toMatch(/start in remote mode/i);
    expect(SA_WORKER_PROMPT).not.toMatch(/switches you (back )?to (local|remote) mode/i);
  });

  it('远程模式提示词要求正文精简、send_report 交互与 Markdown 交付', () => {
    const remote = SA_WORKER_PROMPT.split('## Local mode')[0] ?? '';
    expect(remote).toMatch(/response body.*not visible/i);
    expect(remote).toMatch(/keep.*body.*brief/i);
    expect(remote).toMatch(/send_report for all user interaction/i);
    expect(remote).toMatch(/including progress updates, questions, decisions, blockers/i);
    expect(SA_WORKER_PROMPT).toMatch(/Markdown.*files/is);
    expect(SA_WORKER_PROMPT).toMatch(/stuck|no meaningful progress/i);
  });

  it('本机模式提示词要求正文对话并上报影响任务的变化', () => {
    const local = SA_WORKER_PROMPT.split('## Local mode')[1] ?? '';
    expect(local).toMatch(/answer and ask questions directly in your response body/i);
    expect(local).toMatch(/ordinary conversation.*not reported/is);
    expect(local).toMatch(/requirement changes from the user, completion, and abandonment/i);
    expect(SA_WORKER_PROMPT).not.toContain('用户在电脑前');
    expect(local).toMatch(/do not send a report only to announce the mode change/i);
  });

  it('包装 meta-tools 来源消息并保留原 id 与 source', () => {
    const message = sourcedMessage('dsh-plugin-meta-tools');

    const [wrapped] = wrapDispatchMessages([message]);

    expect(wrapped?.id).toBe(message.id);
    expect(wrapped?.source).toEqual({ kind: 'dsh-plugin-meta-tools' });
    expect(wrapped?.content[0]).toEqual({
      type: 'text',
      text: '<dispatch_session_message>\n',
    });
    expect(wrapped?.content[1]).toEqual({ type: 'text', text: 'task requirements' });
    expect(wrapped?.content[2]).toEqual({
      type: 'text',
      text: '\n</dispatch_session_message>',
    });
    expect(hostMocks.freezeMessage).toHaveBeenCalled();
  });

  it('session_send 的 system-reminder 帧被剥掉，只留单层标记块', () => {
    const message = sourcedMessage(
      'dsh-plugin-meta-tools',
      '<system-reminder>\nPlease continue.\n</system-reminder>',
    );

    const [wrapped] = wrapDispatchMessages([message]);
    const text = messageText(wrapped);

    expect(text).toBe('<dispatch_session_message>\nPlease continue.\n</dispatch_session_message>');
    expect(text).not.toContain('<system-reminder>');
  });

  it('session_create 首条任务与剥帧后的消息结构一致', () => {
    const fromCreate = sourcedMessage('dsh-plugin-meta-tools', 'task requirements');
    const fromSend = sourcedMessage(
      'dsh-plugin-meta-tools',
      '<system-reminder>\ntask requirements\n</system-reminder>',
    );

    expect(messageText(wrapDispatchMessages([fromSend])[0])).toBe(
      messageText(wrapDispatchMessages([fromCreate])[0]),
    );
  });

  it('剥离时还原正文中被转义的闭标签', () => {
    const message = sourcedMessage(
      'dsh-plugin-meta-tools',
      '<system-reminder>\nbefore <\\/system-reminder> after\n</system-reminder>',
    );

    expect(messageText(wrapDispatchMessages([message])[0])).toBe(
      '<dispatch_session_message>\nbefore </system-reminder> after\n</dispatch_session_message>',
    );
  });

  it('多块消息与不完整帧保留内层帧', () => {
    const multi = {
      ...sourcedMessage('dsh-plugin-meta-tools'),
      content: [
        { type: 'text', text: '<system-reminder>\nfirst\n</system-reminder>' },
        { type: 'text', text: 'second' },
      ],
    } as UserMessage;
    const partial = sourcedMessage(
      'dsh-plugin-meta-tools',
      'prefix <system-reminder>\nkeep\n</system-reminder>',
    );

    expect(messageText(wrapDispatchMessages([multi])[0])).toContain('<system-reminder>');
    expect(messageText(wrapDispatchMessages([partial])[0])).toContain('<system-reminder>');
  });

  it('本机消息与其他插件来源的消息不变', () => {
    const messages = [sourcedMessage('user'), sourcedMessage('time-context')];

    expect(wrapDispatchMessages(messages)).toBe(messages);
  });

  it('正文中的闭标签被转义', () => {
    const message = sourcedMessage(
      'dsh-plugin-meta-tools',
      'before </dispatch_session_message> after',
    );

    const [wrapped] = wrapDispatchMessages([message]);

    expect(wrapped?.content[1]).toEqual({
      type: 'text',
      text: 'before <\\/dispatch_session_message> after',
    });
  });

  it('已包装的消息不重复包装', () => {
    const message = sourcedMessage(
      'dsh-plugin-meta-tools',
      '<dispatch_session_message>\nalready wrapped\n</dispatch_session_message>',
    );

    expect(wrapDispatchMessages([message])[0]).toBe(message);
  });

  it('agent/pre-step 先插在场提醒，再替换调度消息；状态一致时本机消息原样返回', async () => {
    const host = mount();
    const dispatch = sourcedMessage('dsh-plugin-meta-tools');
    const local = sourcedMessage('user');

    const wrapped = await runPreStep(host, [dispatch, local]);
    const [notice, first, second] = wrapped.result.messages ?? [];
    expect(notice?.source).toEqual({ kind: 'sa-presence', form: 'notice', presence: 'local' });
    expect(first).not.toBe(dispatch);
    expect(JSON.stringify(first?.content)).toContain('<dispatch_session_message>');
    expect(second).toBe(local);

    const unchanged = await runPreStep(host, [local], undefined, wrapped.session);
    expect(unchanged.result.messages).toEqual([local]);

    const decision = { kind: 'reject' };
    const rejected = await runPreStep(host, [dispatch], decision);
    expect(rejected.result).toBe(decision);
  });

  it('全局状态切到离开后插入 remote 提醒，调度消息不改变状态', async () => {
    const host = mount();
    const first = await runPreStep(host, [sourcedMessage('dsh-plugin-meta-tools')]);
    host.service.presence.set('remote');

    const next = await runPreStep(
      host,
      [sourcedMessage('dsh-plugin-meta-tools')],
      undefined,
      first.session,
    );
    expect(next.result.messages?.[0]?.source).toMatchObject({ presence: 'remote' });
    expect(JSON.stringify(next.result.messages?.[0]?.content)).toContain('away');
    expect(host.service.presence.get().presence).toBe('remote');
  });
});
