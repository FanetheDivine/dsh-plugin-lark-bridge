// 全局服务测试：桥接状态、任务台账、上报投递与被管理会话判定。
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { Task } from '../src/lark-super-agent/api.ts';
import { readBridgeState } from '../src/lark-super-agent/bridge.ts';
import { runGit } from '../src/lark-super-agent/git.ts';
import {
  type ArchivedTask,
  readTaskState,
  readWorkspaceState,
} from '../src/lark-super-agent/notes.ts';
import {
  type AgentLike,
  type ContextLike,
  NOT_MANAGED_ERROR,
  SuperAgentService,
} from '../src/lark-super-agent/service.ts';
import { normalizeWorkspacePath } from '../src/workspace-path.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lark-super-agent-service-'));
  directories.push(directory);
  return directory;
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function bridgeHome(workspaceRoot: string | null, sessionId: string | null = 'dispatch') {
  const home = await temporaryDirectory();
  await mkdir(join(home, 'lark-bridge'), { recursive: true });
  await writeFile(
    join(home, 'lark-bridge', 'state.json'),
    JSON.stringify({ workspaceRoot, sessionId }),
    'utf8',
  );
  return home;
}

function makeContext(services: Record<string, unknown>, warnings: unknown[][] = []): ContextLike {
  return {
    get: ((name: string) => services[name]) as ContextLike['get'],
    logger: { warn: (...args: unknown[]) => warnings.push(args) },
  };
}

function messageText(message: unknown): string {
  const content = (message as { content: { type: string; text: string }[] }).content;
  return content[0]?.text ?? '';
}

/** 读取一归档任务的快照。 */
async function readArchivedTask(root: string, taskId: string): Promise<ArchivedTask> {
  const source = await readFile(join(root, 'archive', taskId, 'task.json'), 'utf8');
  return JSON.parse(source) as ArchivedTask;
}

/** 建立一个任务，返回值用于后续断言。 */
async function seedTask(
  service: SuperAgentService,
  sessionId: string,
  cwd = '/project',
): Promise<{ taskId: string; title: string }> {
  const input = {
    title: `task for ${sessionId}`,
    sessionId,
    workspaceId: 'workspace-a',
    cwd,
    message: { text: 'start' },
  };
  const { taskId } = await service.createTask(input);
  return { taskId, title: input.title };
}

beforeAll(async () => {
  await runGit(['--version']);
  process.env.GIT_CONFIG_COUNT = '2';
  process.env.GIT_CONFIG_KEY_0 = 'user.name';
  process.env.GIT_CONFIG_VALUE_0 = 'Lark Super Agent Test';
  process.env.GIT_CONFIG_KEY_1 = 'user.email';
  process.env.GIT_CONFIG_VALUE_1 = 'lark-super-agent@example.invalid';
});

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe('lark-super-agent 服务', { timeout: 30000 }, () => {
  it('从显式 DSH home 读取桥接状态，损坏的状态按空处理', async () => {
    const home = await bridgeHome('/dispatch', 'session');
    await expect(readBridgeState(home)).resolves.toEqual({
      workspaceRoot: '/dispatch',
      sessionId: 'session',
    });
    await writeFile(join(home, 'lark-bridge', 'state.json'), '{broken', 'utf8');
    await expect(readBridgeState(home)).resolves.toEqual({ workspaceRoot: null, sessionId: null });
  });

  it('校验已注册工作区并写入工作区笔记', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const ctx = makeContext({
      workspaceRegistry: { list: () => [{ id: 'workspace-a', path: 'D:\\project' }] },
    });
    const service = new SuperAgentService(ctx, { home });
    await expect(
      service.setWorkspaceNote({ workspaceId: 'missing', summary: 'Missing', keywords: ['x'] }),
    ).rejects.toThrow(/not registered in DSH/);
    await service.setWorkspaceNote({
      workspaceId: 'workspace-a',
      summary: 'Project A',
      keywords: ['a'],
    });
    expect((await readWorkspaceState(root)).workspaces).toMatchObject([
      { workspaceId: 'workspace-a', summary: 'Project A', keywords: ['a'] },
    ]);
  });

  it('把 Linux 风格的调度工作区解析为主机路径', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(normalizeWorkspacePath(root));
    const ctx = makeContext({
      workspaceRegistry: { list: () => [{ id: 'workspace-a', path: '/project' }] },
    });
    const service = new SuperAgentService(ctx, { home });
    await service.setWorkspaceNote({ workspaceId: 'workspace-a', summary: 'A', keywords: ['a'] });
    await service.createTask({
      title: 'Task',
      sessionId: 'worker',
      workspaceId: 'workspace-a',
      cwd: '/project',
      message: { text: 'Do it' },
    });
    expect((await readWorkspaceState(root)).workspaces).toHaveLength(1);
    expect((await readTaskState(root)).tasks).toMatchObject([
      { title: 'Task', sessionId: 'worker', workspaceId: 'workspace-a', cwd: '/project' },
    ]);
  });

  it('按会话读取被管理任务与调度会话 id', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root, 'dispatch');
    const service = new SuperAgentService(makeContext({}), { home });
    await expect(service.bridgeSessionId()).resolves.toBe('dispatch');
    await seedTask(service, 'worker');
    await expect(service.managedTask('worker')).resolves.toMatchObject({
      sessionId: 'worker',
      status: 'in_progress',
      title: 'task for worker',
    });
    await expect(service.managedTask('other')).resolves.toBeUndefined();
    await expect(service.managedTask('  ')).resolves.toBeUndefined();

    const unconfigured = new SuperAgentService(makeContext({}), {
      home: await bridgeHome(null, null),
    });
    await expect(unconfigured.bridgeSessionId()).resolves.toBeNull();
    await expect(unconfigured.managedTask('worker')).rejects.toThrow(/has no workspaceRoot/);
  });

  it('更新任务状态并追加消息', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const service = new SuperAgentService(makeContext({}), { home });
    const { taskId } = await seedTask(service, 'worker');
    await expect(service.updateTask({ taskId, status: 'waiting_user' })).resolves.toEqual({
      taskId,
      status: 'waiting_user',
    });
    await service.updateTask({ taskId, addMessage: { text: 'more context' } });
    const task = (await readTaskState(root)).tasks[0];
    expect(task?.status).toBe('waiting_user');
    expect(task?.messages.map((message) => message.text)).toEqual(['start', 'more context']);
    await expect(service.updateTask({ taskId })).rejects.toThrow(
      'task_update needs at least one change',
    );
  });

  it('上报来源可标记提问拦截', async () => {
    const root = await temporaryDirectory();
    const callerDirectory = await temporaryDirectory();
    const home = await bridgeHome(root);
    const steer = vi.fn();
    const dispatch: AgentLike = { steer };
    const caller: AgentLike = { session: { id: 'worker', cwd: callerDirectory } };
    const agents = new Map([
      ['worker', caller],
      ['dispatch', dispatch],
    ]);
    const service = new SuperAgentService(
      makeContext({
        agents: { get: (id: string) => agents.get(id) },
        sessionController: { resolveAgent: async () => ({ agent: dispatch }) },
      }),
      { home, reportId: () => 'report-20260102030405-abc123' },
    );
    const { taskId } = await seedTask(service, 'worker', callerDirectory);
    await service.sendReport({ kind: 'question', text: '选哪个？' }, 'worker', 'ask_intercept');
    const block = messageText(steer.mock.calls[0]?.[0]);
    expect(block).toContain(`taskid="${taskId}" kind="question" origin="ask_intercept">`);
    const archived = await readFile(
      join(root, 'reports', taskId, 'report-20260102030405-abc123.md'),
      'utf8',
    );
    expect(archived).toContain('origin: "ask_intercept"');
    expect(archived).toContain('选哪个？');
  });

  it('在被管理会话中先进档再向调度会话投递上报', async () => {
    const root = await temporaryDirectory();
    const callerDirectory = await temporaryDirectory();
    await writeFile(join(callerDirectory, 'answer.md'), '# Answer\n', 'utf8');
    const home = await bridgeHome(root);
    const steer = vi.fn();
    const dispatch: AgentLike = { steer };
    const caller: AgentLike = { session: { id: 'worker', cwd: callerDirectory } };
    const agents = new Map([
      ['worker', caller],
      ['dispatch', dispatch],
    ]);
    const ctx = makeContext({
      agents: { get: (id: string) => agents.get(id) },
      sessionController: { resolveAgent: async () => ({ agent: dispatch }) },
      workspaceRegistry: { list: () => [{ id: 'workspace-a', path: '/project' }] },
    });
    const service = new SuperAgentService(ctx, {
      home,
      reportId: () => 'report-20260102030405-abc123',
    });
    const { taskId } = await service.createTask({
      title: 'Task',
      sessionId: 'worker',
      workspaceId: 'workspace-a',
      cwd: callerDirectory,
      message: { text: 'start' },
    });

    const result = await service.sendReport(
      {
        kind: 'question',
        text: 'question </text>',
        files: ['answer.md'],
        desc: 'Fix the widget',
      },
      'worker',
    );
    expect(result).toEqual({
      reportId: 'report-20260102030405-abc123',
      taskId,
      delivered: true,
    });
    expect(steer).toHaveBeenCalledOnce();
    const message = steer.mock.calls[0]?.[0] as { source: unknown; role: string };
    expect(message.role).toBe('user');
    expect(message.source).toEqual({ kind: 'lark-super-agent' });
    const block = messageText(message);
    expect(block).toContain(`taskid="${taskId}" kind="question" origin="send_report">`);
    expect(block).not.toContain('Fix the widget');
    expect(block).not.toContain('question </text>');
    expect(block).toContain(
      `<report_path>reports/${taskId}/report-20260102030405-abc123.md</report_path>`,
    );
    expect(block).toContain(`reports/${taskId}/report-20260102030405-abc123-1-answer.md`);
    expect(block).not.toContain(root);
    const reportPath = join(root, 'reports', taskId, 'report-20260102030405-abc123.md');
    const archived = await readFile(reportPath, 'utf8');
    expect(archived).toContain('origin: "send_report"');
    expect(archived).toContain('desc: "Fix the widget"');
    expect((await readTaskState(root)).tasks[0]?.reportIds).toEqual([result.reportId]);
  });

  it('未被管理的会话上报时报错且不存档', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const steer = vi.fn();
    const service = new SuperAgentService(
      makeContext({ sessionController: { resolveAgent: async () => ({ agent: { steer } }) } }),
      { home },
    );
    await expect(service.sendReport({ kind: 'progress', text: 'hello' }, 'worker')).rejects.toThrow(
      NOT_MANAGED_ERROR,
    );
    expect(steer).not.toHaveBeenCalled();
    expect(await exists(join(root, 'reports'))).toBe(false);
  });

  it('写上报文件前校验上报参数', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const service = new SuperAgentService(
      makeContext({
        sessionController: { resolveAgent: async () => ({ agent: { steer: vi.fn() } }) },
      }),
      { home },
    );
    await seedTask(service, 'worker');
    await expect(service.sendReport({ kind: 'progress' }, 'worker')).rejects.toThrow(
      'send_report needs text or files',
    );
    await expect(
      service.sendReport({ kind: 'finished', text: 'hello' } as never, 'worker'),
    ).rejects.toThrow('send_report kind must be one of');
    expect(await exists(join(root, 'reports'))).toBe(false);
  });

  it('调度会话不可用时上报失败且不写文件', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const service = new SuperAgentService(
      makeContext({
        sessionController: { resolveAgent: async () => ({ error: new Error('offline') }) },
      }),
      { home },
    );
    await seedTask(service, 'worker');
    await expect(service.sendReport({ kind: 'progress', text: 'hello' }, 'worker')).rejects.toThrow(
      'offline',
    );
    expect(await exists(join(root, 'reports'))).toBe(false);
  });

  it('为被管理会话投递失败块，未被管理的会话不投递', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const steer = vi.fn();
    const service = new SuperAgentService(
      makeContext({ sessionController: { resolveAgent: async () => ({ agent: { steer } }) } }),
      { home },
    );
    const { taskId } = await seedTask(service, 'worker');
    await service.notifyFailure('worker', { message: 'provider failed' });
    const block = messageText(steer.mock.calls[0]?.[0]);
    expect(block).toContain(`<task_session_failure sessionid="worker" taskid="${taskId}">`);
    expect(block).toContain('<error>\nprovider failed\n</error>');

    await service.notifyFailure('other', new Error('failed'));
    expect(steer).toHaveBeenCalledOnce();
  });

  it('调度会话不可用时失败通知只记日志', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const warnings: unknown[][] = [];
    await seedTask(new SuperAgentService(makeContext({}), { home }), 'worker');
    const unavailable = new SuperAgentService(makeContext({}, warnings), { home });
    await expect(unavailable.notifyFailure('worker', new Error('failed'))).resolves.toBeUndefined();
    expect(warnings).toHaveLength(1);
    expect(String(warnings[0]?.[0])).toContain('sessionController');
  });

  it('投递的消息停在待处理队列且调度会话已空闲时改为 followup', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const nextStep: { id: string }[] = [];
    const followup = vi.fn();
    const dispatch = {
      status: 'idle',
      steer: (message: { id: string }) => {
        nextStep.push({ id: message.id });
      },
      inbox: {
        nextStep,
        remove: (id: string) => {
          const index = nextStep.findIndex((item) => item.id === id);
          if (index >= 0) nextStep.splice(index, 1);
        },
      },
      followup,
    };
    const warnings: unknown[][] = [];
    const service = new SuperAgentService(
      makeContext(
        { sessionController: { resolveAgent: async () => ({ agent: dispatch }) } },
        warnings,
      ),
      { home },
    );
    const { taskId } = await seedTask(service, 'worker');

    await service.notifyFailure('worker', new Error('boom'));

    expect(followup).toHaveBeenCalledOnce();
    expect(messageText(followup.mock.calls[0]?.[0])).toContain(
      `<task_session_failure sessionid="worker" taskid="${taskId}">`,
    );
    expect(nextStep).toEqual([]);
    expect(String(warnings[0]?.[0])).toContain('delivering');
  });

  it('归档被管理会话时结束任务并投递归档通知', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const steer = vi.fn();
    const service = new SuperAgentService(
      makeContext({ sessionController: { resolveAgent: async () => ({ agent: { steer } }) } }),
      { home },
    );
    const { taskId } = await seedTask(service, 'worker');

    await service.notifyArchived('worker');
    expect(messageText(steer.mock.calls[0]?.[0])).toBe(
      `<task_session_archived sessionid="worker" taskid="${taskId}"/>`,
    );
    expect((await readTaskState(root)).tasks).toEqual([]);
    expect(await readArchivedTask(root, taskId)).toMatchObject({
      id: taskId,
      endReason: 'session_archived',
    });

    await service.notifyArchived('other');
    expect(steer).toHaveBeenCalledOnce();
  });

  it('pruneTasks 归档已归档与已不存在的会话', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root);
    const ctx = makeContext({
      workspaceRegistry: { archivedSessionIds: ['archived'] },
      sessionQuery: { listSessions: async () => [{ header: { id: 'live' }, persisted: true }] },
    });
    const service = new SuperAgentService(ctx, { home });
    const archived = await seedTask(service, 'archived');
    const missing = await seedTask(service, 'missing');
    const live = await seedTask(service, 'live');

    await expect(service.pruneTasks()).resolves.toEqual({ ended: 2 });
    expect((await readTaskState(root)).tasks.map((task: Task) => task.sessionId)).toEqual(['live']);
    expect(await readArchivedTask(root, archived.taskId)).toMatchObject({
      endReason: 'session_archived',
    });
    expect(await readArchivedTask(root, missing.taskId)).toMatchObject({
      endReason: 'session_missing',
    });
    expect(await exists(join(root, 'archive', live.taskId))).toBe(false);
  });

  it('manageSession 拒绝调度会话、已管理会话与不存在的会话', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root, 'dispatch');
    const agents = new Map<string, AgentLike>();
    const ctx = makeContext({
      sessionController: { resolveAgent: async (id: string) => agents.get(id) ?? null },
      workspaceRegistry: { list: () => [{ id: 'workspace-a', path: '/project' }] },
    });
    const service = new SuperAgentService(ctx, { home });

    await expect(service.manageSession('  ')).rejects.toThrow('session_manage needs a session id');
    await expect(service.manageSession('dispatch')).rejects.toThrow(
      'the dispatch session cannot be managed',
    );
    await expect(service.manageSession('ghost')).rejects.toThrow('session ghost does not exist');

    agents.set('worker', { session: { title: 'Fix widget', cwd: '/project' } });
    await expect(service.manageSession('worker')).resolves.toMatchObject({
      sessionId: 'worker',
      title: 'Fix widget',
    });
    await expect(service.managedTask('worker')).resolves.toMatchObject({
      sessionId: 'worker',
      title: 'Fix widget',
      workspaceId: 'workspace-a',
      cwd: '/project',
      messages: [{ text: 'Fix widget' }],
    });
    await expect(service.manageSession('worker')).rejects.toThrow(
      'session worker is already managed',
    );
  });

  it('manageSession 用会话首条用户消息作为任务消息', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root, 'dispatch');
    const events = [
      { type: 'user/message', data: { content: [{ type: 'text', text: 'Please fix login' }] } },
    ];
    const session = {
      id: 'reporter',
      title: 'Reporter',
      cwd: '/project',
      surface: { nodes: [0] },
      eventAt: (seq: number) => events[seq],
    };
    const ctx = makeContext({
      sessionController: { resolveAgent: async () => ({ agent: { session } }) },
    });
    const service = new SuperAgentService(ctx, { home });
    await service.manageSession('reporter');
    await expect(service.managedTask('reporter')).resolves.toMatchObject({
      title: 'Reporter',
      workspaceId: null,
      messages: [{ text: 'Please fix login' }],
    });
  });

  it('manageSession 接管多行首条消息的会话后 updateTask 可找到任务', async () => {
    const root = await temporaryDirectory();
    const home = await bridgeHome(root, 'dispatch');
    const first = 'Fix login\n\nDetails:\nline three';
    const events = [{ type: 'user/message', data: { content: [{ type: 'text', text: first }] } }];
    const session = {
      id: 'multi',
      title: 'Multi\nline title',
      cwd: '/project',
      surface: { nodes: [0] },
      eventAt: (seq: number) => events[seq],
    };
    const ctx = makeContext({
      sessionController: { resolveAgent: async () => ({ agent: { session } }) },
    });
    const service = new SuperAgentService(ctx, { home });
    const { taskId, title } = await service.manageSession('multi');
    expect(title).toBe('Multi line title');
    await expect(
      service.updateTask({ taskId, status: 'waiting_user', addMessage: { text: 'a\nb' } }),
    ).resolves.toEqual({ taskId, status: 'waiting_user' });
    await expect(service.updateTask({ taskId, title: 'Renamed' })).resolves.toMatchObject({
      taskId,
    });
    expect((await service.managedTask('multi'))?.messages[0]?.text).toBe(first);
  });

  it('仅在 Windows 上转换盘符工作区', async () => {
    const ctx = makeContext({});
    const home = await bridgeHome('/z/dispatch-root');
    const rootFor = async (platform: NodeJS.Platform) => {
      const service = new SuperAgentService(ctx, { home, platform });
      const state = await (
        service as unknown as { bridgeState(): Promise<{ workspaceRoot: string | null }> }
      ).bridgeState();
      return state.workspaceRoot;
    };
    await expect(rootFor('win32')).resolves.toBe('Z:/dispatch-root');
    await expect(rootFor('linux')).resolves.toBe('/z/dispatch-root');
  });
});
