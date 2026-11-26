// SA-调度会话 session_create 覆写测试：参数与返回、任务会话预设与模型，以及创建后立即建立任务。
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { apply } from '../src/sa-dispatch/index.ts';
import { buildSessionCreateTool } from '../src/sa-dispatch/session-create.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

const TASK_MODEL = { provider: 'mock', model: 'mock-task', reasoningEffort: 'high' } as const;
const COMMON_MODEL = { provider: 'mock', model: 'mock-common', reasoningEffort: 'low' } as const;
const COMPLEX_MODEL = { provider: 'mock', model: 'mock-complex', reasoningEffort: 'high' } as const;
const TASK_PRESET = 'task-preset';

/** 一次合法调用的最少参数。 */
const BASE = { workspace_id: 'w', title: ' T ', prompt: ' go ' };

/** 构造一组可观察的依赖。 */
function makeDeps(
  options: {
    model?:
      | typeof TASK_MODEL
      | ((taskType?: 'common' | 'complex') => typeof TASK_MODEL | undefined)
      | undefined;
    preset?: string;
    llm?: { resolveCallConfig: ReturnType<typeof vi.fn> } | null;
    presets?: { id: string; broken?: string }[] | null;
  } = {},
) {
  const select = vi.fn();
  const steer = vi.fn();
  const agent = { model: { select }, steer };
  const create = vi.fn(
    async (request: {
      agentPreset?: string;
    }): Promise<{ sessionId: string; agentPreset?: string }> => ({
      sessionId: 'session-new',
      ...(request.agentPreset === undefined ? {} : { agentPreset: request.agentPreset }),
    }),
  );
  const rename = vi.fn(async (request: { title: string }) => ({ title: request.title }));
  const resolveAgent = vi.fn(async () => ({ agent }));
  const llm =
    options.llm === null
      ? undefined
      : (options.llm ?? { resolveCallConfig: vi.fn(async () => ({})) });
  const roster = options.presets === null ? undefined : (options.presets ?? [{ id: TASK_PRESET }]);
  const presetList = vi.fn(async () => roster ?? []);
  const reads = {
    get: vi.fn((name: string) =>
      name === 'agentPresets' && roster !== undefined ? { list: presetList } : undefined,
    ),
  };
  const service = {
    taskModel: vi.fn((taskType?: 'common' | 'complex') =>
      typeof options.model === 'function' ? options.model(taskType) : (options.model as never),
    ),
    taskPreset: vi.fn(() => options.preset ?? TASK_PRESET),
    assertDispatchable: vi.fn(async () => undefined),
    createTask: vi.fn(async () => ({ taskId: 'task-1' })),
  };
  const warn = vi.fn();
  const tool = buildSessionCreateTool({
    sessionController: { create, rename, resolveAgent } as never,
    llm: llm as never,
    reads,
    service: service as never,
    logger: { warn },
  });
  return { tool, select, steer, create, rename, resolveAgent, llm, service, reads, warn };
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
  it('参数去掉 agent_preset，包含 task_type，title 与 prompt 必填，描述说明模型覆盖规则', () => {
    const { tool } = makeDeps();
    expect(tool.name).toBe('session_create');
    expect(tool.description).toMatch(/^Create a DSH \(DeepSeek Harness\) session/);
    expect(tool.description).toContain('task session');
    expect(tool.description).toContain('task_type');
    expect(tool.description).toContain('provider/model/effort override');
    expect(tool.description).toContain('unless the user explicitly asks');
    const parameters = tool.parameters as { properties: object; required?: string[] };
    expect(Object.keys(parameters.properties)).toEqual([
      'workspace_id',
      'cwd',
      'task_type',
      'provider',
      'model',
      'effort',
      'title',
      'prompt',
      'message_id',
    ]);
    expect(parameters.required).toEqual(['title', 'prompt']);
  });

  it('依次创建、重命名、建立任务与发送首条提示，返回会话与任务标识', async () => {
    const deps = makeDeps();
    expect(await run(deps.tool, BASE)).toEqual({
      sessionId: 'session-new',
      taskId: 'task-1',
      agentPreset: TASK_PRESET,
      title: 'T',
      prompted: true,
    });
    expect(deps.service.assertDispatchable).toHaveBeenCalledWith('w');
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w', agentPreset: TASK_PRESET });
    expect(deps.rename).toHaveBeenCalledWith({ sessionId: 'session-new', title: 'T' });
    expect(deps.service.createTask).toHaveBeenCalledWith({
      title: 'T',
      sessionId: 'session-new',
      workspaceId: 'w',
      cwd: '/caller',
      message: { text: 'go' },
    });
    const message = deps.steer.mock.calls[0]?.[0] as { content: unknown; source: unknown };
    expect(message.source).toEqual({ kind: 'dsh-plugin-meta-tools' });
    expect(message.content).toEqual([{ type: 'text', text: 'go' }]);
    const order = [deps.create, deps.rename, deps.service.createTask, deps.steer].map(
      (fn) => fn.mock.invocationCallOrder[0] ?? 0,
    );
    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it('任务标题取宿主重命名后的标题，message_id 记入任务消息', async () => {
    const deps = makeDeps();
    deps.rename.mockResolvedValueOnce({ title: 'Renamed' });
    const result = await run(deps.tool, { ...BASE, message_id: ' m-1 ' });
    expect(result).toMatchObject({ title: 'Renamed' });
    expect(deps.service.createTask).toHaveBeenCalledWith(
      expect.objectContaining({ title: 'Renamed', message: { text: 'go', messageId: 'm-1' } }),
    );
  });

  it('结果渲染为一行文本', async () => {
    const deps = makeDeps();
    const value = await run(deps.tool, BASE);
    expect(deps.tool.output?.render?.(BASE as never, value as never)).toEqual([
      { type: 'text', text: 'created session session-new as task-1 (prompted)' },
    ]);
  });

  it('省略 workspace_id 与 cwd 时落在调用方目录，cwd 原样传入，二者互斥', async () => {
    const deps = makeDeps();
    await run(deps.tool, { title: 't', prompt: 'p' });
    expect(deps.create).toHaveBeenLastCalledWith({ cwd: '/caller', agentPreset: TASK_PRESET });
    expect(deps.service.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceId: null, cwd: '/caller' }),
    );
    await run(deps.tool, { cwd: '/other', title: 't', prompt: 'p' });
    expect(deps.create).toHaveBeenLastCalledWith({ cwd: '/other', agentPreset: TASK_PRESET });
    expect(deps.service.createTask).toHaveBeenLastCalledWith(
      expect.objectContaining({ workspaceId: null, cwd: '/other' }),
    );
    expect(deps.service.assertDispatchable).not.toHaveBeenCalled();
    await expect(run(deps.tool, { ...BASE, cwd: '/c' })).rejects.toThrow('mutually');
  });

  it('title 或 prompt 只含空白时报参数错误且不创建会话', async () => {
    const deps = makeDeps();
    await expect(run(deps.tool, { ...BASE, title: '  ' })).rejects.toThrow(
      'title must not be empty',
    );
    await expect(run(deps.tool, { ...BASE, prompt: '  ' })).rejects.toThrow(
      'prompt must not be empty',
    );
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('工作区不可派发时报错且不创建会话', async () => {
    const deps = makeDeps();
    deps.service.assertDispatchable.mockRejectedValueOnce(new Error('workspace w has no note'));
    await expect(run(deps.tool, BASE)).rejects.toThrow('workspace w has no note');
    expect(deps.create).not.toHaveBeenCalled();
    expect(deps.service.createTask).not.toHaveBeenCalled();
  });

  it('创建、标题、任务与首条提示失败时报告会话已创建', async () => {
    const deps = makeDeps();
    deps.create.mockRejectedValueOnce(new Error('boom'));
    await expect(run(deps.tool, BASE)).rejects.toThrow('Could not create the session: boom');
    deps.rename.mockRejectedValueOnce(new Error('nope'));
    await expect(run(deps.tool, BASE)).rejects.toThrow(
      "The session 'session-new' was created, but its title failed: nope",
    );
    deps.service.createTask.mockRejectedValueOnce(new Error('disk full'));
    await expect(run(deps.tool, BASE)).rejects.toThrow(
      "The session 'session-new' was created, but its task failed: disk full",
    );
    deps.steer.mockImplementationOnce(() => {
      throw new Error('busy');
    });
    await expect(run(deps.tool, BASE)).rejects.toThrow(
      "The session 'session-new' was created as task-1, but its first prompt failed: busy",
    );
  });
});

describe('session_create 的预设', () => {
  it('始终使用配置的任务会话预设', async () => {
    const deps = makeDeps({ preset: 'other', presets: [{ id: 'other' }] });
    await run(deps.tool, BASE);
    expect(deps.service.taskPreset).toHaveBeenCalled();
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w', agentPreset: 'other' });
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it('未配置预设时使用宿主默认且不读名册', async () => {
    const deps = makeDeps({ preset: '' });
    const result = await run(deps.tool, BASE);
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    expect(result).not.toHaveProperty('agentPreset');
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it('配置的预设损坏或不在名册时回退宿主默认并记警告', async () => {
    const broken = makeDeps({ presets: [{ id: TASK_PRESET, broken: 'x' }] });
    await run(broken.tool, BASE);
    expect(broken.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    expect(broken.warn).toHaveBeenCalledWith(expect.stringContaining(TASK_PRESET));
    const missing = makeDeps({ presets: [{ id: 'standard' }] });
    await run(missing.tool, BASE);
    expect(missing.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    expect(missing.warn).toHaveBeenCalledTimes(1);
  });

  it('名册不可用时回退宿主默认且不记警告', async () => {
    const deps = makeDeps({ presets: null });
    await run(deps.tool, BASE);
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w' });
    expect(deps.warn).not.toHaveBeenCalled();
  });

  it('名册读取失败时回退宿主默认', async () => {
    const deps = makeDeps();
    deps.reads.get.mockImplementation(() => ({
      list: async () => {
        throw new Error('offline');
      },
    }));
    await run(deps.tool, BASE);
    expect(deps.create).toHaveBeenCalledWith({ workspaceId: 'w' });
  });
});

describe('session_create 的模型', () => {
  it('未传模型参数时使用默认任务会话模型，校验后先于首条提示写入新会话', async () => {
    const deps = makeDeps({ model: TASK_MODEL });
    await run(deps.tool, BASE);
    expect(deps.service.taskModel).toHaveBeenCalledWith(undefined);
    expect(deps.llm?.resolveCallConfig).toHaveBeenCalledWith(TASK_MODEL, expect.anything());
    expect(deps.select).toHaveBeenCalledWith(TASK_MODEL);
    expect(deps.select.mock.invocationCallOrder[0]).toBeLessThan(
      deps.rename.mock.invocationCallOrder[0] ?? 0,
    );
    expect(deps.select.mock.invocationCallOrder[0]).toBeLessThan(
      deps.steer.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('task_type 传空串、common、complex 时分别读取默认、普通、复杂任务模型，非法值报错', async () => {
    const deps = makeDeps({
      model: (taskType) =>
        taskType === 'complex' ? (COMPLEX_MODEL as never) : (COMMON_MODEL as never),
    });
    await run(deps.tool, { ...BASE, task_type: '   ' });
    expect(deps.service.taskModel).toHaveBeenLastCalledWith(undefined);
    expect(deps.select).toHaveBeenLastCalledWith(COMMON_MODEL);

    await run(deps.tool, { ...BASE, task_type: 'common' });
    expect(deps.service.taskModel).toHaveBeenLastCalledWith('common');
    expect(deps.select).toHaveBeenLastCalledWith(COMMON_MODEL);

    await run(deps.tool, { ...BASE, task_type: ' complex ' });
    expect(deps.service.taskModel).toHaveBeenLastCalledWith('complex');
    expect(deps.select).toHaveBeenLastCalledWith(COMPLEX_MODEL);

    deps.create.mockClear();
    await expect(run(deps.tool, { ...BASE, task_type: 'urgent' })).rejects.toThrow(
      'task_type must be common, complex, or empty',
    );
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('显式 provider 与 model 优先于 task_type 配置，effort 随显式值', async () => {
    const deps = makeDeps({ model: TASK_MODEL });
    await run(deps.tool, {
      ...BASE,
      task_type: 'complex',
      provider: 'mock',
      model: 'mock-other',
      effort: 'low',
    });
    expect(deps.select).toHaveBeenCalledWith({
      provider: 'mock',
      model: 'mock-other',
      reasoningEffort: 'low',
    });
    expect(deps.service.taskModel).not.toHaveBeenCalled();
    expect(deps.llm?.resolveCallConfig).toHaveBeenCalledTimes(1);
  });

  it('显式参数不成对时报参数错误，显式校验失败时报错且不创建会话', async () => {
    const deps = makeDeps({ model: TASK_MODEL });
    await expect(run(deps.tool, { ...BASE, effort: 'low' })).rejects.toThrow(
      'provider and model must be provided together',
    );
    await expect(run(deps.tool, { ...BASE, provider: 'p' })).rejects.toThrow(
      'provider and model must be provided together',
    );
    deps.llm?.resolveCallConfig.mockRejectedValueOnce(new Error('unknown model'));
    await expect(run(deps.tool, { ...BASE, provider: 'p', model: 'm' })).rejects.toThrow(
      'Invalid model selection: unknown model',
    );
    expect(deps.create).not.toHaveBeenCalled();
  });

  it('未配置模型时不校验也不选择，只为任务目录与首条提示解析 Agent', async () => {
    const deps = makeDeps({ model: undefined });
    await run(deps.tool, BASE);
    expect(deps.llm?.resolveCallConfig).not.toHaveBeenCalled();
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.resolveAgent).toHaveBeenCalledTimes(2);
  });

  it('任务目录取新会话自身的工作目录', async () => {
    const deps = makeDeps({ model: undefined });
    deps.resolveAgent.mockResolvedValue({
      agent: {
        model: { select: deps.select },
        steer: deps.steer,
        session: { header: { cwd: '/ws' } },
      },
    } as never);
    await run(deps.tool, BASE);
    expect(deps.service.createTask).toHaveBeenCalledWith(expect.objectContaining({ cwd: '/ws' }));
  });

  it('配置的模型校验失败时回退宿主默认并记警告，会话照常创建', async () => {
    const llm = {
      resolveCallConfig: vi.fn(async () => {
        throw new Error('effort high is not supported');
      }),
    };
    const deps = makeDeps({ model: TASK_MODEL, llm });
    expect(await run(deps.tool, BASE)).toMatchObject({
      sessionId: 'session-new',
      taskId: 'task-1',
    });
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledWith(expect.stringContaining('effort high is not supported'));
  });

  it('缺少 llm 服务时，配置的模型回退并记警告，显式模型报错', async () => {
    const deps = makeDeps({ model: TASK_MODEL, llm: null });
    await run(deps.tool, BASE);
    expect(deps.select).not.toHaveBeenCalled();
    expect(deps.warn).toHaveBeenCalledTimes(1);
    await expect(run(deps.tool, { ...BASE, provider: 'p', model: 'm' })).rejects.toThrow(
      'llm service is not mounted',
    );
  });

  it('每次调用读取实时配置', async () => {
    const deps = makeDeps();
    await run(deps.tool, BASE);
    expect(deps.select).not.toHaveBeenCalled();
    deps.service.taskModel.mockReturnValue(TASK_MODEL as never);
    await run(deps.tool, BASE);
    expect(deps.select).toHaveBeenCalledWith(TASK_MODEL);
  });

  it('选择写入失败时报告会话已创建且不建立任务', async () => {
    const deps = makeDeps({ model: TASK_MODEL });
    deps.select.mockImplementationOnce(() => {
      throw new Error('select failed');
    });
    await expect(run(deps.tool, BASE)).rejects.toThrow(
      "The session 'session-new' was created, but its model selection failed: select failed",
    );
    expect(deps.service.createTask).not.toHaveBeenCalled();
  });
});

describe('SA-调度会话子行注册 session_create', () => {
  function mount(services: Record<string, unknown>, register?: () => never) {
    const base = makeCtx({ services });
    const registered: ToolDefinition[] = [];
    const warn = vi.fn();
    Object.assign(base, {
      larkSuperAgent: {
        taskModel: () => TASK_MODEL,
        taskPreset: () => TASK_PRESET,
        presence: { reminderFor: () => undefined },
      },
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
    const { warn, registered } = mount({ sessionController: {} }, (() => {
      throw new Error('tool "session_create" is already registered in this scope');
    }) as never);
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('session_create'), expect.any(Error));
    expect(registered.map((tool) => tool.name)).toContain('task_update');
  });

  it('不再监听 tools/execute 与 agent/created', () => {
    const { base } = mount({ sessionController: {} });
    expect(base._onCallbacks.has('tools/execute')).toBe(false);
    expect(base._onCallbacks.has('agent/created')).toBe(false);
  });
});
