// SA-调度会话 session_create 覆写测试：与 meta-tools 一致的参数与返回，以及「工作会话模型」的套用。
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { apply } from '../src/sa-dispatch/index.ts';
import { buildSessionCreateTool, WORKER_PRESET } from '../src/sa-dispatch/session-create.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

const WORKER = { provider: 'mock', model: 'mock-worker', reasoningEffort: 'high' } as const;

/** 构造一组可观察的依赖。 */
function makeDeps(
  options: {
    worker?: typeof WORKER | undefined;
    llm?: { resolveCallConfig: ReturnType<typeof vi.fn> } | null;
    presets?: { id: string; broken?: string }[] | null;
  } = {},
) {
  const select = vi.fn();
  const steer = vi.fn();
  const agent = { model: { select }, steer };
  const create = vi.fn(async () => ({ sessionId: 'session-new', agentPreset: WORKER_PRESET }));
  const rename = vi.fn(async (request: { title: string }) => ({ title: request.title }));
  const resolveAgent = vi.fn(async () => ({ agent }));
  const llm =
    options.llm === null
      ? undefined
      : (options.llm ?? { resolveCallConfig: vi.fn(async () => ({})) });
  const presets =
    options.presets === null ? undefined : (options.presets ?? [{ id: WORKER_PRESET }]);
  const warn = vi.fn();
  const tool = buildSessionCreateTool({
    sessionController: { create, rename, resolveAgent } as never,
    llm: llm as never,
    agentPresets: presets === undefined ? undefined : { list: async () => presets },
    workerModel: () => options.worker as never,
    logger: { warn },
  });
  return { tool, select, steer, create, rename, resolveAgent, llm, warn };
}

/** 执行工具；调用方会话的目录固定。 */
function run(tool: ToolDefinition, args: Record<string, unknown>) {
  const exec = {
    signal: new AbortController().signal,
    agent: { session: { header: { cwd: '/caller' } } },
  } as unknown as ToolRunContext;
  return tool.execute(args as never, exec);
}

describe('session_create 的契约', () => {
  it('名称、参数与描述与 meta-tools 一致', () => {
    const { tool } = makeDeps();
    expect(tool.name).toBe('session_create');
    expect(tool.description).toBe(
      'Create a DSH (DeepSeek Harness) session, optionally in a workspace or directory, with an agent preset, an optional provider/model/effort selection, a title, and a first prompt. The preset defaults to the plugin default when the host offers it, otherwise to the deployment default. Returns the new session id.',
    );
    expect(Object.keys((tool.parameters as { properties: object }).properties)).toEqual([
      'workspace_id',
      'cwd',
      'agent_preset',
      'provider',
      'model',
      'effort',
      'title',
      'prompt',
    ]);
  });

  it('返回会话 id、预设、标题与 prompted', async () => {
    const deps = makeDeps();
    expect(await run(deps.tool, { workspace_id: 'w', title: ' T ', prompt: ' go ' })).toEqual({
      sessionId: 'session-new',
      agentPreset: WORKER_PRESET,
      title: 'T',
      prompted: true,
    });
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w', agentPreset: WORKER_PRESET });
    expect(deps.rename).toHaveBeenCalledWith({ sessionId: 'session-new', title: 'T' });
    const message = deps.steer.mock.calls[0]?.[0] as {
      content: unknown;
      source: unknown;
    };
    expect(message.source).toEqual({ kind: 'dsh-plugin-meta-tools' });
    expect(message.content).toEqual([{ type: 'text', text: 'go' }]);
  });

  it('省略 workspace_id 与 cwd 时落在调用方目录，cwd 与 workspace_id 互斥', async () => {
    const deps = makeDeps();
    await run(deps.tool, {});
    expect(deps.create).toHaveBeenLastCalledWith({ cwd: '/caller', agentPreset: WORKER_PRESET });
    await run(deps.tool, { cwd: '/other' });
    expect(deps.create).toHaveBeenLastCalledWith({ cwd: '/other', agentPreset: WORKER_PRESET });
    await expect(run(deps.tool, { workspace_id: 'w', cwd: '/c' })).rejects.toThrow('mutually');
  });

  it('预设默认 sa-worker，不可用时回退宿主默认，显式预设原样传入', async () => {
    const missing = makeDeps({ presets: [{ id: WORKER_PRESET, broken: 'x' }] });
    await run(missing.tool, { workspace_id: 'w' });
    expect(missing.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    const noRoster = makeDeps({ presets: null });
    await run(noRoster.tool, { workspace_id: 'w' });
    expect(noRoster.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    const explicit = makeDeps();
    await run(explicit.tool, { workspace_id: 'w', agent_preset: 'other' });
    expect(explicit.create).toHaveBeenCalledWith({ workspaceId: 'w', agentPreset: 'other' });
  });

  it('创建、标题与首条提示失败时报告会话已创建', async () => {
    const deps = makeDeps();
    deps.create.mockRejectedValueOnce(new Error('boom'));
    await expect(run(deps.tool, { workspace_id: 'w' })).rejects.toThrow(
      'Could not create the session: boom',
    );
    deps.rename.mockRejectedValueOnce(new Error('nope'));
    await expect(run(deps.tool, { workspace_id: 'w', title: 't' })).rejects.toThrow(
      "The session 'session-new' was created, but its title failed: nope",
    );
    deps.steer.mockImplementationOnce(() => {
      throw new Error('busy');
    });
    await expect(run(deps.tool, { workspace_id: 'w', prompt: 'p' })).rejects.toThrow(
      "The session 'session-new' was created, but its first prompt failed: busy",
    );
  });
});

describe('session_create 的模型', () => {
  it('未传模型参数时使用「工作会话模型」，校验后写入新会话', async () => {
    const deps = makeDeps({ worker: WORKER });
    await run(deps.tool, { workspace_id: 'w', prompt: 'go' });
    expect(deps.llm?.resolveCallConfig).toHaveBeenCalledWith(WORKER, expect.anything());
    expect(deps.select).toHaveBeenCalledWith(WORKER);
    expect(deps.select.mock.invocationCallOrder[0]).toBeLessThan(
      deps.steer.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('显式 provider 与 model 优先于配置，effort 随显式值', async () => {
    const deps = makeDeps({ worker: WORKER });
    await run(deps.tool, {
      workspace_id: 'w',
      provider: 'mock',
      model: 'mock-other',
      effort: 'low',
    });
    expect(deps.select).toHaveBeenCalledWith({
      provider: 'mock',
      model: 'mock-other',
      reasoningEffort: 'low',
    });
    expect(deps.llm?.resolveCallConfig).toHaveBeenCalledTimes(1);
  });

  it('显式参数不成对时报参数错误，显式校验失败时报错且不创建会话', async () => {
    const deps = makeDeps({ worker: WORKER });
    await expect(run(deps.tool, { workspace_id: 'w', effort: 'low' })).rejects.toThrow(
      'provider and model must be provided together',
    );
    await expect(run(deps.tool, { workspace_id: 'w', provider: 'p' })).rejects.toThrow(
      'provider and model must be provided together',
    );
    deps.llm?.resolveCallConfig.mockRejectedValueOnce(new Error('unknown model'));
    await expect(run(deps.tool, { workspace_id: 'w', provider: 'p', model: 'm' })).rejects.toThrow(
      'Invalid model selection: unknown model',
    );
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('未配置时不校验也不选择，沿用宿主默认', async () => {
    const deps = makeDeps({ worker: undefined });
    await run(deps.tool, { workspace_id: 'w' });
    expect(deps.llm?.resolveCallConfig).not.toHaveBeenCalled();
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.resolveAgent).not.toHaveBeenCalled();
  });

  it('配置的模型校验失败时回退宿主默认并记警告，会话照常创建', async () => {
    const llm = {
      resolveCallConfig: vi.fn(async () => {
        throw new Error('effort high is not supported');
      }),
    };
    const deps = makeDeps({ worker: WORKER, llm });
    expect(await run(deps.tool, { workspace_id: 'w' })).toMatchObject({ sessionId: 'session-new' });
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining('effort high is not supported'));
  });

  it('缺少 llm 服务时，配置的模型回退并记警告，显式模型报错', async () => {
    const deps = makeDeps({ worker: WORKER, llm: null });
    await run(deps.tool, { workspace_id: 'w' });
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    await expect(run(deps.tool, { workspace_id: 'w', provider: 'p', model: 'm' })).rejects.toThrow(
      'llm service is not mounted',
    );
  });

  it('每次调用读取实时配置', async () => {
    let current: typeof WORKER | undefined;
    const select = vi.fn();
    const tool = buildSessionCreateTool({
      sessionController: {
        create: async () => ({ sessionId: 's' }),
        rename: async () => ({ title: '' }),
        resolveAgent: async () => ({ agent: { model: { select } } }),
      } as never,
      llm: { resolveCallConfig: async () => ({}) },
      workerModel: () => current as never,
      logger: { warn: vi.fn() },
    });
    await run(tool, { workspace_id: 'w' });
    expect(select).not.toHaveBeenCalled();
    current = WORKER;
    await run(tool, { workspace_id: 'w' });
    expect(select).toHaveBeenCalledWith(WORKER);
  });

  it('选择写入失败时报告会话已创建', async () => {
    const deps = makeDeps({ worker: WORKER });
    deps.select.mockImplementationOnce(() => {
      throw new Error('select failed');
    });
    await expect(run(deps.tool, { workspace_id: 'w' })).rejects.toThrow(
      "The session 'session-new' was created, but its model selection failed: select failed",
    );
  });
});

describe('SA-调度会话子行注册 session_create', () => {
  function mount(services: Record<string, unknown>, register?: () => never) {
    const base = makeCtx({ services });
    const registered: ToolDefinition[] = [];
    const warn = vi.fn();
    Object.assign(base, {
      larkSuperAgent: { workerModel: () => WORKER, presence: { reminderFor: () => undefined } },
      systemPrompt: { section: () => () => true },
      logger: { ...base.logger, warn },
    });
    base.tools.register = ((definition: ToolDefinition) => {
      if (register !== undefined && definition.name === 'session_create') return register();
      registered.push(definition);
      return () => undefined;
    }) as never;
    const ctx = Object.assign(base, {
      inject: (_deps: string[], callback: (context: unknown) => void) => {
        callback(base);
        return () => true;
      },
    });
    apply(ctx as unknown as Context);
    return { registered, warn, base };
  }

  it('有会话控制服务时注册一个 session_create', () => {
    const { registered } = mount({ sessionController: {} });
    expect(registered.filter((tool) => tool.name === 'session_create')).toHaveLength(1);
  });

  it('没有会话控制服务时不注册', () => {
    const { registered } = mount({});
    expect(registered.some((tool) => tool.name === 'session_create')).toBe(false);
  });

  it('重名注册失败时记警告并保持其余工具', () => {
    const { warn } = mount({ sessionController: {} }, (() => {
      throw new Error('tool "session_create" is already registered in this scope');
    }) as never);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('session_create'), expect.any(Error));
  });

  it('不再监听 tools/execute 与 agent/created', () => {
    const { base } = mount({ sessionController: {} });
    expect(base._onCallbacks.has('tools/execute')).toBe(false);
    expect(base._onCallbacks.has('agent/created')).toBe(false);
  });
});
