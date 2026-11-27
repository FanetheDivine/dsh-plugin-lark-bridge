// SA-调度会话子行测试：依赖注入、提示词、任务与会话工具的参数转换与结果。
import { ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import type { LarkSuperAgentService } from '../src/lark-super-agent/api.ts';
import { apply, name } from '../src/sa-dispatch/index.ts';
import { SA_DISPATCH_PROMPT } from '../src/sa-dispatch/prompt.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

interface PromptSectionLike {
  name: string;
  order: number;
  text: string;
}

function makeService() {
  return {
    taskModel: () => undefined,
    taskPreset: () => '',
    bridgeSessionId: vi.fn(),
    managedTask: vi.fn(),
    createTask: vi.fn(),
    assertDispatchable: vi.fn(),
    manageSession: vi.fn(),
    updateTask: vi.fn(),
    endTask: vi.fn(),
    pruneTasks: vi.fn(),
    restoreSession: vi.fn(),
    setWorkspaceNote: vi.fn(),
    removeWorkspaceNote: vi.fn(),
    sendReport: vi.fn(),
    notifyFailure: vi.fn(),
    notifyArchived: vi.fn(),
  } satisfies LarkSuperAgentService;
}

function mount(options: { services?: Record<string, unknown> } = {}) {
  const base = makeCtx(options);
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

/** 截取提示词中一节的正文。 */
function section(title: string): string {
  return SA_DISPATCH_PROMPT.split(`## ${title}\n`)[1]?.split('\n## ')[0] ?? '';
}

describe('SA-调度会话子行', () => {
  it('注入共享服务并注册提示词段与六个工具', () => {
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
      'task_update',
      'task_end',
      'session_manage',
      'session_unmanage',
      'session_restore',
      'workspace_note_set',
      'workspace_note_remove',
    ]);
    for (const definition of host.tools) {
      expect(definition.description).toMatch(/^[A-Za-z]/);
      expect(definition.parameters.type).toBe('object');
    }
  });

  it('宿主提供会话控制与模型服务时注册 session_create、list_models 与 session_model', () => {
    const host = mount({
      services: {
        sessionController: { create: vi.fn(), rename: vi.fn(), resolveAgent: vi.fn() },
        llm: {},
        workspaceRegistry: { archivedSessionIds: [] },
      },
    });

    expect(host.tools.map((entry) => entry.name)).toEqual([
      'task_update',
      'task_end',
      'session_manage',
      'session_unmanage',
      'session_restore',
      'workspace_note_set',
      'workspace_note_remove',
      'session_create',
      'list_models',
      'session_model',
    ]);
  });

  it('session_restore 默认重新置顶并透出恢复结果', async () => {
    const host = mount();
    host.service.restoreSession.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-1',
      taskRestored: true,
      pinned: true,
    });

    const result = await tool(host.tools, 'session_restore').execute(
      { session_id: 'session-1' },
      {} as never,
    );

    expect(host.service.restoreSession).toHaveBeenCalledWith('session-1', { pin: true });
    expect(result).toEqual({
      sessionId: 'session-1',
      taskId: 'task-1',
      taskRestored: true,
      pinned: true,
    });
  });

  it('session_restore 传 pin: false 时跳过置顶，并保留警告', async () => {
    const host = mount();
    host.service.restoreSession.mockResolvedValue({
      sessionId: 'session-1',
      taskRestored: false,
      pinned: false,
      warning: 'no archived task was found for the session',
    });

    const result = await tool(host.tools, 'session_restore').execute(
      { session_id: 'session-1', pin: false },
      {} as never,
    );

    expect(host.service.restoreSession).toHaveBeenCalledWith('session-1', { pin: false });
    expect(result).toEqual({
      sessionId: 'session-1',
      taskRestored: false,
      pinned: false,
      warning: 'no archived task was found for the session',
    });
  });

  it('task_update 转换全部字段并返回任务标识与状态', async () => {
    const host = mount();
    host.service.updateTask.mockResolvedValue({ taskId: 'task-1', status: 'waiting_user' });

    const result = await tool(host.tools, 'task_update').execute(
      {
        task_id: 'task-1',
        status: 'waiting_user',
        add_message: { text: '补充要求', message_id: 'message-2' },
        title: 'Updated title',
      },
      {} as never,
    );

    expect(host.service.updateTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      status: 'waiting_user',
      addMessage: { text: '补充要求', messageId: 'message-2' },
      title: 'Updated title',
    });
    expect(result).toEqual({ taskId: 'task-1', status: 'waiting_user' });
  });

  it('task_update 只传入提供的字段', async () => {
    const host = mount();
    host.service.updateTask.mockResolvedValue({ taskId: 'task-1', status: 'in_progress' });

    await tool(host.tools, 'task_update').execute(
      { task_id: 'task-1', add_message: { text: '追问' } },
      {} as never,
    );

    expect(host.service.updateTask).toHaveBeenCalledWith({
      taskId: 'task-1',
      addMessage: { text: '追问' },
    });
  });

  it('task_update 的状态只有 in_progress、waiting_user 与 failed', async () => {
    const host = mount();
    const definition = tool(host.tools, 'task_update');
    const properties = definition.parameters.properties as Record<string, { enum?: string[] }>;
    expect(properties.status?.enum).toEqual(['in_progress', 'waiting_user', 'failed']);
    await expect(
      definition.execute({ task_id: 'task-1', status: 'completed' }, {} as never),
    ).rejects.toBeInstanceOf(ToolArgsError);
    expect(host.service.updateTask).not.toHaveBeenCalled();
  });

  it('task_update 拒绝没有更新字段的调用', async () => {
    const host = mount();

    await expect(
      tool(host.tools, 'task_update').execute({ task_id: 'task-1' }, {} as never),
    ).rejects.toBeInstanceOf(ToolArgsError);
    expect(host.service.updateTask).not.toHaveBeenCalled();
  });

  it('task_end 按原因结束任务并只返回任务标识', async () => {
    const host = mount();
    host.service.endTask.mockResolvedValue({ taskId: 'task-1', extra: true });

    const completed = await tool(host.tools, 'task_end').execute(
      { task_id: 'task-1', reason: 'completed' },
      {} as never,
    );
    await tool(host.tools, 'task_end').execute(
      { task_id: 'task-2', reason: 'cancelled' },
      {} as never,
    );

    expect(host.service.endTask).toHaveBeenNthCalledWith(1, 'task-1', 'completed');
    expect(host.service.endTask).toHaveBeenNthCalledWith(2, 'task-2', 'cancelled');
    expect(completed).toEqual({ taskId: 'task-1' });
  });

  it('task_end 描述只陈述行为，不给出与新规则冲突的归档建议', () => {
    const definition = tool(mount().tools, 'task_end');
    expect(definition.description).toContain('The session stays unarchived');
    expect(definition.description).not.toContain('archive it separately');
  });

  it('task_end 只接受 completed 与 cancelled，reason 必填', async () => {
    const host = mount();

    await expect(
      tool(host.tools, 'task_end').execute({ task_id: 'task-1', reason: 'unmanaged' }, {} as never),
    ).rejects.toBeInstanceOf(ToolArgsError);
    await expect(
      tool(host.tools, 'task_end').execute({ task_id: 'task-1' }, {} as never),
    ).rejects.toBeInstanceOf(ToolArgsError);
    expect(host.service.endTask).not.toHaveBeenCalled();
  });

  it('session_manage 传递会话与中止信号并返回服务结果', async () => {
    const host = mount();
    host.service.manageSession.mockResolvedValue({
      sessionId: 'session-1',
      taskId: 'task-1',
      title: 'Existing work',
    });
    const signal = new AbortController().signal;

    const result = await tool(host.tools, 'session_manage').execute({ session_id: 'session-1' }, {
      signal,
    } as never);

    expect(host.service.manageSession).toHaveBeenCalledWith('session-1', signal);
    expect(result).toEqual({ sessionId: 'session-1', taskId: 'task-1', title: 'Existing work' });
  });

  it('session_unmanage 以 unmanaged 结束会话的任务并保留会话', async () => {
    const host = mount();
    host.service.managedTask.mockResolvedValue({ id: 'task-1', sessionId: 'session-1' });
    host.service.endTask.mockResolvedValue({ taskId: 'task-1' });

    const result = await tool(host.tools, 'session_unmanage').execute(
      { session_id: 'session-1' },
      {} as never,
    );

    expect(host.service.managedTask).toHaveBeenCalledWith('session-1');
    expect(host.service.endTask).toHaveBeenCalledWith('task-1', 'unmanaged');
    expect(result).toEqual({ sessionId: 'session-1', taskId: 'task-1' });
  });

  it('session_unmanage 对未管理的会话报错', async () => {
    const host = mount();
    host.service.managedTask.mockResolvedValue(undefined);

    await expect(
      tool(host.tools, 'session_unmanage').execute({ session_id: 'session-9' }, {} as never),
    ).rejects.toThrow('session session-9 is not managed');
    expect(host.service.endTask).not.toHaveBeenCalled();
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
    await tool(host.tools, 'workspace_note_set').execute(
      { workspace_id: 'workspace-1', summary: 'Project A', keywords: [], notes: 'prefer A' },
      {} as never,
    );
    const removeResult = await tool(host.tools, 'workspace_note_remove').execute(
      { workspace_id: 'workspace-1' },
      {} as never,
    );

    expect(host.service.setWorkspaceNote).toHaveBeenNthCalledWith(1, {
      workspaceId: 'workspace-1',
      summary: 'Project A',
      keywords: ['a', 'project'],
    });
    expect(host.service.setWorkspaceNote).toHaveBeenNthCalledWith(2, {
      workspaceId: 'workspace-1',
      summary: 'Project A',
      keywords: [],
      notes: 'prefer A',
    });
    expect(host.service.removeWorkspaceNote).toHaveBeenCalledWith('workspace-1');
    expect(setResult).toEqual({ workspaceId: 'workspace-1', created: true });
    expect(removeResult).toEqual({ workspaceId: 'workspace-1', removed: false });
  });

  it('工具结果渲染为 JSON 文本', () => {
    const definition = tool(mount().tools, 'task_end');
    expect(definition.output?.render?.({} as never, { taskId: 'task-1' } as never)).toEqual([
      { type: 'text', text: '{"taskId":"task-1"}' },
    ]);
  });

  it('提示词按顺序包含全部小节', () => {
    const titles = [...SA_DISPATCH_PROMPT.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
    expect(titles).toEqual([
      'Reply style',
      'Respond to the user',
      'Answer questions about DSH yourself',
      'Start a task',
      'Manage existing sessions',
      "Change a session's model",
      'Add messages to a task',
      'Handle reports',
      'Read the task log',
      'Decide when a task is done',
      'Keep the session list current',
      'Other messages from the service',
      'Choose tasks',
      'Notes',
      'Stay in bounds',
    ]);
    expect(SA_DISPATCH_PROMPT).toMatch(/^You are the dispatch session/);
  });

  it('提示词要求回复简短并只给结论', () => {
    const reply = section('Reply style');
    expect(reply).toMatch(/State conclusions only/);
    expect(reply).toContain('Keep your own words short');
    expect(reply).toMatch(/Omit pleasantries, implementation details, pointless questions/);
    expect(reply).toMatch(/Ask the user only when you cannot act/);
  });

  it('提示词要求以「名称 (id)」全形式提及任务', () => {
    const reply = section('Reply style');
    expect(reply).toContain('Mention tasks to the user as "<title> (<task id>)"');
    expect(reply).toContain('Every mention uses this full form');
    expect(reply).toContain('When the title cannot be resolved, say so and give the id');
    const start = section('Start a task');
    expect(start).toContain(
      'Tell the user the workspace and the task through lark_notify with the task_id',
    );
    expect(start).toContain("a title, a prompt, and the user's message_id");
    expect(SA_DISPATCH_PROMPT).not.toContain('Tell the user the task id and the workspace');
  });

  it('提示词要求自己回答关于 DSH 的问题且不建任务', () => {
    const answer = section('Answer questions about DSH yourself');
    expect(answer).toMatch(/is not a task\. Answer it yourself and create nothing/);
    expect(answer).toContain('workspaces.json');
    expect(answer).toContain('message-task-status.json');
  });

  it('提示词要求先匹配工作区，再用 session_create 建会话，未要求时 task_type 传空值且不传模型参数', () => {
    const start = section('Start a task');
    expect(start).toContain('Dispatch only into a workspace registered in workspaces.json');
    expect(start).toContain('我不知道在哪个工作区');
    expect(start).toContain('do not guess and do not start work');
    expect(start).toMatch(/session_create\. Pass workspace_id, a title, a prompt/);
    expect(start).toMatch(/leave out conclusions and content from other tasks/);
    expect(start).toContain(
      'Always pass an empty task_type and omit provider, model, and effort unless the user explicitly asks',
    );
    expect(start).toMatch(/task's only session/);
    expect(start).toContain('Then pin the new session with session_pin');
    expect(SA_DISPATCH_PROMPT).not.toContain('task_create');
    expect(SA_DISPATCH_PROMPT).not.toContain('task_candidates');
  });

  it('提示词说明 session_manage 与 session_unmanage，并在接管后置顶', () => {
    const manage = section('Manage existing sessions');
    expect(manage).toMatch(/session_manage with its session id/);
    expect(manage).toContain('Then pin that session with session_pin');
    expect(manage).toMatch(/session_unmanage\. The task ends; the session and its pin stay/);
    expect(manage).toMatch(/archives a session, its task ends on its own/);
  });

  it('提示词要求先判断是否转发：指令追加后投递，给调度会话的说明只记录', () => {
    const add = section('Add messages to a task');
    expect(add).toMatch(/task_update, then deliver it with session_send/);
    expect(add).toContain('Decide first whether a message is an instruction for the task session');
    expect(add).toContain('do not call session_send. Record it with task_update add_message');
    expect(add).toContain('ask the user');
    expect(add).toContain('When the user answers a question a task session asked');
    expect(add).not.toContain('Answering a task session works the same way');
    expect(add).toContain('no acknowledgment of a report');
  });

  it('提示词要求下发后立刻用 lark_notify 回应，并按任务分开通知', () => {
    const respond = section('Respond to the user');
    expect(respond).toContain('The user reads only what lark_notify sends');
    expect(respond).toContain('Reply to every message the user sends');
    expect(respond).toContain(
      'After session_create, session_send, session_manage, session_unmanage, session_restore, session_model, or task_end succeeds, call lark_notify in the next step',
    );
    expect(respond).toContain('one lark_notify per task');
    expect(respond).toContain('pass its task_id');
    expect(respond).toContain('Leave that prefix out of your text');
    expect(respond).toContain('After task_end or session_unmanage, the task no longer exists');
    expect(respond).toContain('Omit task_id for that notification and start your text with');
    expect(respond).toContain('reply_to');
    expect(respond).toContain('mode "card"');
    expect(respond).toContain('Send only the rest');
    expect(respond).toContain('are not user messages');
  });

  it('提示词说明模型切换与恢复归档会话', () => {
    const model = section("Change a session's model");
    expect(model).toContain('session_model');
    expect(model).toContain('Omit session_id to change your own model');
    expect(model).toContain('applies from the next step');
    expect(model).toContain('after session_restore');
    const list = section('Keep the session list current');
    expect(list).toContain('session_restore');
    expect(list).toContain('pin: false');
    expect(list).toContain('session_manage');
  });

  it('提示词说明任务日志块的处理', () => {
    const log = section('Read the task log');
    expect(log).toContain('Never notify the user about a task_log_entry');
    expect(log).toMatch(/user_message and the task is waiting_user, set the task to in_progress/);
    expect(log).toMatch(/user_stop.*Leave the task status as it is/);
    expect(log).toContain('task_snapshot');
  });

  it('提示词说明上报块的属性与处理方式，上报不结束任务', () => {
    const reports = section('Handle reports');
    expect(reports).toContain('task_session_message');
    expect(reports).toContain('sessionid, reportid, taskid, kind, and origin');
    expect(reports).toContain('report_path, attachment_paths');
    expect(reports).toContain('every report listed in unread_reports');
    expect(reports).toContain('archive/<taskId>/reports/');
    expect(reports).toContain(
      'progress keeps the task in progress. question sets the task to waiting_user',
    );
    expect(reports).toContain('origin="turn_end"');
    expect(reports).toContain('A report never ends a task');
    expect(reports).toContain('Read the report file at report_path');
    expect(reports).toMatch(/desc .*correct the task title with task_update/);
    expect(reports).toContain('front matter');
  });

  it('提示词要求报告不充分时请任务会话重发，充分时不打扰，并只在需要时通知用户', () => {
    const reports = section('Handle reports');
    expect(reports).toContain('origin="send_report"');
    expect(reports).toContain('origin="turn_end"');
    expect(reports).toContain(
      "states neither the task's current state nor a point the user must confirm",
    );
    expect(reports).toContain('one resend request with session_send');
    expect(reports).toContain('This applies to both origins');
    expect(reports).toContain(
      'only when the report holds a new result, milestone, blocker, failure, or question',
    );
    expect(reports).toContain('Update the task whether or not you notify the user');
    expect(reports).toContain('Relay what the report says as it is and add only your own facts');
  });

  it('提示词要求用户确认后才以 completed 结束，取消时立即以 cancelled 结束并归档会话', () => {
    const done = section('Decide when a task is done');
    expect(done).toContain('task_end(completed) only after the user confirms');
    expect(done).toMatch(/finish or cancel a task.*task_end\(cancelled\) right away/);
    expect(done).toContain('its session is archived the same way');
    expect(done).toContain('session_archive and stop_activity: true');
    expect(done).toContain('the archive drops its pin');
    expect(done).not.toContain('It leaves the session unarchived');
    expect(done).toContain(
      'A partial result, a failed turn, a quiet session, and a question are not a finished task',
    );
  });

  it('提示词把再次置顶、取消置顶与失败处理集中在新小节', () => {
    const list = section('Keep the session list current');
    expect(list).toContain('Pin a session again or unpin it only when the user asks');
    expect(list).toContain('session_pin with remove: true');
    expect(list).toContain('Archiving a session drops its pin');
    expect(list).toContain(
      'When session_pin or session_archive fails, tell the user in a separate lark_notify and continue',
    );
  });

  it('提示词说明失败与归档通知', () => {
    const other = section('Other messages from the service');
    expect(other).toContain('task_session_failure');
    expect(other).toContain('Set the task to failed, notify the user once about that failure');
    expect(other).toContain('task_session_archived');
    expect(other).toContain('It arrives with your next step');
    expect(other).toContain(
      "Do not notify the user about it: it is the user's own action",
    );
  });

  it('提示词默认新任务，只按引用或点名归入未结束任务', () => {
    const choose = section('Choose tasks');
    expect(choose).toContain('Treat every user message as a new task by default');
    expect(choose).toContain("quotes that task's message or names its title or task id");
    expect(choose).toContain('A message that quotes a finished task starts a new task');
    expect(choose).toMatch(/cannot tell.*ask the user/);
    expect(choose).toContain('Handle it as described under "Add messages to a task"');
  });

  it('提示词要求经工具维护状态文件，以 AGENTS.md 作为记忆并守住调度边界', () => {
    const notes = section('Notes');
    expect(notes).toContain('message-task-status.json only through task tools');
    expect(notes).toContain('workspace_note_set and workspace_note_remove');
    expect(notes).toContain('AGENTS.md');
    const bounds = section('Stay in bounds');
    expect(bounds).toContain('unless the user explicitly asks you to do it');
    expect(bounds).toContain(
      'Never edit state files, task archives, task logs, or reports by hand',
    );
  });

  it('不再注册 agent/pre-step 提醒监听', () => {
    const host = mount();
    expect(host.base._onCallbacks.get('agent/pre-step')).toBeUndefined();
  });

  it('提示词不含在场段落，转达上报不按在场选择渠道', () => {
    expect(SA_DISPATCH_PROMPT).not.toContain('Track where the user is');
    expect(SA_DISPATCH_PROMPT).not.toMatch(/presence/i);
    expect(section('Handle reports')).not.toContain('Relay the content to the user.');
    expect(section('Handle reports')).not.toContain('channel for the current presence');
  });
});
