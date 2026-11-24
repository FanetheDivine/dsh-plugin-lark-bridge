/**
 * 闹钟条目：在场状态自动切换的配置模型、校验与规范化。
 * 导出 PresenceAlarm、normalizeAlarms、formatAlarmList、parseAlarmList 与 alarmId。
 */
import { isRecord } from '../utils.ts';

/** 条目动作：local 表示切换为在电脑旁，remote 表示切换为离开。 */
export type PresenceAction = 'local' | 'remote';

/** 一条闹钟。 */
export interface PresenceAlarm {
  readonly id: string;
  /** 24 小时制 `HH:mm`。 */
  readonly time: string;
  readonly action: PresenceAction;
  readonly enabled: boolean;
  readonly skipWeekends: boolean;
  readonly skipHolidays: boolean;
}

/** 合法时间的匹配规则。 */
export const ALARM_TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 新建条目的默认设置。 */
export const DEFAULT_ALARM_SETTINGS = {
  enabled: true,
  skipWeekends: true,
  skipHolidays: true,
} as const;

/** 判断动作是否合法。 */
export function isPresenceAction(value: unknown): value is PresenceAction {
  return value === 'local' || value === 'remote';
}

/** 判断时间是否为合法的 `HH:mm`。 */
export function isAlarmTime(value: unknown): value is string {
  return typeof value === 'string' && ALARM_TIME_PATTERN.test(value);
}

/** 生成条目标识。 */
export function alarmId(): string {
  return `alarm-${Math.random().toString(36).slice(2, 10)}`;
}

/** 动作排序：同一时间下离开排在前面。 */
function actionRank(action: PresenceAction): number {
  return action === 'remote' ? 0 : 1;
}

/** 排序比较：按时间升序，同一时间离开在前。 */
export function compareAlarms(left: PresenceAlarm, right: PresenceAlarm): number {
  if (left.time !== right.time) return left.time < right.time ? -1 : 1;
  return actionRank(left.action) - actionRank(right.action);
}

/** 读取一个布尔设置；缺省或非布尔值取默认值。 */
function readFlag(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

/** 把配置值规范化为条目列表：丢弃非法条目，同一动作内按时间去重。 */
export function normalizeAlarms(value: unknown): PresenceAlarm[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const alarms: PresenceAlarm[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const { time, action } = item;
    if (!isAlarmTime(time) || !isPresenceAction(action)) continue;
    const id =
      typeof item['id'] === 'string' && item['id'].trim() !== ''
        ? item['id'].trim()
        : `${action}-${time}`;
    const key = `${action}#${time}`;
    if (seen.has(key)) continue;
    seen.add(key);
    alarms.push({
      id,
      time,
      action,
      enabled: readFlag(item['enabled'], DEFAULT_ALARM_SETTINGS.enabled),
      skipWeekends: readFlag(item['skipWeekends'], DEFAULT_ALARM_SETTINGS.skipWeekends),
      skipHolidays: readFlag(item['skipHolidays'], DEFAULT_ALARM_SETTINGS.skipHolidays),
    });
  }
  return alarms.sort(compareAlarms);
}

/** 把条目列表序列化为配置页暂存文本；空列表返回空串。 */
export function formatAlarmList(alarms: readonly PresenceAlarm[]): string {
  const normalized = normalizeAlarms(alarms);
  return normalized.length === 0 ? '' : JSON.stringify(normalized);
}

/** 解析配置页暂存文本；文本非法或条目非法时返回 undefined。 */
export function parseAlarmList(text: string): PresenceAlarm[] | undefined {
  const trimmed = text.trim();
  if (trimmed === '') return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed) as unknown;
  } catch {
    return undefined;
  }
  if (!Array.isArray(parsed)) return undefined;
  for (const item of parsed) {
    if (!isRecord(item)) return undefined;
    if (!isAlarmTime(item['time']) || !isPresenceAction(item['action'])) return undefined;
  }
  return normalizeAlarms(parsed);
}
