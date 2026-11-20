// 桥接会话测试：工作区校验、创建/复用、标题、挂载、置顶与持久化。
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { PluginConfig } from '../src/config.ts';
import { SESSION_TITLE } from '../src/constants.ts';
import { SessionManager } from '../src/sessions.ts';
import { StateStore } from '../src/state.ts';
import { normalizeWorkspacePath, toHostWorkspacePath } from '../src/workspace-path.ts';

/** 构造会话管理器与内部记录；工作区使用真实临时目录以适配各平台。 */
async function setup(
  options: { workspaceRoot?: string; live?: boolean; registered?: boolean } = {},
) {
  const home = await mkdtemp(path.join(tmpdir(), 'lark-bridge-sessions-'));
  const workspaceDir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-workspace-'));
  const workspaceRoot = normalizeWorkspacePath(workspaceDir);
  const cwd = toHostWorkspacePath(workspaceRoot);
  const config: PluginConfig = { workspaceRoot: options.workspaceRoot ?? workspaceRoot };
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
  const archived: string[] = [];
  const registry = {
    archivedSessionIds: archived,
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
    workspaceRoot,
    workspace,
    archived,
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
    const { sessions, workspaceRoot, cwd } = await setup();
    const result = await sessions.ensure(workspaceRoot);
    expect(result).toMatchObject({ created: true, cwd });
  });

  it('目录存在但未注册时拒绝注入且不创建注册项或会话', async () => {
    const { sessions, resolveByPath, registryCreate, createAgent, followups, cwd } = await setup({
      registered: false,
    });
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-unregistered' });
    expect(resolveByPath).toHaveBeenCalledWith(cwd);
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
      workspaceRoot,
      resolveByPath,
      registryCreate,
    } = await setup();
    const result = await sessions.inject('飞书消息');
    expect(result.created).toBe(true);
    expect(resolveByPath).toHaveBeenCalledWith(cwd);
    expect(created[0]?.meta).toEqual({ cwd });
    expect(appended[0]?.[0]).toBe('session/title');
    expect(appended[0]?.[1]).toMatchObject({ title: SESSION_TITLE });
    expect(attached).toEqual([result.sessionId]);
    expect(pinned).toEqual([result.sessionId]);
    expect(registryCreate).not.toHaveBeenCalled();
    expect((await store.load()).sessionId).toBe(result.sessionId);
    expect((await store.load()).workspaceRoot).toBe(workspaceRoot);
    expect(followups[0]?.content).toEqual([
      { type: 'text', text: expect.stringContaining('<system-reminder>') },
    ]);
    expect(followups[0]?.source).toEqual({ kind: 'lark-bridge' });
  });

  it('followup 前再次解析工作区，注销后拒绝注入', async () => {
    const { sessions, workspace, resolveByPath, registryCreate, followups, cwd } = await setup();
    resolveByPath.mockResolvedValueOnce(workspace).mockResolvedValueOnce(undefined);
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-unregistered' });
    expect(resolveByPath).toHaveBeenCalledTimes(2);
    expect(resolveByPath).toHaveBeenNthCalledWith(1, cwd);
    expect(resolveByPath).toHaveBeenNthCalledWith(2, cwd);
    expect(registryCreate).not.toHaveBeenCalled();
    expect(followups).toHaveLength(0);
  });

  it('已有记录且会话可恢复时复用并同步固定标题', async () => {
    const { sessions, store, created, appended, followups } = await setup();
    const first = await sessions.inject('一');
    expect(created).toHaveLength(1);
    await store.patch({ title: '历史标题' });
    await sessions.inject('二');
    expect(created).toHaveLength(1);
    expect(appended[1]?.[0]).toBe('session/title');
    expect(appended[1]?.[1]).toMatchObject({ title: SESSION_TITLE });
    const state = await store.load();
    expect(state.sessionId).toBe(first.sessionId);
    expect(state.title).toBe(SESSION_TITLE);
    expect(followups).toHaveLength(2);
    expect(JSON.stringify(followups[1]?.content)).toContain('二');
  });

  it('归档会话恢复失败时新建并覆盖记录', async () => {
    const { sessions, store, created, workspaceRoot } = await setup();
    await store.patch({
      sessionId: 'gone',
      workspaceRoot,
      title: SESSION_TITLE,
    });
    const result = await sessions.inject('hi');
    expect(result.created).toBe(true);
    expect(created[0]?.sessionId).not.toBe('gone');
    expect((await store.load()).sessionId).toBe(result.sessionId);
  });

  it('已归档会话即使 Agent 存活也创建新会话', async () => {
    const { sessions, created, archived } = await setup({ live: true });
    const first = await sessions.inject('一');
    archived.push(first.sessionId);
    const second = await sessions.inject('二');
    expect(second.created).toBe(true);
    expect(second.sessionId).not.toBe(first.sessionId);
    expect(created).toHaveLength(2);
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

  it('不提供公开重置方法', async () => {
    const { sessions } = await setup();
    expect(sessions).not.toHaveProperty('reset');
  });

  it('isBridgeSession 只识别状态文件记录的会话', async () => {
    const { sessions } = await setup();
    const result = await sessions.inject('<lark-message message_id="om_1">hi</lark-message>');
    expect(await sessions.isBridgeSession({ id: result.sessionId } as never)).toBe(true);
    expect(await sessions.isBridgeSession({ id: 'other' } as never)).toBe(false);
  });

  it('尚无会话记录时 isBridgeSession 为 false', async () => {
    const { sessions } = await setup();
    expect(await sessions.isBridgeSession({ id: 's1' } as never)).toBe(false);
  });
});
