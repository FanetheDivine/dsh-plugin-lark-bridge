/**
 * SA-调度会话的 `session_model`：切换一个会话的模型。
 * 先经宿主模型运行时校验，再把选择写进目标会话，从下一步生效。
 */
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { defineTool, ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';

/** 宿主会话控制服务的最小接口。 */
export interface SessionModelControllerLike {
  resolveAgent(sessionId: never): Promise<{ readonly agent: Agent } | { readonly error: unknown }>;
}

/** 宿主模型校验服务的最小接口。 */
export interface LlmLike {
  resolveCallConfig(config: ModelSelection, signal?: AbortSignal): Promise<unknown>;
}

/** 工具的依赖。 */
export interface SessionModelDeps {
  readonly sessionController: SessionModelControllerLike;
  readonly llm?: LlmLike | undefined;
  /** 读取当前归档会话 id；缺失时视为空集合。 */
  readonly archivedSessionIds: () => readonly string[];
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function textOf(input: unknown): string {
  return typeof input === 'string' ? input.trim() : '';
}

/** 构建 `session_model` 工具定义。 */
export function buildSessionModelTool(deps: SessionModelDeps): ToolDefinition {
  const { sessionController, llm, archivedSessionIds } = deps;

  return defineTool({
    name: 'session_model',
    description:
      "Switch the model of one session, including a task session or this dispatch session. The new route applies from the session's next step; the request already in flight keeps its model. Validate the route with list_models first unless the user named provider and model.",
    parameters: {
      session_id: {
        type: 'string',
        description: 'Session whose model changes. Omit it to change the calling session.',
      },
      provider: {
        type: 'string',
        required: true,
        description: 'Provider id from list_models.',
      },
      model: {
        type: 'string',
        required: true,
        description: 'Model id under that provider.',
      },
      effort: {
        type: 'string',
        description:
          'Reasoning effort id the route supports from list_models. Omit or pass an empty string for the route default.',
      },
    },
    output: {
      schema: { type: 'json' as const },
      render: (_args, value) => {
        const view = value as {
          sessionId: string;
          provider: string;
          model: string;
          effort?: string;
        };
        const route = `${view.provider}/${view.model}${view.effort === undefined ? '' : ` (${view.effort})`}`;
        return [{ type: 'text' as const, text: `session ${view.sessionId} now uses ${route}` }];
      },
    },
    async execute(args, exec) {
      const provider = textOf(args.provider);
      const model = textOf(args.model);
      const effort = textOf(args.effort);
      if (provider === '' || model === '') {
        throw new ToolArgsError(['provider and model must both be non-empty']);
      }
      const requested = textOf(args.session_id);
      const sessionId = requested === '' ? (exec.agent?.session.header.id ?? '') : requested;
      if (sessionId === '') {
        throw new ToolArgsError([
          'session_id must name a session, or be omitted for the calling session',
        ]);
      }
      const selection: ModelSelection = {
        provider,
        model,
        ...(effort === '' ? {} : { reasoningEffort: ReasoningEffortId(effort) }),
      };
      if (llm === undefined || typeof llm.resolveCallConfig !== 'function') {
        throw new Error('Model selection is unavailable: the llm service is not mounted.');
      }
      try {
        await llm.resolveCallConfig(selection, exec.signal);
      } catch (error) {
        throw new Error(`Invalid model selection: ${messageOf(error)}`);
      }
      exec.signal.throwIfAborted();
      const resolved = await sessionController.resolveAgent(sessionId as never);
      if ('error' in resolved) throw resolved.error;
      const agent = resolved.agent;
      const previous = agent.model.current();
      agent.model.select(selection);
      return {
        sessionId,
        provider,
        model,
        ...(effort === '' ? {} : { effort }),
        ...(previous === undefined ? {} : { previous: { ...previous } }),
        archived: archivedSessionIds().includes(sessionId),
      };
    },
  });
}
