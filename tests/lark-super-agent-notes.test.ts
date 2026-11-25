import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { TaskStatus } from '../src/lark-super-agent/api.ts';
import { runGit } from '../src/lark-super-agent/git.ts';
import {
  NotesStore,
  readTaskState,
  readWorkspaceState,
  TASKS_FILE,
  WORKSPACES_FILE,
} from '../src/lark-super-agent/notes.ts';
import { ReportStore } from '../src/lark-super-agent/reports.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lark-super-agent-notes-'));
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

/** 建立一个任务并返回任务 id。 */
async function newTask(
  store: NotesStore,
  sessionId: string,
  overrides: { title?: string; workspaceId?: string | null; cwd?: string; text?: string } = {},
): Promise<string> {
  const { taskId } = await store.createTask({
    title: overrides.title ?? sessionId,
    sessionId,
    workspaceId: overrides.workspaceId ?? null,
    cwd: overrides.cwd ?? `/work/${sessionId}`,
    message: { text: overrides.text ?? '开始' },
  });
  return taskId;
}

/** 读取归档快照。 */
async function archivedSnapshot(
  root: string,
  taskId: string,
): Promise<{
  endReason: string;
  archivedAt: string;
  sessionId: string;
  status: string;
  reportIds: string[];
  messages: { text: string }[];
}> {
  return JSON.parse(await readFile(join(root, 'archive', taskId, 'task.json'), 'utf8')) as {
    endReason: string;
    archivedAt: string;
    sessionId: string;
    status: string;
    reportIds: string[];
    messages: { text: string }[];
  };
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

describe('lark-super-agent notes', { timeout: 30000 }, () => {
  it('创建任务写入会话、工作目录与首条消息', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const { taskId } = await store.createTask({
      title: '  排查 A  ',
      sessionId: 'session-a',
      workspaceId: null,
      cwd: '/work/a',
      message: { text: ' 开始 ', messageId: 'message-1' },
    });
    expect(taskId).toMatch(/^task-\d{14}-[0-9a-f]{4}$/);

    const state = await readTaskState(root);
    expect(state.version).toBe(2);
    expect(state.invalid).toBeUndefined();
    expect(state.tasks).toHaveLength(1);
    const [task] = state.tasks;
    expect(task).toMatchObject({
      id: taskId,
      title: '排查 A',
      status: 'in_progress',
      sessionId: 'session-a',
      workspaceId: null,
      cwd: '/work/a',
      reportIds: [],
      messages: [{ messageId: 'message-1', text: ' 开始 ', time: expect.any(String) }],
      createdAt: expect.any(String),
    });
    expect(task?.createdAt).toBe(task?.updatedAt);
    expect((await runGit(['log', '-1', '--pretty=%s'], root)).stdout.trim()).toBe(
      `lark-super-agent: create ${taskId}`,
    );
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
  });

  it('同一会话只允许一个未结束任务，归档后可再次建立', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const first = await newTask(store, 'worker');
    await expect(
      store.createTask({
        title: '重复',
        sessionId: 'worker',
        workspaceId: null,
        cwd: '/work/worker',
        message: { text: '再建一次' },
      }),
    ).rejects.toThrow(/session worker is already managed/);

    await store.endTask(first, 'completed');
    const second = await newTask(store, 'worker');
    expect(second).not.toBe(first);
    const tasks = (await readTaskState(root)).tasks;
    expect(tasks.map((task) => task.id)).toEqual([second]);
    await expect(store.endTask(first, 'completed')).rejects.toThrow(/task not found/);
  });

  it('改写标题、追加消息与状态转换的限制', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');

    await expect(store.updateTask({ taskId })).rejects.toThrow(/at least one change/);
    await expect(
      store.updateTask({
        taskId: 'task-20260102030405-ffff',
        title: 'x',
      }),
    ).rejects.toThrow(/task not found: task-20260102030405-ffff/);

    await store.updateTask({ taskId, title: ' 新标题 ' });
    await store.updateTask({ taskId, addMessage: { text: '补充', messageId: 'message-2' } });
    let [task] = (await readTaskState(root)).tasks;
    expect(task?.title).toBe('新标题');
    expect(task?.messages.map((message) => message.text)).toEqual(['开始', '补充']);
    expect(task?.messages[1]?.messageId).toBe('message-2');

    await expect(store.updateTask({ taskId, status: 'waiting_user' })).resolves.toEqual({
      taskId,
      status: 'waiting_user',
    });
    await expect(store.updateTask({ taskId, status: 'waiting_user' })).resolves.toEqual({
      taskId,
      status: 'waiting_user',
    });
    await expect(store.updateTask({ taskId, status: 'failed' })).resolves.toEqual({
      taskId,
      status: 'failed',
    });
    await expect(store.updateTask({ taskId, status: 'waiting_user' })).rejects.toThrow(
      /invalid task status transition: failed -> waiting_user/,
    );
    await store.updateTask({ taskId, status: 'in_progress' });
    await expect(
      store.updateTask({ taskId, status: 'completed' as unknown as TaskStatus }),
    ).rejects.toThrow(/invalid task status transition: in_progress -> completed/);

    [task] = (await readTaskState(root)).tasks;
    expect(task?.status).toBe('in_progress');
    expect(task?.messages).toHaveLength(2);
    expect(task?.updatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/);
  });

  it('校验不通过的台账按空台账处理并覆盖旧内容', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const path = join(root, TASKS_FILE);

    await writeFile(path, '{ definitely broken\n', 'utf8');
    await expect(readTaskState(root)).resolves.toEqual({ version: 2, tasks: [], invalid: true });
    const { taskId } = await store.createTask({
      title: '任务',
      sessionId: 'worker',
      workspaceId: null,
      cwd: '/work/worker',
      message: { text: '开始' },
    });
    const rewritten = JSON.parse(await readFile(path, 'utf8')) as {
      version: unknown;
      tasks: { id: string }[];
    };
    expect(rewritten.version).toBe(2);
    expect(rewritten.tasks.map((task) => task.id)).toEqual([taskId]);

    await writeFile(path, JSON.stringify({ version: 1, tasks: [] }), 'utf8');
    expect((await readTaskState(root)).invalid).toBe(true);

    await writeFile(
      path,
      JSON.stringify({ version: 2, tasks: [{ id: 'task-20260102030405-aaaa' }] }),
      'utf8',
    );
    expect((await readTaskState(root)).invalid).toBe(true);

    await rm(path, { force: true });
    await newTask(store, 'session-a');
    await newTask(store, 'session-b');
    const duplicatedSessions = JSON.parse(await readFile(path, 'utf8')) as {
      version: number;
      tasks: { id: string; sessionId: string }[];
    };
    expect(duplicatedSessions.tasks).toHaveLength(2);
    const [first, second] = duplicatedSessions.tasks;
    if (first === undefined || second === undefined) throw new Error('expected two tasks');
    second.sessionId = first.sessionId;
    await writeFile(path, JSON.stringify(duplicatedSessions), 'utf8');
    expect(await readTaskState(root)).toEqual({ version: 2, tasks: [], invalid: true });

    second.sessionId = 'session-b';
    second.id = first.id;
    await writeFile(path, JSON.stringify(duplicatedSessions), 'utf8');
    expect(await readTaskState(root)).toEqual({ version: 2, tasks: [], invalid: true });
  });

  it('endTask 归档任务、搬移上报并写入结束原因', async () => {
    const root = await temporaryDirectory();
    const attachments = await temporaryDirectory();
    const attachment = join(attachments, 'result.md');
    await writeFile(attachment, '# Result\n', 'utf8');
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    const report = await new ReportStore(root, { cwd: attachments }).archiveReport(
      { kind: 'progress', text: '进展', files: [attachment] },
      'worker',
      taskId,
      'send_report',
    );

    await expect(store.endTask(taskId, 'completed')).resolves.toEqual({ taskId });
    expect((await readTaskState(root)).tasks).toEqual([]);
    expect(await exists(join(root, 'reports', taskId))).toBe(false);
    expect(await exists(join(root, 'archive', taskId, 'reports', `${report.reportId}.md`))).toBe(
      true,
    );
    const snapshot = await archivedSnapshot(root, taskId);
    expect(snapshot.endReason).toBe('completed');
    expect(snapshot.sessionId).toBe('worker');
    expect(snapshot.status).toBe('in_progress');
    expect(snapshot.reportIds).toEqual([report.reportId]);
    expect(snapshot.archivedAt).toMatch(
      /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}[+-]\d{2}:\d{2}$/,
    );
    expect((await runGit(['log', '-1', '--pretty=%s'], root)).stdout.trim()).toBe(
      `lark-super-agent: archive ${taskId}`,
    );
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');

    const plain = await newTask(store, 'plain');
    await store.endTask(plain, 'cancelled');
    expect((await archivedSnapshot(root, plain)).endReason).toBe('cancelled');
    expect(await exists(join(root, 'archive', plain, 'reports'))).toBe(false);
  });

  it('pruneTasks 按会话归档与会话缺失两种原因结束任务', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const alive = await newTask(store, 'alive');
    const sessionArchived = await newTask(store, 'archived-one');
    const sessionMissing = await newTask(store, 'missing-one');
    await new ReportStore(root).archiveReport(
      { kind: 'question', text: '继续吗' },
      'archived-one',
      sessionArchived,
      'send_report',
    );

    await expect(store.pruneTasks(new Set(['alive']), new Set(['archived-one']))).resolves.toEqual({
      ended: 2,
    });
    expect((await readTaskState(root)).tasks.map((task) => task.id)).toEqual([alive]);
    expect((await archivedSnapshot(root, sessionArchived)).endReason).toBe('session_archived');
    expect(await exists(join(root, 'archive', sessionArchived, 'reports'))).toBe(true);
    expect((await archivedSnapshot(root, sessionMissing)).endReason).toBe('session_missing');
    expect((await archivedSnapshot(root, sessionMissing)).sessionId).toBe('missing-one');

    const commits = (await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim();
    await expect(store.pruneTasks(new Set(['alive']), new Set())).resolves.toEqual({ ended: 0 });
    expect((await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim()).toBe(commits);
  });

  it('工作区笔记按标识替换、删除，校验失败按空白名单处理', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    await expect(
      store.setWorkspaceNote({
        workspaceId: ' workspace-a ',
        summary: ' Project A ',
        keywords: ['a', ' project ', 'a'],
        notes: 'release notes',
      }),
    ).resolves.toEqual({ workspaceId: 'workspace-a', created: true });
    await expect(
      store.setWorkspaceNote({
        workspaceId: 'workspace-a',
        summary: 'Project A2',
        keywords: ['a'],
      }),
    ).resolves.toEqual({ workspaceId: 'workspace-a', created: false });

    const workspaces = await readWorkspaceState(root);
    expect(workspaces.version).toBe(1);
    expect(workspaces.workspaces).toHaveLength(1);
    expect(workspaces.workspaces[0]).toMatchObject({
      workspaceId: 'workspace-a',
      summary: 'Project A2',
      keywords: ['a'],
      notes: '',
    });
    expect(workspaces.workspaces[0]?.keywords).toEqual(['a']);

    await expect(
      store.setWorkspaceNote({ workspaceId: 'workspace-a', summary: '  ', keywords: ['a'] }),
    ).rejects.toThrow(/summary must not be empty/);
    await expect(
      store.setWorkspaceNote({ workspaceId: 'workspace-a', summary: 'x', keywords: ['  '] }),
    ).rejects.toThrow(/keywords must contain at least one non-empty string/);

    await expect(store.removeWorkspaceNote('missing')).resolves.toEqual({
      workspaceId: 'missing',
      removed: false,
    });
    await expect(store.removeWorkspaceNote('workspace-a')).resolves.toEqual({
      workspaceId: 'workspace-a',
      removed: true,
    });
    expect((await readWorkspaceState(root)).workspaces).toEqual([]);
    expect((await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim()).toBe('3');

    const path = join(root, WORKSPACES_FILE);
    await writeFile(path, '{ broken\n', 'utf8');
    expect(await readWorkspaceState(root)).toEqual({ version: 1, workspaces: [], invalid: true });
    await writeFile(path, JSON.stringify({ version: 9, workspaces: [] }), 'utf8');
    expect(await readWorkspaceState(root)).toEqual({ version: 1, workspaces: [], invalid: true });
    await store.setWorkspaceNote({
      workspaceId: 'workspace-b',
      summary: 'Project B',
      keywords: ['b'],
    });
    const rewritten = JSON.parse(await readFile(path, 'utf8')) as { version: number };
    expect(rewritten.version).toBe(1);
    expect((await readWorkspaceState(root)).workspaces.map((note) => note.workspaceId)).toEqual([
      'workspace-b',
    ]);
  });
});
