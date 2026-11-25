/**
 * 任务会话的模型与预设：读取 lark-super-agent 行配置的 provider、模型、effort 与预设。
 * 导出 readTaskModel 与 readTaskPreset。
 */
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

/** 展开热重载引用的实时值。 */
function unwrap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'get' in value
    ? (value as { get(): unknown }).get()
    : value;
}

/** 读取行配置中的一个字符串字段；缺省与非字符串按空处理。 */
function readText(config: unknown, field: string): string {
  const record =
    typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
  const raw = unwrap(record[field]);
  return typeof raw === 'string' ? raw.trim() : '';
}

/**
 * 读取任务会话模型。
 * provider 与模型同时非空才成立；effort 只在成立时生效，半组配置按未配置处理。
 */
export function readTaskModel(config: unknown): ModelSelection | undefined {
  const provider = readText(config, 'taskProvider');
  const model = readText(config, 'taskModel');
  if (provider === '' || model === '') return undefined;
  const effort = readText(config, 'taskEffort');
  return {
    provider,
    model,
    ...(effort === '' ? {} : { reasoningEffort: ReasoningEffortId(effort) }),
  };
}

/** 读取任务会话预设；未配置时返回空串，由宿主选择默认预设。 */
export function readTaskPreset(config: unknown): string {
  return readText(config, 'taskPreset');
}
