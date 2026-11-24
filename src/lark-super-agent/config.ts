/**
 * lark-super-agent 行配置：两个自动更新在场状态的开关。
 * 导出 Config 与 readPresenceSwitches。
 */
import Schema from '@deepseek-ai/schemastery';

import type { Volatile } from '../types.ts';
import type { PresenceSwitches } from './presence.ts';

/** 宿主传给 apply 的配置：字段是热重载引用。 */
export interface Config {
  /** GUI 文本输入把状态设为在电脑旁。 */
  guiInputSetsLocal: Volatile<boolean>;
  /** 飞书输入把状态设为离开。 */
  larkInputSetsRemote: Volatile<boolean>;
}

/** 行配置 schema；两个开关默认开启，保存后原地生效。 */
export const Config: Schema<Config> = Schema.object({
  guiInputSetsLocal: Schema.boolean().default(true).volatile(),
  larkInputSetsRemote: Schema.boolean().default(true).volatile(),
}) as unknown as Schema<Config>;

/** 读取一个开关的实时值；缺省或非布尔值按开启处理。 */
function readSwitch(value: unknown): boolean {
  const raw =
    typeof value === 'object' && value !== null && 'get' in value
      ? (value as { get(): unknown }).get()
      : value;
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
