/**
 * SA-调度会话的 `session_create`：覆写 dsh-plugin-meta-tools 的同名工具。
 * 名称、参数、描述、返回值与 meta-tools 一致；未显式传入模型时使用「工作会话模型」。
 */
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { defineTool, ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';

/** 创建的会话使用的预设；与 meta-tools 的 `session_preset` 配置等价。 */
export const WORKER_PRESET = 'sa-worker';

/** meta-tools 投递消息的来源标识，`SA-工作会话` 据此包装调度消息。 */
const MESSAGE_SOURCE = 'dsh-plugin-meta-tools';

/** 宿主会话控制服务的最小接口。 */
export interface SessionControllerLike {
  create(request: {
    readonly workspaceId?: string;
    readonly cwd?: string;
    readonly agentPreset?: string;
  }): Promise<{ readonly sessionId: string; readonly agentPreset?: string }>;
  rename(request: {
    readonly sessionId: string;
    readonly title: string;
  }): Promise<{ readonly title: string }>;
  resolveAgent(sessionId: never): Promise<{ readonly agent: Agent } | { readonly error: unknown }>;
}

/** 宿主模型校验服务的最小接口。 */
export interface LlmLike {
  resolveCallConfig(config: ModelSelection, signal?: AbortSignal): Promise<unknown>;
}

/** 宿主预设名册的最小接口。 */
export interface PresetRegistryLike {
  list(): Promise<readonly { readonly id: string; readonly broken?: string }[]>;
}

/** 日志的最小接口。 */
export interface WarnLogger {
  warn(...args: unknown[]): void;
}

/** 工具的依赖。 */
export interface SessionCreateDeps {
  readonly sessionController: SessionControllerLike;
  readonly llm?: LlmLike | undefined;
  readonly agentPresets?: PresetRegistryLike | undefined;
  /** 读取配置里「工作会话模型」的实时值；未配置时返回 undefined。 */
  readonly workerModel: () => ModelSelection | undefined;
  readonly logger: WarnLogger;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 解析可选模型参数；provider 与 model 成对出现，effort 依赖完整路由。 */
function modelSelectionOf(
  providerInput: unknown,
  modelInput: unknown,
  effortInput: unknown,
): ModelSelection | undefined {
  const provider = typeof providerInput === 'string' ? providerInput.trim() : '';
  const model = typeof modelInput === 'string' ? modelInput.trim() : '';
  const effort = typeof effortInput === 'string' ? effortInput.trim() : '';
  if (provider === '' && model === '' && effort === '') return undefined;
  if (provider === '' || model === '') {
    throw new ToolArgsError([
      'provider and model must be provided together when provider, model, or effort is set',
    ]);
  }
  return {
    provider,
    model,
    ...(effort === '' ? {} : { reasoningEffort: ReasoningEffortId(effort) }),
  };
}

/** 在宿主可用预设中匹配默认预设；不可用或读取失败时返回空。 */
async function availablePreset(
  presets: PresetRegistryLike | undefined,
  candidate: string,
): Promise<string> {
  if (presets === undefined) return '';
  try {
    const rows = await presets.list();
    return rows.some((row) => row.id === candidate && row.broken === undefined) ? candidate : '';
  } catch {
    return '';
  }
}

const OUTPUT = { type: 'json' as const };

/** 构建 `session_create` 工具定义。 */
export function buildSessionCreateTool(deps: SessionCreateDeps): ToolDefinition {
  const { sessionController, llm, agentPresets, workerModel, logger } = deps;

  /** 经宿主校验显式或配置的模型；显式失败抛错，配置失败回退为空并记警告。 */
  async function validate(
    selection: ModelSelection,
    explicit: boolean,
    signal: AbortSignal,
  ): Promise<ModelSelection | undefined> {
    if (llm === undefined || typeof llm.resolveCallConfig !== 'function') {
      if (explicit) {
        throw new Error('Model selection is unavailable: the llm service is not mounted.');
      }
      logger.warn('lark-super-agent: llm service is unavailable; worker model not applied');
      return undefined;
    }
    try {
      await llm.resolveCallConfig(selection, signal);
      return selection;
    } catch (error) {
      if (explicit) throw new Error(`Invalid model selection: ${messageOf(error)}`);
      logger.warn(
        `lark-super-agent: configured worker model is unavailable; using the host default: ${messageOf(error)}`,
      );
      return undefined;
    }
  }

  /** 解析会话的 Agent；失败抛出宿主错误。 */
  async function agentOf(sessionId: string, signal: AbortSignal): Promise<Agent> {
    signal.throwIfAborted();
    const resolved = await sessionController.resolveAgent(sessionId as never);
    signal.throwIfAborted();
    if ('error' in resolved) throw resolved.error;
    return resolved.agent;
  }

  return defineTool({
    name: 'session_create',
    description:
      'Create a DSH (DeepSeek Harness) session, optionally in a workspace or directory, with an agent preset, an optional provider/model/effort selection, a title, and a first prompt. The preset defaults to the plugin default when the host offers it, otherwise to the deployment default. Returns the new session id.',
    parameters: {
      workspace_id: {
        type: 'string',
        description:
          "Workspace the session joins. Exclusive with cwd; defaults to the calling session's working directory.",
      },
      cwd: {
        type: 'string',
        description: 'Absolute directory the session owns. Exclusive with workspace_id.',
      },
      agent_preset: {
        type: 'string',
        description:
          'Agent preset the session runs. Defaults to the plugin default when the host offers it, otherwise to the deployment default.',
      },
      provider: {
        type: 'string',
        description: 'Provider id. Required together with model when selecting a model.',
      },
      model: {
        type: 'string',
        description: 'Model id. Required together with provider when selecting a model.',
      },
      effort: {
        type: 'string',
        description:
          'Reasoning effort id for the exact provider/model. Requires provider and model. Omit to use the model default.',
      },
      title: { type: 'string', description: 'Display title for the new session.' },
      prompt: {
        type: 'string',
        description: 'First message sent after creation. Omit to create a blank session.',
      },
    },
    output: {
      schema: OUTPUT,
      render: (_args, value) => {
        const view = value as { sessionId: string; prompted: boolean };
        return [
          {
            type: 'text' as const,
            text: `created session ${view.sessionId}${view.prompted ? ' (prompted)' : ''}`,
          },
        ];
      },
    },
    async execute(args, exec) {
      const workspaceId = typeof args.workspace_id === 'string' ? args.workspace_id.trim() : '';
      const cwd = typeof args.cwd === 'string' ? args.cwd.trim() : '';
      if (workspaceId !== '' && cwd !== '') {
        throw new ToolArgsError(['workspace_id and cwd are mutually exclusive']);
      }
      const explicitPreset = typeof args.agent_preset === 'string' ? args.agent_preset.trim() : '';
      const agentPreset =
        explicitPreset === '' ? await availablePreset(agentPresets, WORKER_PRESET) : explicitPreset;

      // 显式参数优先；否则使用配置的「工作会话模型」，不可用时回退宿主默认。
      const explicit = modelSelectionOf(args.provider, args.model, args.effort);
      let selection: ModelSelection | undefined;
      if (explicit !== undefined) {
        selection = await validate(explicit, true, exec.signal);
      } else {
        const configured = workerModel();
        if (configured !== undefined) selection = await validate(configured, false, exec.signal);
      }

      const fallbackCwd = exec.agent?.session.header.cwd;
      const directory = cwd === '' ? (workspaceId === '' ? fallbackCwd : undefined) : cwd;
      let created: Awaited<ReturnType<SessionControllerLike['create']>>;
      try {
        created = await sessionController.create({
          ...(workspaceId === '' ? {} : { workspaceId }),
          ...(directory === undefined ? {} : { cwd: directory }),
          ...(agentPreset === '' ? {} : { agentPreset }),
        });
      } catch (error) {
        throw new Error(`Could not create the session: ${messageOf(error)}`);
      }

      // 首条提示在创建完成后才发送，选择因此先于首轮请求写入。
      if (selection !== undefined) {
        try {
          (await agentOf(created.sessionId, exec.signal)).model.select(selection);
        } catch (error) {
          throw new Error(
            `The session '${created.sessionId}' was created, but its model selection failed: ${messageOf(error)}`,
          );
        }
      }

      let title: string | undefined;
      const requestedTitle = typeof args.title === 'string' ? args.title.trim() : '';
      if (requestedTitle !== '') {
        try {
          const renamed = await sessionController.rename({
            sessionId: created.sessionId,
            title: requestedTitle,
          });
          title = renamed.title;
        } catch (error) {
          throw new Error(
            `The session '${created.sessionId}' was created, but its title failed: ${messageOf(error)}`,
          );
        }
      }

      let prompted = false;
      const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
      if (prompt !== '') {
        try {
          (await agentOf(created.sessionId, exec.signal)).steer(
            createUserMessage({
              content: [{ type: 'text', text: prompt }],
              source: { kind: MESSAGE_SOURCE },
            }),
          );
          prompted = true;
        } catch (error) {
          throw new Error(
            `The session '${created.sessionId}' was created, but its first prompt failed: ${messageOf(error)}`,
          );
        }
      }

      return {
        sessionId: created.sessionId,
        ...(created.agentPreset === undefined ? {} : { agentPreset: created.agentPreset }),
        ...(title === undefined ? {} : { title }),
        prompted,
      };
    },
  });
}
