/**
 * lark-super-agent 行配置：普通/复杂任务模型、默认任务类型与任务会话预设。
 * 导出 Config。
 */
import Schema from '@deepseek-ai/schemastery';

import type { Volatile } from '../types.ts';
import type { TaskType } from './api.ts';

/** 宿主传给 apply 的配置：字段是热重载引用。 */
export interface Config {
  /** 普通任务会话的 provider；与 commonTaskModel 成对。 */
  commonTaskProvider: Volatile<string>;
  /** 普通任务会话的 model；与 commonTaskProvider 成对。 */
  commonTaskModel: Volatile<string>;
  /** 普通任务会话的推理等级；仅在模型成对时生效。 */
  commonTaskEffort: Volatile<string>;
  /** 复杂任务会话的 provider；与 complexTaskModel 成对。 */
  complexTaskProvider: Volatile<string>;
  /** 复杂任务会话的 model；与 complexTaskProvider 成对。 */
  complexTaskModel: Volatile<string>;
  /** 复杂任务会话的推理等级；仅在模型成对时生效。 */
  complexTaskEffort: Volatile<string>;
  /** 默认任务类型；未指定任务类型时使用。 */
  defaultTaskType: Volatile<TaskType>;
  /** 新建任务会话时使用的预设；空值跟随宿主默认。 */
  taskPreset: Volatile<string>;
}

/** 行配置 schema；保存后原地生效。 */
export const Config: Schema<Config> = Schema.object({
  commonTaskProvider: Schema.string().default('').volatile(),
  commonTaskModel: Schema.string().default('').volatile(),
  commonTaskEffort: Schema.string().default('').volatile(),
  complexTaskProvider: Schema.string().default('').volatile(),
  complexTaskModel: Schema.string().default('').volatile(),
  complexTaskEffort: Schema.string().default('').volatile(),
  defaultTaskType: Schema.union([Schema.const('common'), Schema.const('complex')])
    .default('common')
    .volatile(),
  taskPreset: Schema.string().default('').volatile(),
}) as unknown as Schema<Config>;
