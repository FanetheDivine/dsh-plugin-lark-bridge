// SA-调度会话 list_models 测试：枚举 provider/model/effort、注册接线与失败标注。
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { apply } from '../src/sa-dispatch/index.ts';
import { buildListModelsTool, type LlmCatalogLike } from '../src/sa-dispatch/list-models.ts';
import type { Context } from '../src/types.ts';
import { makeCtx } from './helpers.ts';

/** 构造可编程的 llm 目录模拟。 */
function makeLlm(
  options: {
    providers?: { id: string }[];
    listModels?: (provider: string) => Promise<{ id: string }[]>;
    resolveModelInfo?: (
      provider: string,
      model: string,
    ) => Promise<{ reasoning?: { efforts: { id: string }[] } }>;
  } = {},
) {
  return {
    listProviders: vi.fn(() => options.providers ?? []),
    listModels: vi.fn(options.listModels ?? (async () => [])),
    resolveModelInfo: vi.fn(
      options.resolveModelInfo ?? (async () => ({ reasoning: { efforts: [] } })),
    ),
  } satisfies LlmCatalogLike & Record<string, ReturnType<typeof vi.fn>>;
}

/** 执行工具；信号固定为未中止。 */
function run(tool: ToolDefinition, args: Record<string, unknown> = {}) {
  const exec = { signal: new AbortController().signal } as unknown as ToolRunContext;
  return tool.execute(args as never, exec) as Promise<unknown>;
}

describe('list_models 工具定义', () => {
  it('命名为 list_models 且参数表为空', () => {
    const tool = buildListModelsTool({ llm: makeLlm() });
    expect(tool.name).toBe('list_models');
    expect(tool.parameters).toMatchObject({ type: 'object', properties: {} });
  });
});

describe('list_models 枚举模型目录', () => {
  it('按宿主顺序返回全部 provider 与 model 及 effort id', async () => {
    const llm = makeLlm({
      providers: [{ id: 'deepseek' }, { id: 'openai' }],
      listModels: async (provider) =>
        provider === 'deepseek'
          ? [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }]
          : [{ id: 'gpt-5' }],
      resolveModelInfo: async (provider, model) => ({
        reasoning: {
          efforts:
            provider === 'deepseek' && model === 'deepseek-reasoner'
              ? [{ id: 'high' }]
              : [{ id: 'minimal' }, { id: 'medium' }, { id: 'high' }],
        },
      }),
    });
    const tool = buildListModelsTool({ llm });
    await expect(run(tool)).resolves.toEqual({
      providers: [
        {
          provider: 'deepseek',
          models: [
            { model: 'deepseek-chat', efforts: ['minimal', 'medium', 'high'] },
            { model: 'deepseek-reasoner', efforts: ['high'] },
          ],
        },
        {
          provider: 'openai',
          models: [{ model: 'gpt-5', efforts: ['minimal', 'medium', 'high'] }],
        },
      ],
      skipped: [],
    });
  });

  it('路由未声明 reasoning 时 efforts 为空数组', async () => {
    const llm = makeLlm({
      providers: [{ id: 'deepseek' }],
      listModels: async () => [{ id: 'deepseek-chat' }],
      resolveModelInfo: async () => ({}),
    });
    const tool = buildListModelsTool({ llm });
    await expect(run(tool)).resolves.toEqual({
      providers: [{ provider: 'deepseek', models: [{ model: 'deepseek-chat', efforts: [] }] }],
      skipped: [],
    });
  });

  it('没有已注册 provider 时返回空清单', async () => {
    const tool = buildListModelsTool({ llm: makeLlm() });
    await expect(run(tool)).resolves.toEqual({ providers: [], skipped: [] });
  });
});

describe('SA-调度会话子行注册 list_models', () => {
  function mount(services: Record<string, unknown>) {
    const base = makeCtx({ services });
    const registered: ToolDefinition[] = [];
    Object.assign(base, {
      larkSuperAgent: {
        taskModel: () => undefined,
        taskPreset: () => '',
        presence: { reminderFor: () => undefined },
      },
      systemPrompt: { section: () => () => true },
      logger: base.logger,
    });
    const originalRegister = base.tools.register;
    base.tools.register = ((definition: ToolDefinition) => {
      registered.push(definition);
      return (originalRegister as (def: unknown) => unknown)(definition) as never;
    }) as never;
    const ctx = Object.assign(base, {
      inject: (_deps: string[], callback: (context: unknown) => void) => {
        callback(base);
        return () => true;
      },
    });
    apply(ctx as unknown as Context);
    return { registered, base };
  }

  it('有会话控制服务时注册一个 list_models', () => {
    const { registered } = mount({ sessionController: {} });
    expect(registered.filter((tool) => tool.name === 'list_models')).toHaveLength(1);
  });

  it('execute 返回的 id 与宿主 llm 的原始拼写逐字一致', async () => {
    const llm = makeLlm({
      providers: [{ id: 'DeepSeek' }],
      listModels: async () => [{ id: 'DeepSeek-Chat' }],
      resolveModelInfo: async () => ({ reasoning: { efforts: [{ id: 'Medium' }] } }),
    });
    const { registered, base } = mount({ sessionController: {}, llm });
    const tool = registered.find((entry) => entry.name === 'list_models');
    expect(tool).toBeDefined();
    expect(base._services.get('llm')).toBe(llm);
    await expect(run(tool as ToolDefinition)).resolves.toEqual({
      providers: [
        { provider: 'DeepSeek', models: [{ model: 'DeepSeek-Chat', efforts: ['Medium'] }] },
      ],
      skipped: [],
    });
  });
});

describe('list_models 失败策略', () => {
  it('llm 未挂载时 execute 抛出可读错误', async () => {
    const tool = buildListModelsTool({});
    await expect(run(tool)).rejects.toThrow(
      'Model catalog is unavailable: the llm service is not mounted.',
    );
  });

  it('provider 目录失败时跳过该 provider 且不阻断其余', async () => {
    const llm = makeLlm({
      providers: [{ id: 'broken' }, { id: 'deepseek' }],
      listModels: async (provider) => {
        if (provider === 'broken') throw new Error('adapter exploded');
        return [{ id: 'deepseek-chat' }];
      },
    });
    const tool = buildListModelsTool({ llm });
    await expect(run(tool)).resolves.toEqual({
      providers: [{ provider: 'deepseek', models: [{ model: 'deepseek-chat', efforts: [] }] }],
      skipped: [{ provider: 'broken', error: 'adapter exploded' }],
    });
  });

  it('model 元数据失败时跳过该 model 且不阻断同 provider 其余 model', async () => {
    const llm = makeLlm({
      providers: [{ id: 'deepseek' }],
      listModels: async () => [{ id: 'deepseek-chat' }, { id: 'deepseek-reasoner' }],
      resolveModelInfo: async (_provider, model) => {
        if (model === 'deepseek-chat') throw new Error('route unknown');
        return { reasoning: { efforts: [{ id: 'high' }] } };
      },
    });
    const tool = buildListModelsTool({ llm });
    await expect(run(tool)).resolves.toEqual({
      providers: [
        { provider: 'deepseek', models: [{ model: 'deepseek-reasoner', efforts: ['high'] }] },
      ],
      skipped: [{ provider: 'deepseek', model: 'deepseek-chat', error: 'route unknown' }],
    });
  });

  it('skipped 按失败发生顺序排列', async () => {
    const llm = makeLlm({
      providers: [{ id: 'a' }, { id: 'b' }],
      listModels: async (provider) => {
        if (provider === 'a') throw new Error('a failed');
        return [{ id: 'm' }];
      },
      resolveModelInfo: async () => {
        throw new Error('b model failed');
      },
    });
    const tool = buildListModelsTool({ llm });
    await expect(run(tool)).resolves.toEqual({
      providers: [{ provider: 'b', models: [] }],
      skipped: [
        { provider: 'a', error: 'a failed' },
        { provider: 'b', model: 'm', error: 'b model failed' },
      ],
    });
  });
});
