/**
 * SA-调度会话的 `list_models`：经宿主 llm 服务枚举全部 provider、model 与
 * 该路由支持的 reasoning effort，供 `session_create` 参数选用。
 */
import { defineTool } from '@deepseek-ai/dsh-tools';

/** 宿主模型目录服务的最小接口。 */
export interface LlmCatalogLike {
  /** 已注册 provider，注册顺序。 */
  listProviders(): readonly { readonly id: string }[];
  /** 某 provider 的可发现 model。 */
  listModels(provider: string): Promise<readonly { readonly id: string }[]>;
  /** 某 exact 路由的元数据，含支持的 reasoning effort。 */
  resolveModelInfo(
    provider: string,
    model: string,
    signal?: AbortSignal,
  ): Promise<{ readonly reasoning?: { readonly efforts: readonly { readonly id: string }[] } }>;
}

/** 一个 model 条目：model id 与该路由支持的 effort id。 */
export interface ModelEntry {
  readonly model: string;
  readonly efforts: readonly string[];
}

/** 一个 provider 条目及其下的全部 model。 */
export interface ProviderEntry {
  readonly provider: string;
  readonly models: readonly ModelEntry[];
}

/** 被跳过的部分；`model` 缺省表示整个 provider 目录失败。 */
export interface SkippedEntry {
  readonly provider: string;
  readonly model?: string;
  readonly error: string;
}

/** 工具输出封套。 */
export interface ListModelsResult {
  readonly providers: readonly ProviderEntry[];
  readonly skipped: readonly SkippedEntry[];
}

/** 工具的依赖。 */
export interface ListModelsDeps {
  readonly llm?: LlmCatalogLike | undefined;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function renderJson(value: unknown) {
  return [{ type: 'text' as const, text: JSON.stringify(value) ?? 'null' }];
}

/** 构建 `list_models` 工具定义。 */
export function buildListModelsTool(deps: ListModelsDeps) {
  const { llm } = deps;

  return defineTool({
    name: 'list_models',
    description:
      'List every provider and model currently available in the host, with the reasoning efforts each route supports. Use the result to pick provider, model, and effort for session_create. Takes no parameters.',
    parameters: {},
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          providers: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                provider: { type: 'string', required: true },
                models: {
                  type: 'array',
                  required: true,
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    properties: {
                      model: { type: 'string', required: true },
                      efforts: { type: 'array', required: true, items: { type: 'string' } },
                    },
                  },
                },
              },
            },
          },
          skipped: {
            type: 'array',
            required: true,
            items: {
              type: 'object',
              additionalProperties: false,
              properties: {
                provider: { type: 'string', required: true },
                model: { type: 'string' },
                error: { type: 'string', required: true },
              },
            },
          },
        },
      },
      render: (_args, value) => renderJson(value),
    },
    async execute(_args, exec) {
      if (llm === undefined || typeof llm.listProviders !== 'function') {
        throw new Error('Model catalog is unavailable: the llm service is not mounted.');
      }
      const providers: ProviderEntry[] = [];
      const skipped: SkippedEntry[] = [];
      for (const provider of llm.listProviders()) {
        exec.signal.throwIfAborted();
        let models: readonly { readonly id: string }[];
        try {
          models = await llm.listModels(provider.id);
        } catch (error) {
          skipped.push({ provider: provider.id, error: messageOf(error) });
          continue;
        }
        const entries: ModelEntry[] = [];
        for (const model of models) {
          exec.signal.throwIfAborted();
          try {
            const info = await llm.resolveModelInfo(provider.id, model.id, exec.signal);
            entries.push({
              model: model.id,
              efforts: (info.reasoning?.efforts ?? []).map((effort) => effort.id),
            });
          } catch (error) {
            skipped.push({
              provider: provider.id,
              model: model.id,
              error: messageOf(error),
            });
          }
        }
        providers.push({ provider: provider.id, models: entries });
      }
      return { providers, skipped } satisfies ListModelsResult;
    },
  });
}
