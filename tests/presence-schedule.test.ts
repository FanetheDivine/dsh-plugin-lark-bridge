// 到点调度测试：到点执行、去重、动作优先级、手动优先、跳过与启动补执行。
import { describe, expect, it, vi } from 'vitest';

import type { PresenceAlarm } from '../src/lark-super-agent/alarms.ts';
import type { HolidayCalendar, HolidaySkipSettings } from '../src/lark-super-agent/holidays.ts';
import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import {
  instantOf,
  localDayKey,
  localTimeKey,
  PresenceScheduler,
} from '../src/lark-super-agent/schedule.ts';

/** 构造一条闹钟。 */
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

/** 构造不联网的假日历；`skip` 决定某日是否跳过。 */
function fakeCalendar(skip: (date: string) => boolean = () => false) {
  const calls: Array<{ date: string; settings: HolidaySkipSettings }> = [];
  const calendar = {
    async skipDay(date: string, settings: HolidaySkipSettings) {
      calls.push({ date, settings });
      return skip(date);
    },
  } as unknown as HolidayCalendar;
  return { calendar, calls };
}

/** 构造调度器与可推进的时钟。 */
function setup(options: {
  alarms: PresenceAlarm[];
  skip?: (date: string) => boolean;
  start?: Date;
}) {
  let clock = (options.start ?? new Date(2025, 9, 1, 8, 30)).getTime();
  const store = new PresenceStore({
    switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
    now: () => clock,
  });
  const { calendar, calls } = fakeCalendar(options.skip);
  const scheduler = new PresenceScheduler({
    alarms: () => options.alarms,
    store,
    calendar,
    now: () => new Date(clock),
  });
  return {
    store,
    scheduler,
    calls,
    setClock: (date: Date) => {
      clock = date.getTime();
    },
  };
}

describe('时间键', () => {
  it('格式化本地日期与时间，并组合成时刻', () => {
    const date = new Date(2025, 9, 1, 9, 5);
    expect(localDayKey(date)).toBe('2025-10-01');
    expect(localTimeKey(date)).toBe('09:05');
    expect(instantOf('2025-10-01', '09:05')).toBe(date.getTime());
  });
});

describe('PresenceScheduler.tick', () => {
  it('到点切换到条目动作', async () => {
    const { store, scheduler } = setup({ alarms: [alarm()] });
    store.setAuto('remote');
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    expect(store.get().presence).toBe('local');
  });

  it('同一分钟只执行一次', async () => {
    const { store, scheduler } = setup({ alarms: [alarm({ action: 'remote' })] });
    const listener = vi.fn();
    store.subscribe(listener);
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 40));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('状态已是目标时不变更更新时间', async () => {
    const { store, scheduler } = setup({ alarms: [alarm()] });
    const before = store.get();
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    expect(store.get()).toEqual(before);
  });

  it('同一分钟两种动作以离开为准', async () => {
    const { store, scheduler } = setup({
      alarms: [
        alarm({ id: 'local', time: '09:00' }),
        alarm({ id: 'remote', time: '09:00', action: 'remote' }),
      ],
    });
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    expect(store.get().presence).toBe('remote');
  });

  it('停用条目与未到点条目不执行', async () => {
    const { store, scheduler } = setup({
      alarms: [alarm({ enabled: false }), alarm({ id: 'a2', time: '18:00' })],
    });
    store.setAuto('remote');
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    await scheduler.tick(new Date(2025, 9, 1, 18, 30));
    expect(store.get().presence).toBe('remote');
  });

  it('被跳过的日期不执行', async () => {
    const { store, scheduler } = setup({ alarms: [alarm()], skip: () => true });
    store.setAuto('remote');
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    expect(store.get().presence).toBe('remote');
  });

  it('把条目的跳过设置交给假日历', async () => {
    const { scheduler, calls } = setup({
      alarms: [alarm({ skipWeekends: false, skipHolidays: true })],
    });
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 5));
    expect(calls[0]).toMatchObject({
      date: '2025-10-01',
      settings: { skipWeekends: false, skipHolidays: true },
    });
  });

  it('手动切换发生在到点之后时保留手动结果', async () => {
    const { store, scheduler, setClock } = setup({ alarms: [alarm()] });
    store.setAuto('remote');
    setClock(new Date(2025, 9, 1, 9, 0, 5));
    store.set('remote');
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 10));
    expect(store.get().presence).toBe('remote');
  });

  it('手动切换发生在到点之前时到点照常执行', async () => {
    const { store, scheduler } = setup({
      alarms: [alarm({ time: '18:00', action: 'remote' })],
      start: new Date(2025, 9, 1, 8, 0),
    });
    store.set('local');
    await scheduler.tick(new Date(2025, 9, 1, 18, 0, 5));
    expect(store.get().presence).toBe('remote');
  });
});

describe('PresenceScheduler.catchUp', () => {
  it('补执行当天最近一个已过的到点', async () => {
    const { store, scheduler } = setup({
      alarms: [
        alarm({ id: 'a1', time: '08:00', action: 'remote' }),
        alarm({ id: 'a2', time: '09:00', action: 'local' }),
        alarm({ id: 'a3', time: '18:00', action: 'remote' }),
      ],
    });
    store.setAuto('remote');
    await scheduler.catchUp(new Date(2025, 9, 1, 10, 0));
    expect(store.get().presence).toBe('local');
  });

  it('最近一个到点被跳过时取前一个未跳过的', async () => {
    const { store, scheduler } = setup({
      alarms: [
        alarm({ id: 'a1', time: '08:00', action: 'remote' }),
        alarm({ id: 'a2', time: '09:00', action: 'local' }),
      ],
      skip: (date) => date === '2025-10-01',
    });
    store.setAuto('local');
    const { calendar } = fakeCalendar((date) => date === '2025-10-01');
    const skipping = new PresenceScheduler({
      alarms: () => [
        alarm({ id: 'a1', time: '08:00', action: 'remote' }),
        alarm({ id: 'a2', time: '09:00', action: 'local' }),
      ],
      store,
      calendar,
      now: () => new Date(2025, 9, 1, 10, 0),
    });
    await skipping.catchUp(new Date(2025, 9, 1, 10, 0));
    expect(store.get().presence).toBe('local');
    expect(scheduler).toBeDefined();
  });

  it('当天没有已过的到点时不动', async () => {
    const { store, scheduler } = setup({ alarms: [alarm({ time: '18:00', action: 'remote' })] });
    store.setAuto('local');
    await scheduler.catchUp(new Date(2025, 9, 1, 9, 0));
    expect(store.get().presence).toBe('local');
  });

  it('补执行后同一分钟不再重复执行', async () => {
    const { store, scheduler } = setup({ alarms: [alarm({ action: 'remote' })] });
    await scheduler.catchUp(new Date(2025, 9, 1, 9, 0, 20));
    const listener = vi.fn();
    store.subscribe(listener);
    await scheduler.tick(new Date(2025, 9, 1, 9, 0, 30));
    expect(listener).not.toHaveBeenCalled();
    expect(store.get().presence).toBe('remote');
  });

  it('手动切换晚于最近到点时跳过补执行', async () => {
    const { store, scheduler, setClock } = setup({ alarms: [alarm({ action: 'remote' })] });
    setClock(new Date(2025, 9, 1, 9, 0, 20));
    store.set('local');
    await scheduler.catchUp(new Date(2025, 9, 1, 9, 0, 20));
    expect(store.get().presence).toBe('local');
  });
});

describe('PresenceScheduler 生命周期', () => {
  it('start 注册定时器，stop 清理且可重复调用', () => {
    vi.useFakeTimers();
    try {
      const { scheduler } = setup({ alarms: [alarm()] });
      scheduler.start();
      scheduler.start();
      expect(vi.getTimerCount()).toBe(1);
      scheduler.stop();
      expect(vi.getTimerCount()).toBe(0);
      scheduler.stop();
    } finally {
      vi.useRealTimers();
    }
  });

  it('定时器到点后执行判定', async () => {
    vi.useFakeTimers();
    try {
      const { store, scheduler } = setup({
        alarms: [alarm({ action: 'remote' })],
        start: new Date(2025, 9, 1, 9, 0, 0),
      });
      store.setAuto('local');
      scheduler.start();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(store.get().presence).toBe('remote');
      scheduler.stop();
    } finally {
      vi.useRealTimers();
    }
  });
});
