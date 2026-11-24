/**
 * 中国法定节假日数据：联网获取、缓存、过期刷新与降级。
 * 导出 HolidayCalendar、HolidayDataStatus、parseHolidayYear、dayKeyOf 与 isWeekendDay。
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import {
  HOLIDAY_RETRY_MS,
  HOLIDAY_SOURCE_FALLBACK,
  HOLIDAY_SOURCE_PRIMARY,
  HOLIDAY_TIMEOUT_MS,
  HOLIDAY_TTL_MS,
} from '../constants.ts';
import { describeError, isRecord } from '../utils.ts';

/** 节假日数据的可用状态：fresh 为近期获取成功，stale 为使用旧缓存，missing 为没有数据。 */
export type HolidayDataState = 'fresh' | 'stale' | 'missing';

/** 节假日数据状态。 */
export interface HolidayDataStatus {
  readonly state: HolidayDataState;
  readonly fetchedAt: number | null;
}

/** 单条闹钟的跳过设置。 */
export interface HolidaySkipSettings {
  readonly skipWeekends: boolean;
  readonly skipHolidays: boolean;
}

/** 日历依赖；网络、缓存读写与时钟都可替换，便于测试。 */
export interface HolidayCalendarOptions {
  /** 缓存文件路径。 */
  readonly cachePath: string;
  readonly fetchJson?: (url: string) => Promise<unknown>;
  readonly readCache?: (path: string) => Promise<string>;
  readonly writeCache?: (path: string, text: string) => Promise<void>;
  readonly now?: () => number;
  readonly logger?: { warn(message: string): void };
  readonly ttlMs?: number;
  readonly retryMs?: number;
  readonly timeoutMs?: number;
}

/** 本地日期键 `YYYY-MM-DD`。 */
export function dayKeyOf(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** 判断日期是否为周六或周日；按本地日历计算。 */
export function isWeekendDay(date: string): boolean {
  const [year, month, day] = date.split('-').map(Number);
  if (year === undefined || month === undefined || day === undefined) return false;
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return false;
  const weekday = new Date(year, month - 1, day).getDay();
  return weekday === 0 || weekday === 6;
}

/** 从年度 JSON 解析日期到「是否放假」的映射；结构不符时返回 undefined。 */
export function parseHolidayYear(value: unknown): Record<string, boolean> | undefined {
  const days = isRecord(value) ? value['days'] : undefined;
  if (!Array.isArray(days)) return undefined;
  const map: Record<string, boolean> = {};
  for (const day of days) {
    if (!isRecord(day)) continue;
    const date = day['date'];
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
    map[date] = day['isOffDay'] === true;
  }
  return map;
}

/** 默认的网络获取：带超时，非 2xx 视为失败。 */
async function fetchJsonWithTimeout(url: string, timeoutMs: number): Promise<unknown> {
  const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs) });
  if (!response.ok) throw new Error(`holiday source responded ${response.status}`);
  return (await response.json()) as unknown;
}

/** 把年份替换进数据源地址。 */
function sourceUrl(template: string, year: number): string {
  return template.replace('<year>', String(year));
}

/** 节假日日历：按年获取，缓存到本地，过期后刷新。 */
export class HolidayCalendar {
  private readonly options: HolidayCalendarOptions;
  private readonly fetchJson: (url: string) => Promise<unknown>;
  private readonly readCache: (path: string) => Promise<string>;
  private readonly writeCache: (path: string, text: string) => Promise<void>;
  private readonly ttlMs: number;
  private readonly retryMs: number;
  private years: Record<string, Record<string, boolean>> = {};
  private fetchedAt: number | null = null;
  private loaded = false;
  private lastAttemptAt = 0;
  private refreshing: Promise<void> | undefined;

  constructor(options: HolidayCalendarOptions) {
    this.options = options;
    const timeoutMs = options.timeoutMs ?? HOLIDAY_TIMEOUT_MS;
    this.fetchJson = options.fetchJson ?? ((url) => fetchJsonWithTimeout(url, timeoutMs));
    this.readCache = options.readCache ?? ((path) => readFile(path, 'utf8'));
    this.writeCache = options.writeCache ?? ((path, text) => writeFile(path, text, 'utf8'));
    this.ttlMs = options.ttlMs ?? HOLIDAY_TTL_MS;
    this.retryMs = options.retryMs ?? HOLIDAY_RETRY_MS;
  }

  /** 当前数据状态。 */
  status(): HolidayDataStatus {
    if (this.fetchedAt === null) return { state: 'missing', fetchedAt: null };
    const state = this.now() - this.fetchedAt > this.ttlMs ? 'stale' : 'fresh';
    return { state, fetchedAt: this.fetchedAt };
  }

  /** 查询某日：true 表示放假，false 表示调休上班，undefined 表示没有数据。 */
  lookup(date: string): boolean | undefined {
    const map = this.years[date.slice(0, 4)];
    return map === undefined ? undefined : map[date];
  }

  /** 载入缓存，并在缺少年份数据或缓存过期时刷新。 */
  async prepare(date: string): Promise<void> {
    await this.load();
    const year = Number(date.slice(0, 4));
    if (!Number.isFinite(year)) return;
    const hasYear = this.years[String(year)] !== undefined;
    const expired = this.fetchedAt === null || this.now() - this.fetchedAt > this.ttlMs;
    if (!hasYear || expired) await this.refresh(year);
  }

  /** 判断某条闹钟在指定日期是否跳过。 */
  async skipDay(date: string, settings: HolidaySkipSettings): Promise<boolean> {
    await this.prepare(date);
    const offDay = this.lookup(date);
    if (settings.skipHolidays && offDay === true) return true;
    if (!settings.skipWeekends) return false;
    return isWeekendDay(date) && offDay !== false;
  }

  /** 读取缓存；缺失或损坏时按没有数据处理。 */
  private async load(): Promise<void> {
    if (this.loaded) return;
    this.loaded = true;
    let text: string;
    try {
      text = await this.readCache(this.options.cachePath);
    } catch {
      return;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(text) as unknown;
    } catch {
      return;
    }
    if (!isRecord(parsed)) return;
    const years = parsed['years'];
    if (isRecord(years)) {
      for (const [year, map] of Object.entries(years)) {
        if (!isRecord(map)) continue;
        const days: Record<string, boolean> = {};
        for (const [date, offDay] of Object.entries(map)) {
          if (typeof offDay === 'boolean') days[date] = offDay;
        }
        this.years[year] = days;
      }
    }
    const fetchedAt = parsed['fetchedAt'];
    this.fetchedAt = typeof fetchedAt === 'number' && fetchedAt > 0 ? fetchedAt : null;
  }

  /** 刷新某年数据；并发调用共享同一次请求，失败后退避。 */
  private async refresh(year: number): Promise<void> {
    if (this.refreshing !== undefined) {
      await this.refreshing;
      return;
    }
    if (this.lastAttemptAt !== 0 && this.now() - this.lastAttemptAt < this.retryMs) return;
    this.lastAttemptAt = this.now();
    this.refreshing = this.fetchYear(year).finally(() => {
      this.refreshing = undefined;
    });
    await this.refreshing;
  }

  /** 依次尝试主源与备源；全部失败时保留已有缓存并记一条日志。 */
  private async fetchYear(year: number): Promise<void> {
    let lastError: unknown;
    for (const template of [HOLIDAY_SOURCE_PRIMARY, HOLIDAY_SOURCE_FALLBACK]) {
      try {
        const parsed = parseHolidayYear(await this.fetchJson(sourceUrl(template, year)));
        if (parsed === undefined) throw new Error('unexpected holiday payload');
        this.years[String(year)] = parsed;
        this.fetchedAt = this.now();
        await this.persist();
        return;
      } catch (error) {
        lastError = error;
      }
    }
    this.options.logger?.warn(
      `lark-super-agent: 节假日数据获取失败，${this.fetchedAt === null ? '无缓存可用，按仅跳过周末处理' : '沿用缓存'}：${describeError(lastError)}`,
    );
  }

  /** 写回缓存；写入失败只记日志。 */
  private async persist(): Promise<void> {
    const payload = JSON.stringify({ fetchedAt: this.fetchedAt, years: this.years });
    try {
      await mkdir(dirname(this.options.cachePath), { recursive: true });
      await this.writeCache(this.options.cachePath, payload);
    } catch (error) {
      this.options.logger?.warn(`lark-super-agent: 节假日缓存写入失败：${describeError(error)}`);
    }
  }

  private now(): number {
    return this.options.now?.() ?? Date.now();
  }
}
