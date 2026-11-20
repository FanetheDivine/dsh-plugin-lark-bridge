// 桥接会话测试：工作区校验、创建/复用、标题、挂载、置顶与持久化。
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { PluginConfig } from '../src/config.ts';
import { SessionManager } from '../src/sessions.ts';
import { StateStore } from '../src/state.ts';

const CONFIG: PluginConfig = {
  workspaceRoot: '/d/Git',
  sessionTitle: '飞书',
  larkCli: '',
  authCheckOnStartup: true,
};
const HOST_CWD = 'D:/Git';

/** 构造会话管理器与内部记录。 */
async function setup(
  options: { workspaceRoot?: string; live?: boolean; registered?: boolean } = {},
) {
  const home = await mkdtemp(path.join(tmpdir(), 'lark-bridge-sessions-'));
  const cwd = HOST_CWD;
  const config = { ...CONFIG, workspaceRoot: options.workspaceRoot ?? CONFIG.workspaceRoot };
  const store = new StateStore(path.join(home, 'state.json'));

  const appended: Array<[string, unknown]> = [];
  const followups: Array<{ content: unknown; source: unknown }> = [];
  const attached: string[] = [];
  const pinned: string[] = [];
  const created: Array<{ sessionId: string; meta: unknown }> = [];
  let liveAgent: unknown;

  const agent = {
    session: {
      append: (type: string, data: unknown) => appended.push([type, data]),
    },
    followup: (message: { content: unknown; source: unknown }) => followups.push(message),
  };
  const workspace = {
    sessionIds: [] as string[],
    attachSession: async (id: string) => attached.push(id),
  };
  const resolveByPath = vi.fn(async (_cwd: string) =>
    options.registered === false ? undefined : workspace,
  );
  const registryCreate = vi.fn(async () => workspace);
  const createAgent = vi.fn(
    async (opts: {
      sessionId: string;
      meta: unknown;
      setup: (ctx: unknown, child: unknown) => Promise<void>;
    }) => {
      created.push({ sessionId: opts.sessionId, meta: opts.meta });
      await opts.setup({}, agent);
      liveAgent = agent;
      return { agent, dispose: async () => undefined };
    },
  );
  const agents = {
    get: () => (options.live === true ? liveAgent : undefined),
    create: createAgent,
    resume: async ({ resumeSessionId }: { resumeSessionId: string }) => {
      if (resumeSessionId === 'gone') throw new Error('session missing');
      liveAgent = agent;
      return { agent, dispose: async () => undefined };
    },
  };
  const registry = {
    resolveByPath,
    create: registryCreate,
    pinSession: async (id: string) => pinned.push(id),
  };
  const ctx = {
    agents,
    get: (name: string) => {
      if (name === 'workspaceRegistry') return registry;
      if (name === 'agentDefaultModel') return undefined;
      return undefined;
    },
  };
  const logger = { info: vi.fn(), warn: vi.fn() };
  const sessions = new SessionManager({
    ctx: ctx as never,
    store,
    getConfig: () => config,
    logger,
  });
  return {
    sessions,
    store,
    created,
    attached,
    pinned,
    appended,
    followups,
    agent,
    cwd,
    workspace,
    resolveByPath,
    registryCreate,
    createAgent,
  };
}

describe('SessionManager', () => {
  it('工作区无效时抛 workspace-invalid', async () => {
    const { sessions } = await setup({ workspaceRoot: '/definitely/missing/path' });
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-invalid' });
  });

  it('ensure 返回 Host 原生 cwd', async () => {
    const { sessions } = await setup();
    const result = await sessions.ensure(CONFIG.workspaceRoot);
    expect(result).toMatchObject({ created: true, cwd: HOST_CWD });
  });

  it('目录存在但未注册时拒绝注入且不创建注册项或会话', async () => {
    const { sessions, resolveByPath, registryCreate, createAgent, followups } = await setup({
      registered: false,
    });
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-unregistered' });
    expect(resolveByPath).toHaveBeenCalledWith(HOST_CWD);
    expect(registryCreate).not.toHaveBeenCalled();
    expect(createAgent).not.toHaveBeenCalled();
    expect(followups).toHaveLength(0);
  });

  it('首次注入创建会话、设置标题、挂载并置顶', async () => {
    const {
      sessions,
      store,
      created,
      attached,
      pinned,
      appended,
      followups,
      cwd,
      resolveByPath,
      registryCreate,
    } = await setup();
    const result = await sessions.inject('飞书消息');
    expect(result.created).toBe(true);
    expect(resolveByPath).toHaveBeenCalledWith(HOST_CWD);
    expect(created[0]?.meta).toEqual({ cwd });
    expect(appended[0]?.[0]).toBe('session/title');
    expect(appended[0]?.[1]).toMatchObject({ title: '飞书' });
    expect(attached).toEqual([result.sessionId]);
    expect(pinned).toEqual([result.sessionId]);
    expect(registryCreate).not.toHaveBeenCalled();
    expect((await store.load()).sessionId).toBe(result.sessionId);
    expect((await store.load()).workspaceRoot).toBe(CONFIG.workspaceRoot);
    expect(followups[0]?.content).toEqual([
      { type: 'text', text: expect.stringContaining('<system-reminder>') },
    ]);
    expect(followups[0]?.source).toEqual({ kind: 'lark-bridge' });
  });

  it('followup 前再次解析工作区，注销后拒绝注入', async () => {
    const { sessions, workspace, resolveByPath, registryCreate, followups } = await setup();
    resolveByPath.mockResolvedValueOnce(workspace).mockResolvedValueOnce(undefined);
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-unregistered' });
    expect(resolveByPath).toHaveBeenCalledTimes(2);
    expect(resolveByPath).toHaveBeenNthCalledWith(1, HOST_CWD);
    expect(resolveByPath).toHaveBeenNthCalledWith(2, HOST_CWD);
    expect(registryCreate).not.toHaveBeenCalled();
    expect(followups).toHaveLength(0);
  });

  it('已有记录且会话可恢复时复用', async () => {
    const { sessions, store, created, followups } = await setup();
    const first = await sessions.inject('一');
    expect(created).toHaveLength(1);
    await sessions.inject('二');
    expect(created).toHaveLength(1);
    const state = await store.load();
    expect(state.sessionId).toBe(first.sessionId);
    expect(followups).toHaveLength(2);
    expect(JSON.stringify(followups[1]?.content)).toContain('二');
  });

  it('恢复失败时新建并覆盖记录', async () => {
    const { sessions, store, created } = await setup();
    await store.patch({ sessionId: 'gone', workspaceRoot: CONFIG.workspaceRoot, title: '飞书' });
    const result = await sessions.inject('hi');
    expect(result.created).toBe(true);
    expect(created[0]?.sessionId).not.toBe('gone');
    expect((await store.load()).sessionId).toBe(result.sessionId);
  });

  it('工作区变更后新建会话', async () => {
    const { sessions, store, created } = await setup();
    await sessions.inject('一');
    await store.patch({ workspaceRoot: '/other' });
    const result = await sessions.inject('二');
    expect(result.created).toBe(true);
    expect(created).toHaveLength(2);
  });

  it('未配置工作区时抛 workspace-missing', async () => {
    const { sessions } = await setup({ workspaceRoot: '' });
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-missing' });
  });

  it('reset 清除会话记录', async () => {
    const { sessions, store } = await setup();
    await sessions.inject('一');
    await sessions.reset();
    expect((await store.load()).sessionId).toBeNull();
  });
});
