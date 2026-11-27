import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import type { TaskStatus } from '../src/lark-super-agent/api.ts';
import { runGit } from '../src/lark-super-agent/git.ts';
import {
  ARCHIVED_TASK_LOG,
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
      deliveredReportIds: [],
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

  it('多行消息正文可写入、读回，之后仍可更新与结束任务', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const text = '工作区：A。\n\n现象：第二段\n线索：第三段';
    const { taskId } = await store.createTask({
      title: '多行',
      sessionId: 'session-multi',
      workspaceId: null,
      cwd: '/work/multi',
      message: { text },
    });
    const state = await readTaskState(root);
    expect(state.invalid).toBeUndefined();
    expect(state.tasks[0]?.messages[0]?.text).toBe(text);

    await expect(
      store.updateTask({ taskId, status: 'waiting_user', addMessage: { text: '补充\n第二行' } }),
    ).resolves.toEqual({ taskId, status: 'waiting_user' });
    await expect(store.updateTask({ taskId, title: '新标题' })).resolves.toMatchObject({ taskId });
    expect((await readTaskState(root)).tasks[0]?.messages.map((message) => message.text)).toEqual([
      text,
      '补充\n第二行',
    ]);
    await expect(store.endTask(taskId, 'completed')).resolves.toEqual({ taskId });
  });

  it('空白消息正文拒绝写入，且台账仍可读', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    await expect(
      store.createTask({
        title: '空消息',
        sessionId: 'session-empty',
        workspaceId: null,
        cwd: '/work/empty',
        message: { text: ' \n ' },
      }),
    ).rejects.toThrow(/message\.text must not be empty/);
    expect((await readTaskState(root)).invalid).toBeUndefined();
  });

  it('台账校验失败时 updateTask 与 endTask 报告校验失败而不是任务不存在', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    await writeFile(join(root, TASKS_FILE), '{ definitely broken\n', 'utf8');
    await expect(
      store.updateTask({ taskId: 'task-20260102030405-aaaa', title: '标题' }),
    ).rejects.toThrow(/message-task-status\.json failed validation/);
    await expect(store.endTask('task-20260102030405-aaaa', 'cancelled')).rejects.toThrow(
      /message-task-status\.json failed validation/,
    );
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

  it('latestArchivedTask 取该会话最近归档的一条', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const older = await newTask(store, 'worker');
    await store.endTask(older, 'completed');
    const newer = await newTask(store, 'worker');
    await store.endTask(newer, 'session_archived');
    const other = await newTask(store, 'other');
    await store.endTask(other, 'session_archived');

    const latest = await store.latestArchivedTask('worker');
    expect(latest?.id).toBe(newer);
    expect(latest?.endReason).toBe('session_archived');
    await expect(store.latestArchivedTask('missing')).resolves.toBeUndefined();
  });

  it('restoreTask 迁回报告与任务日志、写回台账并删除归档目录', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    const report = await new ReportStore(root, { cwd: root }).archiveReport(
      { kind: 'progress', text: '进展' },
      'worker',
      taskId,
      'send_report',
    );
    await mkdir(join(root, 'task-logs'), { recursive: true });
    await writeFile(join(root, 'task-logs', `${taskId}.jsonl`), '{"seq":1}\n', 'utf8');
    await store.endTask(taskId, 'session_archived');
    expect(await exists(join(root, 'archive', taskId, 'reports'))).toBe(true);
    expect(await exists(join(root, 'archive', taskId, ARCHIVED_TASK_LOG))).toBe(true);

    const archived = await store.latestArchivedTask('worker');
    if (archived === undefined) throw new Error('expected an archived task');
    await expect(store.restoreTask(archived)).resolves.toEqual({ taskId });

    const tasks = (await readTaskState(root)).tasks;
    expect(tasks).toHaveLength(1);
    expect(tasks[0]).toMatchObject({
      id: taskId,
      sessionId: 'worker',
      status: 'in_progress',
      reportIds: [report.reportId],
      deliveredReportIds: [],
    });
    expect(tasks[0]?.messages).toHaveLength(1);
    expect(await exists(join(root, 'reports', taskId, `${report.reportId}.md`))).toBe(true);
    expect(await exists(join(root, 'task-logs', `${taskId}.jsonl`))).toBe(true);
    expect(await exists(join(root, 'archive', taskId))).toBe(false);
    expect((await runGit(['log', '-1', '--pretty=%s'], root)).stdout.trim()).toBe(
      `lark-super-agent: restore ${taskId}`,
    );
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
  });

  it('restoreTask 拒绝覆盖已有报告目录或该会话的未结束任务', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    await new ReportStore(root, { cwd: root }).archiveReport(
      { kind: 'progress', text: '进展' },
      'worker',
      taskId,
      'send_report',
    );
    await store.endTask(taskId, 'session_archived');
    const archived = await store.latestArchivedTask('worker');
    if (archived === undefined) throw new Error('expected an archived task');

    await mkdir(join(root, 'reports', taskId), { recursive: true });
    await expect(store.restoreTask(archived)).rejects.toThrow(/refusing to overwrite/);
    await rm(join(root, 'reports', taskId), { recursive: true, force: true });

    await newTask(store, 'worker');
    await expect(store.restoreTask(archived)).rejects.toThrow(/already managed/);
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

  it('新任务没有已投递报告，旧台账按已投递读取', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    await newTask(store, 'worker');
    expect((await readTaskState(root)).tasks[0]?.deliveredReportIds).toEqual([]);

    const legacyRoot = await temporaryDirectory();
    const at = new Date().toISOString();
    await writeFile(
      join(legacyRoot, TASKS_FILE),
      JSON.stringify({
        version: 2,
        tasks: [
          {
            id: 'task-20260101000000-0001',
            title: '旧任务',
            status: 'in_progress',
            sessionId: 'worker',
            workspaceId: null,
            cwd: '/work/worker',
            reportIds: ['report-20260101000000-aaaaaa'],
            messages: [{ text: '开始', time: at }],
            createdAt: at,
            updatedAt: at,
          },
        ],
      }),
      'utf8',
    );
    const [legacy] = (await readTaskState(legacyRoot)).tasks;
    expect(legacy?.deliveredReportIds).toEqual(['report-20260101000000-aaaaaa']);
  });

  it('markReportsDelivered 只记录已存档报告，无变化时不提交', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    const reports = new ReportStore(root);
    const first = await reports.archiveReport(
      { kind: 'progress', text: '第一份' },
      'worker',
      taskId,
      'send_report',
    );
    const second = await reports.archiveReport(
      { kind: 'progress', text: '第二份' },
      'worker',
      taskId,
      'send_report',
    );
    expect(second.reportId).not.toBe(first.reportId);

    await expect(
      store.markReportsDelivered([
        { taskId, reportIds: [first.reportId, 'report-20260101000000-unknown'] },
      ]),
    ).resolves.toEqual({ changed: true });
    expect((await readTaskState(root)).tasks[0]?.deliveredReportIds).toEqual([first.reportId]);
    expect((await runGit(['log', '-1', '--pretty=%s'], root)).stdout.trim()).toBe(
      'lark-super-agent: mark reports delivered',
    );
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');

    const commits = (await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim();
    await expect(
      store.markReportsDelivered([{ taskId, reportIds: [first.reportId] }]),
    ).resolves.toEqual({ changed: false });
    expect((await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim()).toBe(commits);
    expect((await readTaskState(root)).tasks[0]?.deliveredReportIds).toEqual([first.reportId]);
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
