// 桥接会话测试：工作区校验、创建/复用、标题、挂载、置顶与持久化。
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_CONFIG, type PluginConfig } from '../src/config.ts';
import { SESSION_TITLE } from '../src/constants.ts';
import { SessionManager } from '../src/sessions.ts';
import { StateStore } from '../src/state.ts';
import { normalizeWorkspacePath, toHostWorkspacePath } from '../src/workspace-path.ts';

/** 构造会话管理器与内部记录；工作区使用真实临时目录以适配各平台。 */
async function setup(
  options: {
    workspaceRoot?: string;
    live?: boolean;
    registered?: boolean;
    config?: Partial<PluginConfig>;
    llm?: 'available' | 'missing' | 'rejects';
    controller?: 'available' | 'missing';
    resolveFails?: boolean;
    presets?: readonly { id: string; broken?: string }[] | 'rejects' | 'missing';
    status?: 'idle' | 'running';
    pendingStep?: readonly {
      readonly id: string;
      readonly role: 'user';
      readonly content: unknown;
      readonly source: { readonly kind: string };
    }[];
    steerError?: boolean;
    prependError?: boolean;
    steerSettlesIdle?: boolean;
    prependSettlesIdle?: boolean;
  } = {},
) {
  const home = await mkdtemp(path.join(tmpdir(), 'lark-bridge-sessions-'));
  const workspaceDir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-workspace-'));
  const workspaceRoot = normalizeWorkspacePath(workspaceDir);
  const cwd = toHostWorkspacePath(workspaceRoot);
  const config: PluginConfig = {
    ...DEFAULT_CONFIG,
    workspaceRoot: options.workspaceRoot ?? workspaceRoot,
    ...options.config,
  };
  const store = new StateStore(path.join(home, 'state.json'));

  const appended: Array<[string, unknown]> = [];
  const followups: Array<{ content: unknown; source: unknown }> = [];
  const steered: Array<{ content: unknown; source: unknown }> = [];
  const prepended: Array<{ target: string; content: unknown; source: unknown }> = [];
  const nextStep: Array<{
    id: string;
    role: 'user';
    content: unknown;
    source: { kind: string };
  }> = [...(options.pendingStep ?? [])];
  let status: 'idle' | 'running' = options.status ?? 'idle';
  const attached: string[] = [];
  const pinned: string[] = [];
  const created: Array<{
    sessionId: string;
    meta: unknown;
    workspaceId?: string;
    agentPreset?: string;
  }> = [];
  let liveAgent: unknown;

  const selections: unknown[] = [];
  const agent = {
    session: {
      append: (type: string, data: unknown) => appended.push([type, data]),
    },
    model: {
      select: (selection: unknown) => selections.push(selection),
    },
    get status() {
      return status;
    },
    inbox: {
      get nextStep() {
        return nextStep;
      },
      prepend: (
        target: string,
        message: { id: string; content: unknown; source: { kind: string } },
      ) => {
        if (options.prependError === true) throw new Error('inbox prepend unavailable');
        prepended.push({ target, content: message.content, source: message.source });
        nextStep.unshift({
          id: message.id,
          role: 'user',
          content: message.content,
          source: message.source,
        });
        if (options.prependSettlesIdle === true) status = 'idle';
      },
      remove: (id: string) => {
        const index = nextStep.findIndex((item) => item.id === id);
        if (index < 0) return false;
        nextStep.splice(index, 1);
        return true;
      },
    },
    followup: (message: { content: unknown; source: unknown }) => followups.push(message),
    steer: (message: { id: string; content: unknown; source: { kind: string } }) => {
      if (options.steerError === true) throw new Error('steering unavailable');
      steered.push(message);
      nextStep.push({
        id: message.id,
        role: 'user',
        content: message.content,
        source: message.source,
      });
      if (options.steerSettlesIdle === true) status = 'idle';
    },
  };
  const workspace = {
    id: 'ws-one',
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
      if (opts.setup !== undefined) await opts.setup({}, agent);
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
  const controllerRequests: Array<{ workspaceId: string; agentPreset?: string }> = [];
  const controllerCreate = vi.fn(async (request: { workspaceId: string; agentPreset?: string }) => {
    controllerRequests.push(request);
    const sessionId = `session-${controllerRequests.length}`;
    created.push({
      sessionId,
      meta: { cwd },
      workspaceId: request.workspaceId,
      ...(request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }),
    });
    liveAgent = agent;
    return {
      sessionId,
      ...(request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }),
    };
  });
  const sessionController =
    options.controller === 'missing'
      ? undefined
      : {
          create: controllerCreate,
          resolveAgent: async (id: unknown) =>
            options.resolveFails === true || String(id) === 'gone'
              ? { error: new Error('session missing') }
              : { agent },
        };
  const presetsList = vi.fn(async () => {
    if (options.presets === 'rejects') throw new Error('roster failed');
    return options.presets ?? [];
  });
  const presets = options.presets === 'missing' ? undefined : { list: presetsList };
  const archived: string[] = [];
  const registry = {
    archivedSessionIds: archived,
    resolveByPath,
    create: registryCreate,
    pinSession: async (id: string) => pinned.push(id),
  };
  const resolveCallConfig = vi.fn(async () => {
    if (options.llm === 'rejects') throw new Error('unsupported route');
    return {};
  });
  const llm = options.llm === 'missing' ? undefined : { resolveCallConfig };
  const ctx = {
    agents,
    get: (name: string) => {
      if (name === 'workspaceRegistry') return registry;
      if (name === 'agentDefaultModel') return undefined;
      if (name === 'llm') return llm;
      if (name === 'sessionController') return sessionController;
      if (name === 'agentPresets') return presets;
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
    steered,
    prepended,
    nextStep,
    setStatus: (value: 'idle' | 'running') => {
      status = value;
    },
    agent,
    cwd,
    workspaceRoot,
    workspace,
    archived,
    resolveByPath,
    registryCreate,
    createAgent,
    selections,
    resolveCallConfig,
    controllerCreate,
    controllerRequests,
    presetsList,
    logger,
  };
}

describe('SessionManager', () => {
  it('工作区无效时抛 workspace-invalid', async () => {
    const { sessions } = await setup({ workspaceRoot: '/definitely/missing/path' });
    await expect(sessions.inject('hi')).rejects.toMatchObject({ code: 'workspace-invalid' });
  });

  it('ensureDispatchSession 在没有飞书消息时创建调度会话', async () => {
    const { sessions, created, store, workspaceRoot } = await setup();
    const result = await sessions.ensureDispatchSession(workspaceRoot);
    expect(created).toHaveLength(1);
    expect(result.sessionId).toBe(created[0]?.sessionId);
    expect((await store.load()).sessionId).toBe(result.sessionId);
  });

  it('并发 ensure 只创建一次会话', async () => {
    const { sessions, created, workspaceRoot } = await setup();
    const [first, second] = await Promise.all([
      sessions.ensure(workspaceRoot),
      sessions.ensure(workspaceRoot),
    ]);
    expect(created).toHaveLength(1);
    expect(first.sessionId).toBe(second.sessionId);
    expect(first.created).toBe(true);
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
    expect(appended[0]?.[1]).toMatchObject({ title: '飞书桥接会话' });
    expect(attached).toEqual([result.sessionId]);
    expect(pinned).toEqual([result.sessionId]);
    expect(registryCreate).not.toHaveBeenCalled();
    expect((await store.load()).sessionId).toBe(result.sessionId);
    expect((await store.load()).workspaceRoot).toBe(workspaceRoot);
    expect(followups[0]?.content).toEqual([{ type: 'text', text: '飞书消息' }]);
    expect(followups[0]?.source).toEqual({ kind: 'lark-bridge' });
  });

  it('创建请求只向宿主传工作区标识', async () => {
    const { sessions, controllerRequests } = await setup();
    await sessions.inject('hi');
    expect(controllerRequests).toHaveLength(1);
    expect(controllerRequests[0]).toEqual({ workspaceId: 'ws-one' });
    expect(controllerRequests[0]).not.toHaveProperty('cwd');
    expect(controllerRequests[0]).not.toHaveProperty('sessionId');
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

  it('已有记录且会话可恢复时复用并保留已有标题', async () => {
    const { sessions, store, created, appended, followups } = await setup();
    const first = await sessions.inject('一');
    expect(created).toHaveLength(1);
    await store.patch({ title: '历史标题' });
    await sessions.inject('二');
    expect(created).toHaveLength(1);
    expect(appended.filter(([type]) => type === 'session/title')).toHaveLength(1);
    const state = await store.load();
    expect(state.sessionId).toBe(first.sessionId);
    expect(state.title).toBe('历史标题');
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

describe('运行中插话', () => {
  /** 其他来源的 next-step 消息，例如 worker 上报。 */
  function workerStep(id = 'worker-1') {
    return {
      id,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: 'worker 上报' }],
      source: { kind: 'worker-report' },
    };
  }

  /** 本插件已排队但尚未被领用的消息。 */
  function larkStep(id = 'lark-1') {
    return {
      id,
      role: 'user' as const,
      content: [{ type: 'text' as const, text: '早先的飞书消息' }],
      source: { kind: 'lark-bridge' },
    };
  }

  it('空闲时用 followup 开新 turn', async () => {
    const { sessions, followups, steered } = await setup();
    await sessions.inject('空闲消息');
    expect(followups).toHaveLength(1);
    expect(steered).toHaveLength(0);
  });

  it('运行中用 steer 并入当前 turn', async () => {
    const { sessions, followups, steered, nextStep } = await setup({ status: 'running' });
    await sessions.inject('运行中消息');
    expect(followups).toHaveLength(0);
    expect(steered).toHaveLength(1);
    expect(steered[0]?.content).toEqual([{ type: 'text', text: '运行中消息' }]);
    expect(steered[0]?.source).toEqual({ kind: 'lark-bridge' });
    expect(nextStep).toHaveLength(1);
  });

  it('运行中已有 worker 消息时插到 next-step 队列之前', async () => {
    const { sessions, followups, steered, prepended, nextStep } = await setup({
      status: 'running',
      pendingStep: [workerStep()],
    });
    await sessions.inject('用户新消息');
    expect(followups).toHaveLength(0);
    expect(steered).toHaveLength(0);
    expect(prepended).toHaveLength(1);
    expect(prepended[0]?.target).toBe('next-step');
    expect(nextStep.map((item) => String(item.source.kind))).toEqual([
      'lark-bridge',
      'worker-report',
    ]);
  });

  it('运行中已有本插件消息时继续追加，保持先后顺序', async () => {
    const { sessions, steered, prepended, nextStep } = await setup({
      status: 'running',
      pendingStep: [larkStep()],
    });
    await sessions.inject('一');
    await sessions.inject('二');
    expect(prepended).toHaveLength(0);
    expect(steered).toHaveLength(2);
    expect(JSON.stringify(nextStep[1]?.content)).toContain('一');
    expect(JSON.stringify(nextStep[2]?.content)).toContain('二');
  });

  it('steer 不可用时回退 followup', async () => {
    const { sessions, followups, steered, logger } = await setup({
      status: 'running',
      steerError: true,
    });
    await sessions.inject('回退消息');
    expect(steered).toHaveLength(0);
    expect(followups).toHaveLength(1);
    expect(JSON.stringify(followups[0]?.content)).toContain('回退消息');
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('falling back to followup'));
  });

  it('prepend 不可用时回退 steer', async () => {
    const { sessions, followups, steered, logger } = await setup({
      status: 'running',
      pendingStep: [workerStep()],
      prependError: true,
    });
    await sessions.inject('回退消息');
    expect(followups).toHaveLength(0);
    expect(steered).toHaveLength(1);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cannot prepend'));
  });

  it('steer 落在 turn 结束竞态时改为 followup，不丢消息', async () => {
    const { sessions, followups, steered, nextStep, logger } = await setup({
      status: 'running',
      steerSettlesIdle: true,
    });
    await sessions.inject('竞态消息');
    expect(steered).toHaveLength(1);
    expect(followups).toHaveLength(1);
    expect(JSON.stringify(followups[0]?.content)).toContain('竞态消息');
    expect(nextStep).toHaveLength(0);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('steering landed after the turn ended'),
    );
  });

  it('prepend 落在 turn 结束竞态时改为 followup，不丢消息', async () => {
    const { sessions, followups, prepended, nextStep, logger } = await setup({
      status: 'running',
      pendingStep: [workerStep()],
      prependSettlesIdle: true,
    });
    await sessions.inject('竞态消息');
    expect(prepended).toHaveLength(1);
    expect(followups).toHaveLength(1);
    expect(JSON.stringify(followups[0]?.content)).toContain('竞态消息');
    expect(nextStep.map((item) => String(item.source.kind))).toEqual(['worker-report']);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('steering landed after the turn ended'),
    );
  });
});

describe('新建会话的模型配置', () => {
  it('配置成对模型时校验并写入新会话', async () => {
    const { sessions, selections, resolveCallConfig } = await setup({
      config: { sessionProvider: 'deepseek', sessionModel: 'deepseek-chat', sessionEffort: 'high' },
    });
    await sessions.inject('hi');
    expect(resolveCallConfig).toHaveBeenCalledWith({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    expect(selections).toEqual([
      { provider: 'deepseek', model: 'deepseek-chat', reasoningEffort: 'high' },
    ]);
  });

  it('未配置模型时不校验也不写入', async () => {
    const { sessions, selections, resolveCallConfig } = await setup();
    await sessions.inject('hi');
    expect(resolveCallConfig).not.toHaveBeenCalled();
    expect(selections).toEqual([]);
  });

  it('半组配置按未配置处理', async () => {
    const { sessions, selections, resolveCallConfig } = await setup({
      config: { sessionProvider: 'deepseek' },
    });
    await sessions.inject('hi');
    expect(resolveCallConfig).not.toHaveBeenCalled();
    expect(selections).toEqual([]);
  });

  it('模型校验失败时回退宿主默认并记录警告', async () => {
    const { sessions, selections, logger } = await setup({
      config: { sessionProvider: 'deepseek', sessionModel: 'missing' },
      llm: 'rejects',
    });
    await expect(sessions.inject('hi')).resolves.toMatchObject({ created: true });
    expect(selections).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('configured model is unavailable'),
    );
  });

  it('缺少 llm 服务时跳过模型配置并记录警告', async () => {
    const { sessions, selections, logger } = await setup({
      config: { sessionProvider: 'deepseek', sessionModel: 'deepseek-chat' },
      llm: 'missing',
    });
    await sessions.inject('hi');
    expect(selections).toEqual([]);
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('llm service is unavailable'));
  });

  it('复用已有会话时不写入模型', async () => {
    const { sessions, selections } = await setup({
      live: true,
      config: { sessionProvider: 'deepseek', sessionModel: 'deepseek-chat' },
    });
    await sessions.inject('一');
    const selectionsAfterFirst = selections.length;
    await sessions.inject('二');
    expect(selections.length).toBe(selectionsAfterFirst);
  });
});

describe('新建会话的预设配置', () => {
  it('可用预设传给会话控制服务', async () => {
    const { sessions, controllerCreate, presetsList } = await setup({
      config: { sessionPreset: 'bridge' },
      presets: [{ id: 'bridge', name: '桥接' }],
    });
    await sessions.inject('hi');
    expect(presetsList).toHaveBeenCalled();
    expect(controllerCreate).toHaveBeenCalledWith(
      expect.objectContaining({ agentPreset: 'bridge', workspaceId: 'ws-one' }),
    );
    expect(controllerCreate.mock.calls[0]?.[0]).not.toHaveProperty('sessionId');
  });

  it('名册标记损坏的预设按不可用处理并记录警告', async () => {
    const { sessions, controllerCreate, logger } = await setup({
      config: { sessionPreset: 'broken' },
      presets: [{ id: 'broken', broken: 'missing files' }],
    });
    await sessions.inject('hi');
    expect(controllerCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ agentPreset: expect.anything() }),
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('configured preset'));
  });

  it('名册读取失败时省略预设并记录警告', async () => {
    const { sessions, controllerCreate, logger } = await setup({
      config: { sessionPreset: 'bridge' },
      presets: 'rejects',
    });
    await sessions.inject('hi');
    expect(controllerCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ agentPreset: expect.anything() }),
    );
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('cannot read agent presets'));
  });

  it('缺少预设服务时省略预设且不记录警告', async () => {
    const { sessions, controllerCreate, logger } = await setup({
      config: { sessionPreset: 'bridge' },
      presets: 'missing',
    });
    await sessions.inject('hi');
    expect(controllerCreate).toHaveBeenCalledWith(
      expect.not.objectContaining({ agentPreset: expect.anything() }),
    );
    expect(logger.warn).not.toHaveBeenCalledWith(expect.stringContaining('preset'));
  });

  it('缺少会话控制服务时回退 agent 工厂并记录警告', async () => {
    const { sessions, createAgent, logger } = await setup({
      controller: 'missing',
      config: { sessionPreset: 'bridge' },
      presets: [{ id: 'bridge' }],
    });
    await sessions.inject('hi');
    expect(createAgent).toHaveBeenCalled();
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('preset was ignored'));
  });

  it('解析新会话失败时使用存活 Agent 并记录警告', async () => {
    const { sessions, selections, logger } = await setup({
      live: true,
      resolveFails: true,
      config: { sessionProvider: 'deepseek', sessionModel: 'deepseek-chat' },
    });
    await expect(sessions.inject('hi')).resolves.toMatchObject({ created: true });
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining('cannot resolve the new session'),
    );
    expect(selections).toHaveLength(1);
  });

  it('新会话无法解析且没有存活 Agent 时注入失败', async () => {
    const { sessions } = await setup({ resolveFails: true });
    await expect(sessions.inject('hi')).rejects.toThrow('session missing');
  });

  it('预设为空时不读取名册', async () => {
    const { sessions, presetsList } = await setup({ config: { sessionPreset: '' } });
    await sessions.inject('hi');
    expect(presetsList).not.toHaveBeenCalled();
  });
});
