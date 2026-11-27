// 归档通知记录测试：追加、按时间读取、删除与损坏文件回落。
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import {
  ARCHIVE_NOTICES_FILE,
  appendArchiveNotice,
  readArchiveNotices,
  removeArchiveNotices,
} from '../src/lark-super-agent/archive-notices.ts';

const directories: string[] = [];

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'archive-notices-'));
  directories.push(directory);
  return directory;
}

afterEach(async () => {
  await Promise.all(directories.splice(0).map((directory) => rm(directory, { recursive: true })));
});

const notice = (taskId: string, time: string) => ({
  id: `${taskId}:${time}`,
  taskId,
  sessionId: 'worker',
  time,
});

describe('归档通知记录', () => {
  it('追加后按时间升序读取', async () => {
    const root = await temporaryDirectory();
    await appendArchiveNotice(root, notice('task-b', '2026-11-27T10:00:00.000+08:00'));
    await appendArchiveNotice(root, notice('task-a', '2026-11-27T09:00:00.000+08:00'));

    await expect(readArchiveNotices(root)).resolves.toEqual([
      notice('task-a', '2026-11-27T09:00:00.000+08:00'),
      notice('task-b', '2026-11-27T10:00:00.000+08:00'),
    ]);
  });

  it('同 id 只保留一条', async () => {
    const root = await temporaryDirectory();
    const item = notice('task-a', '2026-11-27T09:00:00.000+08:00');
    await expect(appendArchiveNotice(root, item)).resolves.toBe('written');
    await expect(appendArchiveNotice(root, item)).resolves.toBe('duplicate');
    await expect(readArchiveNotices(root)).resolves.toHaveLength(1);
  });

  it('按条件删除并返回条数', async () => {
    const root = await temporaryDirectory();
    await appendArchiveNotice(root, notice('task-a', '2026-11-27T09:00:00.000+08:00'));
    await appendArchiveNotice(root, notice('task-b', '2026-11-27T10:00:00.000+08:00'));

    await expect(removeArchiveNotices(root, (item) => item.taskId === 'task-a')).resolves.toBe(1);
    await expect(removeArchiveNotices(root, () => false)).resolves.toBe(0);
    await expect(readArchiveNotices(root)).resolves.toEqual([
      notice('task-b', '2026-11-27T10:00:00.000+08:00'),
    ]);
  });

  it('文件缺失、损坏或字段不合格时按空列表，下次写入覆盖', async () => {
    const root = await temporaryDirectory();
    await expect(readArchiveNotices(root)).resolves.toEqual([]);

    await writeFile(join(root, ARCHIVE_NOTICES_FILE), '{broken', 'utf8');
    await expect(readArchiveNotices(root)).resolves.toEqual([]);

    await writeFile(
      join(root, ARCHIVE_NOTICES_FILE),
      JSON.stringify({
        version: 1,
        notices: [
          {
            id: 'ok',
            taskId: 'task-a',
            sessionId: 'worker',
            time: '2026-11-27T09:00:00.000+08:00',
          },
          { id: 'missing-session', taskId: 'task-b', time: '2026-11-27T10:00:00.000+08:00' },
          { id: 'bad-time', taskId: 'task-c', sessionId: 'worker', time: 'not-a-time' },
        ],
      }),
      'utf8',
    );
    await expect(readArchiveNotices(root)).resolves.toEqual([
      {
        id: 'ok',
        taskId: 'task-a',
        sessionId: 'worker',
        time: '2026-11-27T09:00:00.000+08:00',
      },
    ]);

    await appendArchiveNotice(root, notice('task-d', '2026-11-27T11:00:00.000+08:00'));
    const written = JSON.parse(await readFile(join(root, ARCHIVE_NOTICES_FILE), 'utf8')) as {
      version: number;
      notices: unknown[];
    };
    expect(written.version).toBe(1);
    expect(written.notices).toHaveLength(2);
  });

  it('版本不符时按空处理', async () => {
    const root = await temporaryDirectory();
    await writeFile(
      join(root, ARCHIVE_NOTICES_FILE),
      JSON.stringify({ version: 2, notices: [notice('task-a', '2026-11-27T09:00:00.000+08:00')] }),
      'utf8',
    );
    await expect(readArchiveNotices(root)).resolves.toEqual([]);
  });
});
