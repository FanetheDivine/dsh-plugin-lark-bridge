// SA-调度会话子行测试：依赖注入、提示词、五个工具的参数转换与结果、用户状态提醒。
import type { UserMessage } from '@deepseek-ai/dsh-llm';
import { ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import type { LarkSuperAgentService } from '../src/lark-super-agent/api.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { apply, name } from '../src/sa-dispatch/index.ts';
import { SA_DISPATCH_PROMPT } from '../src/sa-dispatch/prompt.ts';
import type { Context } from '../src/types.ts';
import { type FakeSurfaceSession, makeCtx, makeSurfaceSession } from './helpers.ts';

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
    notifyFailure: vi.fn(),
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
  return {
    base,
    service,
    sections,
    groups,
    tools: base._registeredTools as unknown as ToolDefinition[],
  };
}

function tool(tools: ToolDefinition[], toolName: string): ToolDefinition {
  const definition = tools.find((entry) => entry.name === toolName);
  if (definition === undefined) throw new Error(`missing tool ${toolName}`);
  return definition;
}

/** 构造一条带来源的用户消息。 */
function sourcedMessage(kind: string, extra: Record<string, unknown> = {}): UserMessage {
  return {
    id: `msg-${Math.random().toString(36).slice(2)}`,
    role: 'user',
    content: [{ type: 'text', text: 'hello' }],
    source: { kind, ...extra },
  } as unknown as UserMessage;
}

/** 调用子行注册的 agent/pre-step 监听。 */
async function runPreStep(
  host: ReturnType<typeof mount>,
  session: FakeSurfaceSession,
  messages: UserMessage[],
  decision?: { kind: string; messages?: UserMessage[] },
) {
  const listener = host.base._onCallbacks.get('agent/pre-step')?.[0];
  if (listener === undefined) throw new Error('missing agent/pre-step listener');
  const next = vi.fn(async () => decision ?? { kind: 'enter', messages });
  const result = (await listener({ agent: { session } }, next)) as {
    kind: string;
    messages?: UserMessage[];
  };
  if (result.kind !== 'reject') session.commit(result.messages ?? []);
  return { result, next };
}

describe('SA-调度会话子行', () => {
  it('注入共享服务并注册提示词段与五个工具', () => {
    const host = mount();

    expect(name).toBe('sa-dispatch');
    expect(host.groups).toEqual([
      ['larkSuperAgent', 'systemPrompt', 'tools'],
      ['sessionController'],
    ]);
    expect(host.sections).toEqual([
      { name: 'sa-dispatch:instructions', order: 700, text: SA_DISPATCH_PROMPT },
    ]);
    expect(host.tools.map((entry) => entry.name)).toEqual([
      'task_create',
      'task_update',
      'workspace_note_set',
      'workspace_note_remove',
      'task_candidates',
    ]);
    for (const definition of host.tools) {
      expect(definition.description).toMatch(/^[A-Za-z]/);
      expect(definition.parameters.type).toBe('object');
    }
  });

  it('task_create 转换消息字段并返回任务标识', async () => {
    const host = mount();
    host.service.createTask.mockResolvedValue({ taskId: 'task-1' });

    const result = await tool(host.tools, 'task_create').execute(
      {
        title: 'Investigate failure',
        workspace_id: 'workspace-1',
        message: { text: '查一下 xxx', message_id: 'message-1' },
      },
      {} as never,
    );

    expect(host.service.createTask).toHaveBeenCalledWith({
      title: 'Investigate failure',
      workspaceId: 'workspace-1',
      message: { text: '查一下 xxx', messageId: 'message-1' },
    });
    expect(result).toEqual({ taskId: 'task-1' });
  });

  it('task_update 转换全部字段并传递 completed 的自动归档结果', async () => {
    const host = mount();
    host.service.updateTask.mockResolvedValue({
      taskId: 'task-1',
      status: 'completed',
      archived: true,
    });

    const result = await tool(host.tools, 'task_update').execute(
      {
        task_id: 'task-1',
        status: 'completed',
        add_session_ids: ['session-1'],
        add_message: { text: '补充要求', message_id: 'message-2' },
        title: 'Updated title',
      },
      {} as never,
    );

    expect(host.service.updateTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: 'completed',
      addSessionIds: ['session-1'],
      addMessage: { text: '补充要求', messageId: 'message-2' },
      title: 'Updated title',
    });
    expect(result).toEqual({ taskId: 'task-1', status: 'completed', archived: true });
  });

  it('task_update 拒绝没有更新字段的调用', async () => {
    const host = mount();

    await expect(
      tool(host.tools, 'task_update').execute({ task_id: 'task-1' }, {} as never),
    ).rejects.toBeInstanceOf(ToolArgsError);
    expect(host.service.updateTask).not.toHaveBeenCalled();
  });

  it('工作区笔记工具转换可选字段并返回服务结果', async () => {
    const host = mount();
    host.service.setWorkspaceNote.mockResolvedValue({ workspaceId: 'workspace-1', created: true });
    host.service.removeWorkspaceNote.mockResolvedValue({
      workspaceId: 'workspace-1',
      removed: false,
    });

    const setResult = await tool(host.tools, 'workspace_note_set').execute(
      { workspace_id: 'workspace-1', summary: 'Project A', keywords: ['a', 'project'] },
      {} as never,
    );
    const removeResult = await tool(host.tools, 'workspace_note_remove').execute(
      { workspace_id: 'workspace-1' },
      {} as never,
    );

    expect(host.service.setWorkspaceNote).toHaveBeenCalledWith({
      workspaceId: 'workspace-1',
      summary: 'Project A',
      keywords: ['a', 'project'],
    });
    expect(host.service.removeWorkspaceNote).toHaveBeenCalledWith('workspace-1');
    expect(setResult).toEqual({ workspaceId: 'workspace-1', created: true });
    expect(removeResult).toEqual({ workspaceId: 'workspace-1', removed: false });
  });

  it('task_candidates 传递可选任务并按工具契约返回 tasks', async () => {
    const host = mount();
    host.service.listCandidates.mockResolvedValue({
      candidates: [
        {
          sessionId: 'session-1',
          title: 'Existing work',
          running: false,
          taskIds: ['task-1'],
          lastActiveAt: '2026-11-21T00:00:00+08:00',
        },
      ],
    });

    const result = await tool(host.tools, 'task_candidates').execute(
      { workspace_id: 'workspace-1', task_id: 'task-1' },
      {} as never,
    );

    expect(host.service.listCandidates).toHaveBeenCalledWith('workspace-1', 'task-1');
    expect(result).toEqual({
      candidates: [
        {
          sessionId: 'session-1',
          title: 'Existing work',
          running: false,
          tasks: ['task-1'],
          lastActiveAt: '2026-11-21T00:00:00+08:00',
        },
      ],
    });
  });

  it('提示词保留中文分类例句并覆盖派发、上报、记忆与卡住处理', () => {
    expect(SA_DISPATCH_PROMPT).toContain('查一下 xxx');
    expect(SA_DISPATCH_PROMPT).toContain('之前那个 xxx 做完了吗');
    expect(SA_DISPATCH_PROMPT).toContain('现在有哪些任务');
    expect(SA_DISPATCH_PROMPT).toContain('<引用消息>要注意 xxx');
    expect(SA_DISPATCH_PROMPT).toContain('task_candidates');
    expect(SA_DISPATCH_PROMPT).toContain('AGENTS.md');
    expect(SA_DISPATCH_PROMPT).toContain('<work_session_message');
    expect(SA_DISPATCH_PROMPT).toContain('<work_session_failure');
    expect(SA_DISPATCH_PROMPT).toContain("status: 'completed'");
    expect(SA_DISPATCH_PROMPT).toMatch(/read.*copied.*file/is);
    expect(SA_DISPATCH_PROMPT).toMatch(/stuck|no progress/i);
  });

  it('提示词默认新任务，只按引用或点名归入未结束任务', () => {
    const classify =
      SA_DISPATCH_PROMPT.split('## Classify each user message first')[1]?.split('## ')[0] ?? '';
    expect(classify).toMatch(/every user message as a new task by default/i);
    expect(classify).toMatch(/quotes a message that belongs to an unfinished task/i);
    expect(classify).toMatch(/names an unfinished task by its title or task id/i);
    expect(classify).toMatch(/does not make a message part of that task/i);
    expect(classify).toMatch(/several unrelated instructions becomes several tasks/i);
    expect(classify).toMatch(/quotes a finished task starts a new task/i);
    expect(classify).toMatch(/only the quoted text and the new message/i);
    expect(classify).toMatch(/cannot tell.*ask the user before acting/is);
  });

  it('提示词要求首条要求只含本任务内容', () => {
    expect(SA_DISPATCH_PROMPT).toMatch(
      /first requirements for a new worker session contain only this task's user messages and the target workspace/i,
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/Do not include content.*from any other task/i);
  });

  it('提示词按上报类型更新状态，只有完成与放弃结束任务', () => {
    const end =
      SA_DISPATCH_PROMPT.split('## End tasks only on the report kind')[1]?.split('## ')[0] ?? '';
    expect(SA_DISPATCH_PROMPT).toContain('taskid="<taskId>" kind="<kind>">');
    expect(end).toMatch(/- progress:.*status: 'in_progress'/);
    expect(end).toMatch(/- question:.*status: 'waiting_user'/);
    expect(end).toMatch(/- completed:.*end the task/);
    expect(end).toMatch(/- abandoned:.*end the task/);
    expect(end).toMatch(/Only a completed or abandoned report ends a task/);
    expect(end).toMatch(/never by the report wording/i);
    expect(end).toMatch(/worker failure.*does not end the task/is);
    expect(end).toMatch(/cancel a task.*abandoned report/is);
    expect(SA_DISPATCH_PROMPT).not.toMatch(/When the work is complete/i);
  });

  it('提示词要求在电脑旁时在正文转达完整问题', () => {
    expect(SA_DISPATCH_PROMPT).toMatch(
      /at the computer, relay the full question in your response body/i,
    );
  });

  it('提示词要求始终派发、先匹配工作区并守住调度边界', () => {
    expect(SA_DISPATCH_PROMPT).toContain('## Always dispatch');
    expect(SA_DISPATCH_PROMPT).toContain('## Pick a workspace first');
    expect(SA_DISPATCH_PROMPT).toContain('## Stay in bounds');
    expect(SA_DISPATCH_PROMPT).toContain('independent task for a new worker session');
    expect(SA_DISPATCH_PROMPT).toContain(
      'Do the work yourself only when the user explicitly asks you to',
    );
    expect(SA_DISPATCH_PROMPT).toContain('Never suggest that the dispatch session do the work');
    expect(SA_DISPATCH_PROMPT).toContain('我不知道在哪个工作区');
    expect(SA_DISPATCH_PROMPT).toContain('do not guess and do not start work');
    expect(SA_DISPATCH_PROMPT).not.toMatch(/register a new workspace/i);
    expect(SA_DISPATCH_PROMPT).toContain(
      'Dispatch only into a workspace registered in workspaces.json',
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/Assign project inspections.*worker session/is);
  });

  it('提示词要求回复简短并只给结论', () => {
    expect(SA_DISPATCH_PROMPT).toContain('## Reply style');
    expect(SA_DISPATCH_PROMPT).toMatch(/State conclusions only/i);
    expect(SA_DISPATCH_PROMPT).toMatch(
      /Omit pleasantries, implementation details, pointless questions, and suggestions/i,
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/Ask the user only when a decision blocks dispatching/i);
  });

  it('提示词默认新开会话，仅在用户明确要求时复用', () => {
    expect(SA_DISPATCH_PROMPT).toMatch(/new worker session.*every task/is);
    expect(SA_DISPATCH_PROMPT).toMatch(
      /Reuse an existing session only when the user explicitly asks/i,
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/When unsure, ask the user/i);
    expect(SA_DISPATCH_PROMPT).toMatch(
      /task_candidates only to find a session the user asked to reuse/i,
    );
    expect(SA_DISPATCH_PROMPT).not.toMatch(/Confirm reuse/i);
  });

  it('提示词要求新建工作会话先置顶', () => {
    expect(SA_DISPATCH_PROMPT).toContain('## Maintain the session list');
    expect(SA_DISPATCH_PROMPT).toContain('session_pin');
    expect(SA_DISPATCH_PROMPT).toMatch(/session_pin.*session_id.*before.*task requirements/is);
    expect(SA_DISPATCH_PROMPT).toMatch(/pinning fails.*continue dispatching/is);
  });

  it('提示词要求任务完成后归档工作会话', () => {
    expect(SA_DISPATCH_PROMPT).toContain('session_archive');
    expect(SA_DISPATCH_PROMPT).toContain('stop_activity');
    expect(SA_DISPATCH_PROMPT).toMatch(
      /message-task-status\.json.*status: 'completed'.*session_archive/is,
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/archiving removes the session's pin/i);
    expect(SA_DISPATCH_PROMPT).toMatch(/archiving a session fails.*keep the task completed/is);
    expect(SA_DISPATCH_PROMPT).toMatch(/Do not archive the dispatch session/i);
  });

  it('提示词要求复用与共用会话保持原状态', () => {
    expect(SA_DISPATCH_PROMPT).toMatch(
      /reused through task_candidates keeps its current pin state/i,
    );
    expect(SA_DISPATCH_PROMPT).toMatch(/Do not pin or unpin it/i);
    expect(SA_DISPATCH_PROMPT).toMatch(
      /check message-task-status\.json again.*any unfinished task lists it/is,
    );
  });

  it('注册 agent/pre-step 在场提醒监听', () => {
    const host = mount();
    expect(host.base._onCallbacks.get('agent/pre-step')).toHaveLength(1);
  });

  it('首次请求插入带属性的 local 提醒，状态不变时不重复', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    const local = sourcedMessage('user', { rpcId: 'rpc-1' });

    const first = await runPreStep(host, session, [local]);

    expect(first.result.kind).toBe('enter');
    const [notice, original] = first.result.messages ?? [];
    expect(notice?.source).toEqual({ kind: 'sa-presence', form: 'notice', presence: 'local' });
    expect(JSON.stringify(notice?.content)).toContain('at the computer');
    expect(original).toBe(local);

    const second = await runPreStep(host, session, [sourcedMessage('user')]);
    expect(second.result.messages).toHaveLength(1);
  });

  it('飞书消息把全局状态切到离开并插入 remote 提醒', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    await runPreStep(host, session, [sourcedMessage('user')]);

    const remote = await runPreStep(host, session, [sourcedMessage('lark-bridge')]);
    expect(remote.result.messages?.[0]?.source).toMatchObject({ presence: 'remote' });
    expect(JSON.stringify(remote.result.messages?.[0]?.content)).toContain('away');
    expect(host.service.presence.get().presence).toBe('remote');

    const again = await runPreStep(host, session, [sourcedMessage('lark-bridge')]);
    expect(again.result.messages).toHaveLength(1);
  });

  it('手动切换后无新消息的下一步也插入提醒', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    await runPreStep(host, session, [sourcedMessage('user')]);
    host.service.presence.set('remote');

    const { result } = await runPreStep(host, session, []);
    expect(result.messages?.[0]?.source).toMatchObject({ presence: 'remote' });
  });

  it('按属性识别提醒，不读正文', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    session.commit([
      sourcedMessage('sa-presence', { form: 'notice', presence: 'local' }),
      {
        role: 'user',
        content: [{ type: 'text', text: 'User presence: the user is away' }],
        source: { kind: 'user' },
      },
    ]);

    const { result } = await runPreStep(host, session, [sourcedMessage('time-context')]);
    expect(result.messages).toHaveLength(1);
  });

  it('旧版 sa-dispatch-presence 提醒不计入，升级后补一条', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    session.commit([sourcedMessage('sa-dispatch-presence', { form: 'notice' })]);

    const { result } = await runPreStep(host, session, [sourcedMessage('time-context')]);
    expect(result.messages?.[0]?.source).toMatchObject({ kind: 'sa-presence' });
  });

  it('压缩移除提醒后补回当前状态', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    await runPreStep(host, session, [sourcedMessage('user')]);
    session.compact();

    const { result } = await runPreStep(host, session, [sourcedMessage('time-context')]);
    expect(result.messages?.[0]?.source).toMatchObject({ kind: 'sa-presence', presence: 'local' });
  });

  it('桥接提醒、工作会话上报与其他注入不改变状态', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    await runPreStep(host, session, [sourcedMessage('user')]);
    const messages = [
      sourcedMessage('lark-bridge', { reminder: true }),
      sourcedMessage('lark-super-agent'),
      sourcedMessage('time-context'),
    ];

    const { result } = await runPreStep(host, session, messages);

    expect(result.messages).toEqual(messages);
    expect(host.service.presence.get().presence).toBe('local');
  });

  it('reject 决策原样返回且不观察消息', async () => {
    const host = mount();
    const session = makeSurfaceSession();
    const decision = { kind: 'reject' };

    const rejected = await runPreStep(host, session, [sourcedMessage('lark-bridge')], decision);
    expect(rejected.result).toBe(decision);
    expect(host.service.presence.get().presence).toBe('local');
  });

  it('提示词只说明两种位置的处理方式', () => {
    expect(SA_DISPATCH_PROMPT).toContain('## Track where the user is');
    expect(SA_DISPATCH_PROMPT).toMatch(/system reminder tells you where the user is/i);
    expect(SA_DISPATCH_PROMPT).toMatch(/at the computer.*response body/is);
    expect(SA_DISPATCH_PROMPT).toMatch(/do not call lark_notify/i);
    expect(SA_DISPATCH_PROMPT).toMatch(/away.*through lark_notify/is);
    expect(SA_DISPATCH_PROMPT).toMatch(/Dispatch every task in both states/i);
    expect(SA_DISPATCH_PROMPT).toMatch(/channel for the current presence/i);
    expect(SA_DISPATCH_PROMPT).not.toMatch(/Without any reminder/i);
    expect(SA_DISPATCH_PROMPT).not.toContain('用户在电脑前');
    expect(SA_DISPATCH_PROMPT).not.toMatch(/never change your presence/i);
  });
});
