/**
 * 工作会话模型：读取 lark-super-agent 行配置的 provider、模型与 effort。
 * 导出 readWorkerModel。
 */
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

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
