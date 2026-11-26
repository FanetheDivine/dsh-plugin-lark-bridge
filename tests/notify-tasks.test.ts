// 任务解析测试：按 task_id 读取台账，覆盖未配置工作区、台账损坏与任务缺失。
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';

import { resolveTask } from '../src/notify-tasks.ts';

const directories: string[] = [];

async function temporary(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'notify-tasks-'));
  directories.push(directory);
  return directory;
}

async function setup(workspaceRoot: string | null, ledger?: unknown) {
  const home = await temporary();
  await mkdir(join(home, 'lark-bridge'), { recursive: true });
  await writeFile(
    join(home, 'lark-bridge', 'state.json'),
    JSON.stringify({ sessionId: 'dispatch', workspaceRoot }),
    'utf8',
  );
  if (workspaceRoot !== null && ledger !== undefined) {
    await writeFile(
      join(workspaceRoot, 'message-task-status.json'),
      typeof ledger === 'string' ? ledger : JSON.stringify(ledger),
      'utf8',
    );
  }
  return home;
}

const task = {
  id: 'task-20260101000000-abcd',
  title: '修复登录',
  status: 'in_progress',
  sessionId: 'worker-1',
  workspaceId: null,
  cwd: '/tmp',
  reportIds: [],
  messages: [{ text: 'start', time: '2026-01-01T00:00:00.000+08:00' }],
  createdAt: '2026-01-01T00:00:00.000+08:00',
  updatedAt: '2026-01-01T00:00:00.000+08:00',
};

afterEach(async () => {
  await Promise.all(directories.splice(0).map((d) => rm(d, { recursive: true, force: true })));
});

describe('resolveTask', () => {
  it('返回未结束任务的标题与任务会话', async () => {
    const root = await temporary();
    const home = await setup(root, { version: 2, tasks: [task] });
    await expect(resolveTask(task.id, home)).resolves.toEqual({
      id: task.id,
      title: '修复登录',
      sessionId: 'worker-1',
    });
  });

  it('任务不存在或已结束时抛 task-not-found', async () => {
    const root = await temporary();
    const home = await setup(root, { version: 2, tasks: [] });
    await expect(resolveTask('task-20260101000000-ffff', home)).rejects.toMatchObject({
      code: 'task-not-found',
    });
  });

  it('未配置调度工作区时抛 task-ledger-unavailable', async () => {
    const home = await setup(null);
    await expect(resolveTask(task.id, home)).rejects.toMatchObject({
      code: 'task-ledger-unavailable',
    });
  });

  it('台账校验失败时抛 task-ledger-unavailable 而不是 task-not-found', async () => {
    const root = await temporary();
    const home = await setup(root, '{ not json');
    await expect(resolveTask(task.id, home)).rejects.toMatchObject({
      code: 'task-ledger-unavailable',
    });
  });
});
