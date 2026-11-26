// SA-调度会话 list_models 测试：枚举 provider/model/effort、注册接线与失败标注。
import type { ToolDefinition, ToolRunContext } from '@deepseek-ai/dsh-tools';
import { describe, expect, it, vi } from 'vitest';

import { buildListModelsTool, type LlmCatalogLike } from '../src/sa-dispatch/list-models.ts';

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
