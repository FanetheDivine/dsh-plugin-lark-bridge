/**
 * SA-调度会话的 `session_create`：覆写 dsh-plugin-meta-tools 的同名工具。
 * 预设始终取配置的「任务会话预设」；按任务类型或默认任务类型取模型；创建会话后立即建立任务。
 */
import type { Agent, ModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage, ReasoningEffortId } from '@deepseek-ai/dsh-llm';
import { defineTool, ToolArgsError, type ToolDefinition } from '@deepseek-ai/dsh-tools';

import { type LarkSuperAgentService, TASK_TYPES, type TaskType } from '../lark-super-agent/api.ts';

/** meta-tools 投递消息的来源标识，被管理会话据此包装调度消息。 */
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

/** 宿主的可读服务集合；缺失时降级。 */
export interface SessionCreateReads {
  readonly get: (name: string) => unknown;
}

/** 日志的最小接口。 */
export interface WarnLogger {
  warn(...args: unknown[]): void;
}

/** 工具的依赖。 */
export interface SessionCreateDeps {
  readonly sessionController: SessionControllerLike;
  readonly llm?: LlmLike | undefined;
  readonly reads: SessionCreateReads;
  readonly service: LarkSuperAgentService;
  readonly logger: WarnLogger;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 解析可选的任务类型参数；空串或省略返回 undefined，非法值抛 ToolArgsError。 */
function taskTypeOf(input: unknown): TaskType | undefined {
  const value = typeof input === 'string' ? input.trim() : '';
  if (value === '') return undefined;
  if ((TASK_TYPES as readonly string[]).includes(value)) return value as TaskType;
  throw new ToolArgsError(['task_type must be common, complex, or empty']);
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

/** 在宿主可用预设中匹配配置的预设；不可用或读取失败时返回空。 */
async function availablePreset(reads: SessionCreateReads, candidate: string): Promise<string> {
  if (candidate === '') return '';
  const presets = reads.get('agentPresets') as
    | { list(): Promise<readonly { readonly id: string; readonly broken?: string }[]> }
    | undefined;
  if (presets === undefined || typeof presets.list !== 'function') return '';
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
  const { sessionController, llm, reads, service, logger } = deps;

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
      logger.warn('lark-super-agent: llm service is unavailable; task model not applied');
      return undefined;
    }
    try {
      await llm.resolveCallConfig(selection, signal);
      return selection;
    } catch (error) {
      if (explicit) throw new Error(`Invalid model selection: ${messageOf(error)}`);
      logger.warn(
        `lark-super-agent: configured task model is unavailable; using the host default: ${messageOf(error)}`,
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

  /** 读取新会话的工作目录；读取失败时返回 undefined。 */
  async function sessionCwd(sessionId: string): Promise<string | undefined> {
    try {
      const resolved = await sessionController.resolveAgent(sessionId as never);
      if ('error' in resolved) return undefined;
      const cwd = resolved.agent.session?.header?.cwd;
      return typeof cwd === 'string' && cwd !== '' ? cwd : undefined;
    } catch {
      return undefined;
    }
  }

  return defineTool({
    name: 'session_create',
    description:
      "Create a DSH (DeepSeek Harness) session in a workspace or directory, name it, send its first prompt, and make it the task session. The preset comes from the plugin configuration. task_type selects the user's preconfigured common or complex task model (or the user's default when empty), and provider/model/effort override that model; omit or pass empty values for all of them unless the user explicitly asks. Returns the session id and the new task id.",
    parameters: {
      workspace_id: {
        type: 'string',
        description:
          "Workspace the session joins. Must have a workspace note. Exclusive with cwd; defaults to the calling session's working directory.",
      },
      cwd: {
        type: 'string',
        description: 'Absolute directory the session owns. Exclusive with workspace_id.',
      },
      task_type: {
        type: 'string',
        description:
          "Task complexity type: common or complex. Maps to the user's preconfigured common or complex task model. Always pass an empty string (or omit) to use the user's default task type unless the user explicitly specifies the task type.",
      },
      provider: {
        type: 'string',
        description:
          'Provider id that overrides the task_type model configuration. Required together with model. Omit unless the user explicitly specifies a model.',
      },
      model: {
        type: 'string',
        description:
          'Model id that overrides the task_type model configuration. Required together with provider. Omit unless the user explicitly specifies a model.',
      },
      effort: {
        type: 'string',
        description:
          'Reasoning effort id for the exact provider/model. Requires provider and model. Omit unless the user explicitly specifies it.',
      },
      title: { type: 'string', required: true, description: 'Display title for the task.' },
      prompt: { type: 'string', required: true, description: "The task's first message." },
      message_id: {
        type: 'string',
        description: 'Optional remote message id recorded on the task.',
      },
    },
    output: {
      schema: OUTPUT,
      render: (_args, value) => {
        const view = value as { sessionId: string; taskId: string; prompted: boolean };
        return [
          {
            type: 'text' as const,
            text: `created session ${view.sessionId} as ${view.taskId}${view.prompted ? ' (prompted)' : ''}`,
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
      const title = typeof args.title === 'string' ? args.title.trim() : '';
      if (title === '') throw new ToolArgsError(['title must not be empty']);
      const prompt = typeof args.prompt === 'string' ? args.prompt.trim() : '';
      if (prompt === '') throw new ToolArgsError(['prompt must not be empty']);
      const taskType = taskTypeOf(args.task_type);
      const explicit = modelSelectionOf(args.provider, args.model, args.effort);
      if (workspaceId !== '') await service.assertDispatchable(workspaceId);

      const configuredPreset = service.taskPreset();
      const agentPreset = await availablePreset(reads, configuredPreset);
      if (
        configuredPreset !== '' &&
        agentPreset === '' &&
        reads.get('agentPresets') !== undefined
      ) {
        logger.warn(
          `lark-super-agent: task preset ${configuredPreset} is unavailable; using the host default`,
        );
      }

      // 显式参数优先；否则按任务类型（为空时取默认任务类型）使用配置的任务模型，不可用时回退宿主默认。
      let selection: ModelSelection | undefined;
      if (explicit !== undefined) {
        selection = await validate(explicit, true, exec.signal);
      } else {
        const configured = service.taskModel(taskType);
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

      // 首条提示在创建完成后才发送，模型选择因此先于首轮请求写入。
      if (selection !== undefined) {
        try {
          (await agentOf(created.sessionId, exec.signal)).model.select(selection);
        } catch (error) {
          throw new Error(
            `The session '${created.sessionId}' was created, but its model selection failed: ${messageOf(error)}`,
          );
        }
      }

      let sessionTitle = title;
      try {
        const renamed = await sessionController.rename({
          sessionId: created.sessionId,
          title,
        });
        sessionTitle = renamed.title;
      } catch (error) {
        throw new Error(
          `The session '${created.sessionId}' was created, but its title failed: ${messageOf(error)}`,
        );
      }

      // 任务先于首条提示建立，首轮结束的自动上报才能找到任务。
      let taskId: string;
      try {
        const task = await service.createTask({
          title: sessionTitle,
          sessionId: created.sessionId,
          workspaceId: workspaceId === '' ? null : workspaceId,
          cwd: (await sessionCwd(created.sessionId)) ?? directory ?? fallbackCwd ?? process.cwd(),
          message: {
            text: prompt,
            ...(typeof args.message_id === 'string' && args.message_id.trim() !== ''
              ? { messageId: args.message_id.trim() }
              : {}),
          },
        });
        taskId = task.taskId;
      } catch (error) {
        throw new Error(
          `The session '${created.sessionId}' was created, but its task failed: ${messageOf(error)}`,
        );
      }

      let prompted = false;
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
          `The session '${created.sessionId}' was created as ${taskId}, but its first prompt failed: ${messageOf(error)}`,
        );
      }

      return {
        sessionId: created.sessionId,
        taskId,
        ...(created.agentPreset === undefined ? {} : { agentPreset: created.agentPreset }),
        title: sessionTitle,
        prompted,
      };
    },
  });
}
