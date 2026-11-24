/**
 * 工作会话模型：读取 lark-super-agent 行配置的 provider、模型与 effort，
 * 并把它只交给调度会话某一次 session_create 调用链内创建的工作会话。
 * 导出 WORKER_MODEL_KEYS、readWorkerModel、WorkerModelStore 与 LlmLike。
 */
import { AsyncLocalStorage } from 'node:async_hooks';

import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

/** 行配置中保存工作会话模型的三个字段。 */
export const WORKER_MODEL_KEYS = ['workerProvider', 'workerModel', 'workerEffort'] as const;

/** 宿主模型校验服务的最小接口。 */
export interface LlmLike {
  resolveCallConfig(config: ModelSelection, signal?: AbortSignal): Promise<unknown>;
}

/** 日志的最小接口。 */
export interface WarnLogger {
  warn(...args: unknown[]): void;
}

/** 读取一个字符串字段的实时值；缺省与非字符串按空处理。 */
function readText(value: unknown): string {
  const raw =
    typeof value === 'object' && value !== null && 'get' in value
      ? (value as { get(): unknown }).get()
      : value;
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * 从行配置读取工作会话模型。
 * provider 与模型同时非空才成立；effort 只在成立时生效，半组配置按未配置处理。
 */
export function readWorkerModel(config: unknown): ModelSelection | undefined {
  const record =
    typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
  const provider = readText(record['workerProvider']);
  const model = readText(record['workerModel']);
  if (provider === '' || model === '') return undefined;
  const effort = readText(record['workerEffort']);
  return {
    provider,
    model,
    ...(effort === '' ? {} : { reasoningEffort: ReasoningEffortId(effort) }),
  };
}

/** 错误的可读文本。 */
function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** 一次调度创建的调用链标记；新会话只取用一次。 */
interface CreationScope {
  consumed: boolean;
}

/**
 * 保存配置读取函数，并用异步上下文把配置的模型绑定到「调度会话这一次 session_create」的调用链。
 * 只有在该调用链内创建的会话能取到模型；其他路径创建的会话与并行的创建互不影响。
 */
export class WorkerModelStore {
  private readonly scope = new AsyncLocalStorage<CreationScope>();

  /** @param read - 读取配置里工作会话模型的实时值。 */
  constructor(private readonly read: () => ModelSelection | undefined) {}

  /** @returns 当前配置的工作会话模型，未配置时为 undefined。 */
  selection(): ModelSelection | undefined {
    return this.read();
  }

  /** 让 `run` 及其调用链内创建的第一个会话可取用配置的模型；没有配置时直接执行。 */
  during<T>(run: () => Promise<T>): Promise<T> {
    if (this.read() === undefined) return run();
    return this.scope.run({ consumed: false }, run);
  }

  /**
   * 新会话创建时读取应使用的模型：只在 {@link during} 的调用链内返回一次，并经宿主校验。
   * 不在调用链内、已被取用、校验失败或 llm 不可用时返回 undefined，让会话沿用宿主默认。
   */
  async take(llm: LlmLike | undefined, logger: WarnLogger): Promise<ModelSelection | undefined> {
    const scope = this.scope.getStore();
    if (scope === undefined || scope.consumed) return undefined;
    scope.consumed = true;
    const selection = this.read();
    if (selection === undefined) return undefined;
    if (llm === undefined || typeof llm.resolveCallConfig !== 'function') {
      logger.warn('lark-super-agent: llm service is unavailable; worker model not applied');
      return undefined;
    }
    try {
      await llm.resolveCallConfig(selection);
      return selection;
    } catch (error) {
      logger.warn(
        `lark-super-agent: configured worker model is unavailable; using the host default: ${describeError(error)}`,
      );
      return undefined;
    }
  }
}
