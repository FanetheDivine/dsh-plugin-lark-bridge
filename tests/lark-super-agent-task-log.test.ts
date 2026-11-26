// 任务日志测试：追加、同 id 去重、任务已结束丢弃、截断、读取容错与归档迁移及提交。
import { appendFile, mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { runGit } from '../src/lark-super-agent/git.ts';
import { NotesStore } from '../src/lark-super-agent/notes.ts';
import {
  appendTaskLogEntry,
  readTaskLog,
  TASK_LOG_TEXT_LIMIT,
  taskLogPath,
} from '../src/lark-super-agent/task-log.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'lark-task-log-'));
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

async function newTask(store: NotesStore, sessionId: string): Promise<string> {
  const { taskId } = await store.createTask({
    title: sessionId,
    sessionId,
    workspaceId: null,
    cwd: `/work/${sessionId}`,
    message: { text: '开始' },
  });
  return taskId;
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

describe('任务日志', { timeout: 30000 }, () => {
  it('追加一条日志，id 由会话与事件 seq 派生，不做 git 提交', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    const commitsBefore = (await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim();

    await expect(
      appendTaskLogEntry(root, taskId, {
        sessionId: 'worker',
        seq: 7,
        type: 'user_message',
        text: '先别动',
      }),
    ).resolves.toBe('written');

    const entries = await readTaskLog(root, taskId);
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({
      id: 'worker:7',
      taskId,
      sessionId: 'worker',
      type: 'user_message',
      text: '先别动',
    });
    expect(entries[0]?.truncated).toBeUndefined();
    expect(Date.parse(entries[0]?.time ?? '')).not.toBeNaN();
    expect((await runGit(['rev-list', '--count', 'HEAD'], root)).stdout.trim()).toBe(commitsBefore);
  });

  it('同一事件重复观察时不重复写入', async () => {
    const root = await temporaryDirectory();
    const taskId = await newTask(new NotesStore(root), 'worker');
    const input = { sessionId: 'worker', seq: 3, type: 'user_message' as const, text: 'a' };
    await expect(appendTaskLogEntry(root, taskId, input)).resolves.toBe('written');
    await expect(appendTaskLogEntry(root, taskId, input)).resolves.toBe('duplicate');
    expect(await readTaskLog(root, taskId)).toHaveLength(1);
  });

  it('并发追加相同事件只写一条', async () => {
    const root = await temporaryDirectory();
    const taskId = await newTask(new NotesStore(root), 'worker');
    const input = { sessionId: 'worker', seq: 3, type: 'user_message' as const, text: 'a' };
    const results = await Promise.all([
      appendTaskLogEntry(root, taskId, input),
      appendTaskLogEntry(root, taskId, input),
    ]);
    expect([...results].sort()).toEqual(['duplicate', 'written']);
    expect(await readTaskLog(root, taskId)).toHaveLength(1);
  });

  it('任务不存在或已结束时丢弃且不创建文件', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    await store.endTask(taskId, 'cancelled');
    await expect(
      appendTaskLogEntry(root, taskId, {
        sessionId: 'worker',
        seq: 1,
        type: 'user_stop',
        text: '',
      }),
    ).resolves.toBe('dropped');
    expect(await exists(taskLogPath(root, taskId))).toBe(false);
    expect(await exists(join(root, 'task-logs'))).toBe(false);
  });

  it('原文超过上限时截断并标记', async () => {
    const root = await temporaryDirectory();
    const taskId = await newTask(new NotesStore(root), 'worker');
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 1,
      type: 'user_message',
      text: 'x'.repeat(TASK_LOG_TEXT_LIMIT + 50),
    });
    const [entry] = await readTaskLog(root, taskId);
    expect(entry?.text).toHaveLength(TASK_LOG_TEXT_LIMIT);
    expect(entry?.truncated).toBe(true);
  });

  it('读取时跳过损坏的行，文件缺失时为空', async () => {
    const root = await temporaryDirectory();
    const taskId = await newTask(new NotesStore(root), 'worker');
    expect(await readTaskLog(root, taskId)).toEqual([]);
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 1,
      type: 'user_message',
      text: 'ok',
    });
    await appendFile(taskLogPath(root, taskId), '{ broken\n{"id":1}\n', 'utf8');
    expect((await readTaskLog(root, taskId)).map((entry) => entry.id)).toEqual(['worker:1']);
  });

  it('任务结束时日志迁入归档，工作区保持干净', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 2,
      type: 'user_message',
      text: '直接回答',
    });
    expect(await exists(taskLogPath(root, taskId))).toBe(true);

    await store.endTask(taskId, 'completed');

    expect(await exists(taskLogPath(root, taskId))).toBe(false);
    const archived = join(root, 'archive', taskId, 'task-log.jsonl');
    expect(JSON.parse((await readFile(archived, 'utf8')).trim())).toMatchObject({
      id: 'worker:2',
      text: '直接回答',
    });
    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
    const tracked = (await runGit(['ls-files'], root)).stdout;
    expect(tracked).toContain(`archive/${taskId}/task-log.jsonl`);
    expect(tracked).not.toContain('task-logs/');
  });

  it('日志已被 git 跟踪时归档提交同时包含源文件的删除', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    await appendTaskLogEntry(root, taskId, {
      sessionId: 'worker',
      seq: 2,
      type: 'user_message',
      text: 'tracked',
    });
    await runGit(['add', '--', `./task-logs/${taskId}.jsonl`], root);
    await runGit(['commit', '-m', 'track log', '--', `./task-logs/${taskId}.jsonl`], root);

    await store.endTask(taskId, 'completed');

    expect((await runGit(['status', '--porcelain'], root)).stdout.trim()).toBe('');
    expect((await runGit(['ls-files'], root)).stdout).not.toContain('task-logs/');
  });

  it('没有日志的任务结束时不产生日志文件', async () => {
    const root = await temporaryDirectory();
    const store = new NotesStore(root);
    const taskId = await newTask(store, 'worker');
    await store.endTask(taskId, 'cancelled');
    expect(await exists(join(root, 'archive', taskId, 'task-log.jsonl'))).toBe(false);
  });
});
