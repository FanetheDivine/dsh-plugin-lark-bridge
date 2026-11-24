// 闹钟条目测试：校验、去重、排序、默认值与暂存文本互转。
import { describe, expect, it } from 'vitest';

import {
  alarmId,
  DEFAULT_ALARM_SETTINGS,
  formatAlarmList,
  isAlarmTime,
  normalizeAlarms,
  type PresenceAlarm,
  parseAlarmList,
} from '../src/lark-super-agent/alarms.ts';
import { readPresenceAlarms } from '../src/lark-super-agent/config.ts';
import { volatile } from './helpers.ts';

/** 构造一条合法闹钟。 */
function alarm(overrides: Partial<PresenceAlarm> = {}): PresenceAlarm {
  return {
    id: 'a1',
    time: '09:00',
    action: 'local',
    enabled: true,
    skipWeekends: true,
    skipHolidays: true,
    ...overrides,
  };
}

describe('isAlarmTime', () => {
  it('接受 24 小时制 HH:mm，拒绝越界与错格式', () => {
    expect(isAlarmTime('00:00')).toBe(true);
    expect(isAlarmTime('23:59')).toBe(true);
    expect(isAlarmTime('24:00')).toBe(false);
    expect(isAlarmTime('9:00')).toBe(false);
    expect(isAlarmTime('09:60')).toBe(false);
    expect(isAlarmTime(900)).toBe(false);
  });
});

describe('normalizeAlarms', () => {
  it('丢弃非法条目并补齐默认值', () => {
    const alarms = normalizeAlarms([
      { id: 'a', time: '09:00', action: 'local' },
      { id: 'b', time: '25:00', action: 'local' },
      { id: 'c', time: '10:00', action: 'away' },
      'nonsense',
    ]);
    expect(alarms).toEqual([
      {
        id: 'a',
        time: '09:00',
        action: 'local',
        enabled: DEFAULT_ALARM_SETTINGS.enabled,
        skipWeekends: DEFAULT_ALARM_SETTINGS.skipWeekends,
        skipHolidays: DEFAULT_ALARM_SETTINGS.skipHolidays,
      },
    ]);
  });

  it('同一动作内按时间去重，不同动作相同时间都保留', () => {
    const alarms = normalizeAlarms([
      { id: 'a', time: '09:00', action: 'local' },
      { id: 'b', time: '09:00', action: 'local' },
      { id: 'c', time: '09:00', action: 'remote' },
    ]);
    expect(alarms.map((item) => item.id)).toEqual(['c', 'a']);
  });

  it('按时间升序排列，同一时间离开在前', () => {
    const alarms = normalizeAlarms([
      { id: 'late', time: '18:00', action: 'local' },
      { id: 'remote', time: '09:00', action: 'remote' },
      { id: 'local', time: '09:00', action: 'local' },
    ]);
    expect(alarms.map((item) => item.id)).toEqual(['remote', 'local', 'late']);
  });

  it('缺少标识时按动作与时间生成稳定标识', () => {
    const alarms = normalizeAlarms([{ time: '09:00', action: 'remote' }]);
    expect(alarms[0]?.id).toBe('remote-09:00');
  });

  it('非数组输入按空列表处理', () => {
    expect(normalizeAlarms(undefined)).toEqual([]);
    expect(normalizeAlarms('[]')).toEqual([]);
  });
});

describe('formatAlarmList / parseAlarmList', () => {
  it('空列表序列化为空串，文本解析为空列表', () => {
    expect(formatAlarmList([])).toBe('');
    expect(parseAlarmList('')).toEqual([]);
    expect(parseAlarmList('   ')).toEqual([]);
  });

  it('往返保持规范化结果', () => {
    const alarms = [alarm({ time: '18:30', action: 'remote' }), alarm()];
    const text = formatAlarmList(alarms);
    expect(parseAlarmList(text)).toEqual(normalizeAlarms(alarms));
    expect(formatAlarmList(parseAlarmList(text) ?? [])).toBe(text);
  });

  it('非法文本与非法条目返回 undefined', () => {
    expect(parseAlarmList('{')).toBeUndefined();
    expect(parseAlarmList('{}')).toBeUndefined();
    expect(parseAlarmList('[{"time":"9:00","action":"local"}]')).toBeUndefined();
    expect(parseAlarmList('[{"time":"09:00","action":"away"}]')).toBeUndefined();
  });
});

describe('alarmId', () => {
  it('生成带前缀且互不相同的标识', () => {
    const first = alarmId();
    expect(first.startsWith('alarm-')).toBe(true);
    expect(first).not.toBe(alarmId());
  });
});

describe('readPresenceAlarms', () => {
  it('读取热重载引用并规范化', () => {
    const ref = volatile([{ id: 'a', time: '09:00', action: 'local' }]);
    expect(readPresenceAlarms({ presenceAlarms: ref })).toHaveLength(1);
    ref.set([]);
    expect(readPresenceAlarms({ presenceAlarms: ref })).toEqual([]);
  });

  it('缺省或非法值按空列表处理', () => {
    expect(readPresenceAlarms(undefined)).toEqual([]);
    expect(readPresenceAlarms({ presenceAlarms: 'x' })).toEqual([]);
  });
});
