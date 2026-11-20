// 状态文件测试：缺失回落、串行写入、去重窗口与损坏恢复。
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { SESSION_TITLE } from '../src/constants.ts';
import { StateStore } from '../src/state.ts';

/** 创建临时状态文件路径。 */
async function tempFile(): Promise<string> {
  const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-state-'));
  return path.join(dir, 'state.json');
}

describe('StateStore', () => {
  it('文件缺失时返回空状态', async () => {
    const store = new StateStore(await tempFile());
    const state = await store.load();
    expect(state.sessionId).toBeNull();
    expect(state.seen).toEqual({});
  });

  it('写入会话并读回', async () => {
    const file = await tempFile();
    const store = new StateStore(file);
    await store.patch({ sessionId: 's1', workspaceRoot: '/d/Git', title: SESSION_TITLE });

    const reloaded = new StateStore(file);
    expect(await reloaded.load()).toMatchObject({
      sessionId: 's1',
      workspaceRoot: '/d/Git',
      title: SESSION_TITLE,
    });
    expect(JSON.parse(await readFile(file, 'utf8'))).toMatchObject({ sessionId: 's1' });
  });

  it('状态路径读写均归一化为 Linux 风格', async () => {
    const file = await tempFile();
    const store = new StateStore(file);
    await store.patch({ workspaceRoot: 'D:\\Git\\Project\\' });
    expect((await store.load()).workspaceRoot).toBe('/d/Git/Project');
    expect(JSON.parse(await readFile(file, 'utf8')).workspaceRoot).toBe('/d/Git/Project');

    await writeFile(
      file,
      JSON.stringify({
        sessionId: 'legacy',
        workspaceRoot: 'D:\\Legacy\\Project',
        title: SESSION_TITLE,
        seen: {},
        updatedAt: '',
      }),
      'utf8',
    );
    expect((await new StateStore(file).load()).workspaceRoot).toBe('/d/Legacy/Project');
  });

  it('重复消息只标记一次', async () => {
    const store = new StateStore(await tempFile());
    expect(await store.markSeen('om_1', 100)).toBe(true);
    expect(await store.markSeen('om_1', 100)).toBe(false);
    expect(await store.markSeen('om_2', 200)).toBe(true);
  });

  it('去重窗口按上限淘汰最旧记录', async () => {
    const store = new StateStore(await tempFile(), 2);
    await store.markSeen('a', 1);
    await store.markSeen('b', 2);
    await store.markSeen('c', 3);
    expect(Object.keys((await store.load()).seen).sort()).toEqual(['b', 'c']);
  });

  it('并发写入不丢字段', async () => {
    const store = new StateStore(await tempFile());
    await Promise.all([
      store.patch({ sessionId: 's1' }),
      store.patch({ workspaceRoot: '/d/Git' }),
      store.patch({ title: SESSION_TITLE }),
    ]);
    expect(await store.load()).toMatchObject({
      sessionId: 's1',
      workspaceRoot: '/d/Git',
      title: SESSION_TITLE,
    });
  });

  it('不提供公开重置方法', async () => {
    const store = new StateStore(await tempFile());
    expect(store).not.toHaveProperty('resetSession');
  });

  it('损坏文件按空状态处理', async () => {
    const file = await tempFile();
    await writeFile(file, '{broken', 'utf8');
    const store = new StateStore(file);
    expect((await store.load()).seen).toEqual({});
  });
});
