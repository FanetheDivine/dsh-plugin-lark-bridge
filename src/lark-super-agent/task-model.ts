/**
 * 任务会话的模型、默认任务类型与预设：读取 lark-super-agent 行配置的普通/复杂任务模型、默认任务类型与预设。
 * 导出 readDefaultTaskType、readTaskModel 与 readTaskPreset。
 */
import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { ReasoningEffortId } from '@deepseek-ai/dsh-llm';

import type { TaskType } from './api.ts';

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

/** 读取默认任务类型；仅当值为 'complex' 时返回 'complex'，其余返回 'common'。 */
export function readDefaultTaskType(config: unknown): TaskType {
  return readText(config, 'defaultTaskType') === 'complex' ? 'complex' : 'common';
}

/**
 * 按任务类型（省略时取默认任务类型）读取任务会话模型。
 * provider 与模型同时非空才成立；effort 只在成立时生效，半组配置按未配置处理。
 */
export function readTaskModel(config: unknown, taskType?: TaskType): ModelSelection | undefined {
  const resolved = taskType ?? readDefaultTaskType(config);
  const prefix = resolved === 'complex' ? 'complexTask' : 'commonTask';
  const provider = readText(config, `${prefix}Provider`);
  const model = readText(config, `${prefix}Model`);
  if (provider === '' || model === '') return undefined;
  const effort = readText(config, `${prefix}Effort`);
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
