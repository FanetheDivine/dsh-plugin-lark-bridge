/**
 * lark-super-agent 行配置：在场状态的自动更新开关、闹钟条目、普通/复杂任务模型、默认任务类型与任务会话预设。
 * 导出 Config、readPresenceSwitches 与 readPresenceAlarms。
 */
import Schema from '@deepseek-ai/schemastery';

import type { Volatile } from '../types.ts';
import { normalizeAlarms, type PresenceAlarm } from './alarms.ts';
import type { TaskType } from './api.ts';
import type { PresenceSwitches } from './presence.ts';

/** 宿主传给 apply 的配置：字段是热重载引用。 */
export interface Config {
  /** GUI 文本输入把状态设为在电脑旁。 */
  guiInputSetsLocal: Volatile<boolean>;
  /** 飞书输入把状态设为离开。 */
  larkInputSetsRemote: Volatile<boolean>;
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
  /** 在场状态自动切换的闹钟条目。 */
  presenceAlarms: Volatile<PresenceAlarm[]>;
}

/** 行配置 schema；开关默认开启，默认任务类型默认 common，闹钟默认空列表，保存后原地生效。 */
export const Config: Schema<Config> = Schema.object({
  guiInputSetsLocal: Schema.boolean().default(true).volatile(),
  larkInputSetsRemote: Schema.boolean().default(true).volatile(),
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
  presenceAlarms: Schema.array(
    Schema.object({
      id: Schema.string(),
      time: Schema.string(),
      action: Schema.union([Schema.const('local'), Schema.const('remote')]),
      enabled: Schema.boolean().default(true),
      skipWeekends: Schema.boolean().default(true),
      skipHolidays: Schema.boolean().default(true),
    }),
  )
    .default([])
    .volatile(),
}) as unknown as Schema<Config>;

/** 展开热重载引用。 */
function unwrap(value: unknown): unknown {
  return typeof value === 'object' && value !== null && 'get' in value
    ? (value as { get(): unknown }).get()
    : value;
}

/** 读取一个开关的实时值；缺省或非布尔值按开启处理。 */
function readSwitch(value: unknown): boolean {
  const raw = unwrap(value);
  return typeof raw === 'boolean' ? raw : true;
}

/** 从行配置读取两个开关的实时值。 */
export function readPresenceSwitches(config: unknown): PresenceSwitches {
  const record =
    typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
  return {
    guiInputSetsLocal: readSwitch(record['guiInputSetsLocal']),
    larkInputSetsRemote: readSwitch(record['larkInputSetsRemote']),
  };
}

/** 从行配置读取闹钟条目的实时值。 */
export function readPresenceAlarms(config: unknown): PresenceAlarm[] {
  const record =
    typeof config === 'object' && config !== null ? (config as Record<string, unknown>) : {};
  return normalizeAlarms(unwrap(record['presenceAlarms']));
}
