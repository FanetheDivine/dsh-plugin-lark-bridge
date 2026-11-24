// 节假日日历测试：解析、缓存、刷新、降级与跳过判定。
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import {
  dayKeyOf,
  HolidayCalendar,
  isWeekendDay,
  parseHolidayYear,
} from '../src/lark-super-agent/holidays.ts';

const NOW = 1_763_800_000_000;

/** 缓存路径：写系统临时目录，避免依赖仓库外的可写位置。 */
const CACHE_PATH = join(tmpdir(), 'rdt-043-holiday-cache.json');

/** 年度 JSON 假数据。 */
function yearPayload(): unknown {
  return {
    year: 2025,
    days: [
      { name: '国庆节', date: '2025-10-01', isOffDay: true },
      { name: '国庆节', date: '2025-10-04', isOffDay: true },
      { name: '国庆节', date: '2025-10-11', isOffDay: false },
    ],
  };
}

/** 构造带假缓存与假网络的日历。 */
function setup(
  options: {
    cache?: string | undefined;
    replies?: unknown[];
    fail?: boolean;
    now?: () => number;
  } = {},
) {
  let time = options.now?.() ?? NOW;
  const written: Array<{ path: string; text: string }> = [];
  const fetchJson = vi.fn(async (url: string) => {
    if (options.fail === true) throw new Error(`offline ${url}`);
    return options.replies?.shift() ?? yearPayload();
  });
  const logger = { warn: vi.fn() };
  const calendar = new HolidayCalendar({
    cachePath: CACHE_PATH,
    fetchJson,
    readCache: async (path) => {
      if (options.cache === undefined) throw new Error(`ENOENT ${path}`);
      return options.cache;
    },
    writeCache: async (path, text) => {
      written.push({ path, text });
    },
    now: () => time,
    logger,
  });
  return {
    calendar,
    fetchJson,
    logger,
    written,
    tick: (ms: number) => {
      time += ms;
    },
  };
}

describe('parseHolidayYear', () => {
  it('读取 days 的日期与是否放假', () => {
    const map = parseHolidayYear(yearPayload());
    expect(map?.['2025-10-01']).toBe(true);
    expect(map?.['2025-10-11']).toBe(false);
  });

  it('结构不符返回 undefined', () => {
    expect(parseHolidayYear(undefined)).toBeUndefined();
    expect(parseHolidayYear({ days: 'x' })).toBeUndefined();
  });
});

describe('dayKeyOf / isWeekendDay', () => {
  it('格式化本地日期并判断周末', () => {
    expect(dayKeyOf(new Date(2025, 9, 1))).toBe('2025-10-01');
    expect(isWeekendDay('2025-10-04')).toBe(true);
    expect(isWeekendDay('2025-10-01')).toBe(false);
    expect(isWeekendDay('not-a-date')).toBe(false);
  });
});

describe('HolidayCalendar', () => {
  it('没有缓存时联网获取并写回缓存', async () => {
    const { calendar, fetchJson, written } = setup();
    expect(calendar.status()).toEqual({ state: 'missing', fetchedAt: null });
    await calendar.prepare('2025-10-01');
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(fetchJson.mock.calls[0]?.[0]).toContain('2025.json');
    expect(calendar.lookup('2025-10-01')).toBe(true);
    expect(calendar.status().state).toBe('fresh');
    expect(written).toHaveLength(1);
    expect(written[0]?.path).toBe(CACHE_PATH);
    expect(JSON.parse(written[0]?.text ?? '{}')).toHaveProperty('years.2025');
  });

  it('主源失败后尝试备源', async () => {
    const replies: unknown[] = [yearPayload()];
    let calls = 0;
    const logger = { warn: vi.fn() };
    const calendar = new HolidayCalendar({
      cachePath: CACHE_PATH,
      fetchJson: async (url) => {
        calls += 1;
        if (calls === 1) throw new Error('primary down');
        return replies.shift();
      },
      readCache: async () => {
        throw new Error('ENOENT');
      },
      writeCache: async () => {},
      now: () => NOW,
      logger,
    });
    await calendar.prepare('2025-10-01');
    expect(calls).toBe(2);
    expect(calendar.lookup('2025-10-01')).toBe(true);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it('读取缓存后按过期时间区分 fresh 与 stale', async () => {
    const cache = JSON.stringify({
      fetchedAt: NOW - 60_000,
      years: { 2025: { '2025-10-01': true } },
    });
    const { calendar, fetchJson } = setup({ cache });
    await calendar.prepare('2025-10-01');
    expect(fetchJson).not.toHaveBeenCalled();
    expect(calendar.status().state).toBe('fresh');
    expect(calendar.lookup('2025-10-01')).toBe(true);
  });

  it('缓存过期且获取失败时沿用缓存并记日志', async () => {
    const cache = JSON.stringify({
      fetchedAt: NOW - 48 * 60 * 60 * 1000,
      years: { 2025: { '2025-10-01': true } },
    });
    const { calendar, logger } = setup({ cache, fail: true });
    await calendar.prepare('2025-10-01');
    expect(calendar.status().state).toBe('stale');
    expect(calendar.lookup('2025-10-01')).toBe(true);
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('无缓存且获取失败时状态为 missing 并记日志', async () => {
    const { calendar, logger } = setup({ fail: true });
    await calendar.prepare('2025-10-01');
    expect(calendar.status()).toEqual({ state: 'missing', fetchedAt: null });
    expect(calendar.lookup('2025-10-01')).toBeUndefined();
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn.mock.calls[0]?.[0]).toContain('无缓存');
  });

  it('失败后退避，不重复请求', async () => {
    const { calendar, fetchJson } = setup({ fail: true });
    await calendar.prepare('2025-10-01');
    expect(fetchJson).toHaveBeenCalledTimes(2);
    await calendar.prepare('2025-10-02');
    expect(fetchJson).toHaveBeenCalledTimes(2);
  });

  it('缓存损坏时按没有数据处理', async () => {
    const { calendar } = setup({ cache: '{bad json' });
    await calendar.prepare('2025-10-01');
    expect(calendar.status().state).toBe('fresh');
    expect(calendar.lookup('2025-10-01')).toBe(true);
  });
});

describe('skipDay', () => {
  it('法定节假日且开启跳过节假日时跳过', async () => {
    const { calendar } = setup();
    expect(await calendar.skipDay('2025-10-01', { skipWeekends: false, skipHolidays: true })).toBe(
      true,
    );
    expect(await calendar.skipDay('2025-10-01', { skipWeekends: false, skipHolidays: false })).toBe(
      false,
    );
  });

  it('调休上班日不按周末跳过', async () => {
    const { calendar } = setup();
    // 2025-10-11 是周六，但数据标记为调休上班。
    expect(isWeekendDay('2025-10-11')).toBe(true);
    expect(await calendar.skipDay('2025-10-11', { skipWeekends: true, skipHolidays: true })).toBe(
      false,
    );
  });

  it('普通周末按周末开关跳过', async () => {
    const { calendar } = setup();
    expect(await calendar.skipDay('2025-10-18', { skipWeekends: true, skipHolidays: true })).toBe(
      true,
    );
    expect(await calendar.skipDay('2025-10-18', { skipWeekends: false, skipHolidays: true })).toBe(
      false,
    );
  });

  it('没有节假日数据时只按周末跳过', async () => {
    const { calendar } = setup({ fail: true });
    expect(await calendar.skipDay('2025-10-01', { skipWeekends: false, skipHolidays: true })).toBe(
      false,
    );
    expect(await calendar.skipDay('2025-10-04', { skipWeekends: true, skipHolidays: true })).toBe(
      true,
    );
  });

  it('工作日不跳过', async () => {
    const { calendar } = setup();
    expect(await calendar.skipDay('2025-10-15', { skipWeekends: true, skipHolidays: true })).toBe(
      false,
    );
  });
});
