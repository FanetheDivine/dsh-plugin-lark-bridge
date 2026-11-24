/**
 * 工作会话模型：读取 lark-super-agent 行配置的 provider、模型与 effort，
 * 并在调度会话执行 session_create 期间，把它交给新建的工作会话。
 * 导出 WORKER_MODEL_KEYS、readWorkerModel、WorkerModelStore 与 LlmLike。
 */
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

/** 保存配置读取函数与「调度会话正在创建会话」的标记。 */
export class WorkerModelStore {
  /** 正在执行的调度创建数；并行创建时大于 1。 */
  private active = 0;

  /** @param read - 读取配置里工作会话模型的实时值。 */
  constructor(private readonly read: () => ModelSelection | undefined) {}

  /** @returns 当前配置的工作会话模型，未配置时为 undefined。 */
  selection(): ModelSelection | undefined {
    return this.read();
  }

  /** 在 `run` 执行期间标记调度会话正在创建会话；没有配置时不标记。 */
  async during<T>(run: () => Promise<T>): Promise<T> {
    if (this.read() === undefined) return run();
    this.active += 1;
    try {
      return await run();
    } finally {
      this.active -= 1;
    }
  }

  /**
   * 新会话创建时读取应使用的模型：只在调度创建期间返回，并经宿主校验。
   * 校验失败时记录警告并返回 undefined，让会话沿用宿主默认。
   */
  async take(llm: LlmLike | undefined, logger: WarnLogger): Promise<ModelSelection | undefined> {
    if (this.active === 0) return undefined;
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
