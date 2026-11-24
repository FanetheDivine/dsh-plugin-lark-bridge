/**
 * 在场状态到点调度：按闹钟条目在到点执行一次切换，启动时补执行当天最近一个已过的到点。
 * 导出 PresenceScheduler、localDayKey、localTimeKey 与 instantOf。
 */
import { PRESENCE_TICK_MS } from '../constants.ts';
import { describeError } from '../utils.ts';
import { normalizeAlarms, type PresenceAction, type PresenceAlarm } from './alarms.ts';
import type { HolidayCalendar } from './holidays.ts';
import { dayKeyOf } from './holidays.ts';
import type { PresenceStore } from './presence.ts';

/** 本地日期键 `YYYY-MM-DD`。 */
export function localDayKey(date: Date): string {
  return dayKeyOf(date);
}

/** 本地时间键 `HH:mm`。 */
export function localTimeKey(date: Date): string {
  const hour = `${date.getHours()}`.padStart(2, '0');
  const minute = `${date.getMinutes()}`.padStart(2, '0');
  return `${hour}:${minute}`;
}

/** 把日期键与时间键组合成本地时刻的毫秒时间戳。 */
export function instantOf(day: string, time: string): number {
  const [year, month, date] = day.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  if (
    year === undefined ||
    month === undefined ||
    date === undefined ||
    hour === undefined ||
    minute === undefined
  ) {
    return Number.NaN;
  }
  return new Date(year, month - 1, date, hour, minute, 0, 0).getTime();
}

/** 调度器依赖。 */
export interface PresenceSchedulerOptions {
  /** 读取闹钟条目的实时值。 */
  readonly alarms: () => readonly PresenceAlarm[];
  readonly store: PresenceStore;
  readonly calendar: HolidayCalendar;
  readonly now?: () => Date;
  readonly intervalMs?: number;
  readonly logger?: { warn(message: string): void };
}

/** 同一分钟多条命中时选择动作：离开优先。 */
function actionOf(alarms: readonly PresenceAlarm[]): PresenceAction {
  return alarms.some((alarm) => alarm.action === 'remote') ? 'remote' : 'local';
}

/** 到点调度器：只在到点执行，不做周期纠偏。 */
export class PresenceScheduler {
  private readonly options: PresenceSchedulerOptions;
  private readonly executed = new Set<string>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;

  constructor(options: PresenceSchedulerOptions) {
    this.options = options;
  }

  /** 先补执行当天已过的到点，再开始周期判定。 */
  start(): void {
    if (this.timer !== undefined) return;
    void this.catchUp();
    const timer = setInterval(() => {
      void this.tick();
    }, this.options.intervalMs ?? PRESENCE_TICK_MS);
    // 定时器不阻止宿主进程退出。
    (timer as unknown as { unref?(): void }).unref?.();
    this.timer = timer;
  }

  /** 停止周期判定。 */
  stop(): void {
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
  }

  /** 判定当前分钟是否有到点条目并执行。 */
  async tick(now: Date = this.now()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const day = localDayKey(now);
      const clock = localTimeKey(now);
      this.prune(day);
      const due = normalizeAlarms(this.options.alarms()).filter(
        (alarm) => alarm.enabled && alarm.time === clock,
      );
      if (due.length === 0) return;
      const runnable: PresenceAlarm[] = [];
      for (const alarm of due) {
        const key = `${day}#${alarm.id}`;
        if (this.executed.has(key)) continue;
        this.executed.add(key);
        if (await this.options.calendar.skipDay(day, alarm)) continue;
        runnable.push(alarm);
      }
      if (runnable.length === 0) return;
      const instant = instantOf(day, clock);
      if (this.options.store.lastManualAt() >= instant) return;
      this.options.store.setAuto(actionOf(runnable));
    } catch (error) {
      this.options.logger?.warn(`lark-super-agent: 到点判定失败：${describeError(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** 补执行当天已过且未被跳过的最后一个到点。 */
  async catchUp(now: Date = this.now()): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const day = localDayKey(now);
      const clock = localTimeKey(now);
      const past = normalizeAlarms(this.options.alarms()).filter(
        (alarm) => alarm.enabled && alarm.time <= clock,
      );
      if (past.length === 0) return;
      const runnable: PresenceAlarm[] = [];
      for (const alarm of past) {
        if (!(await this.options.calendar.skipDay(day, alarm))) runnable.push(alarm);
      }
      if (runnable.length === 0) return;
      const latest = runnable.reduce(
        (max, alarm) => (alarm.time > max ? alarm.time : max),
        runnable[0]?.time ?? clock,
      );
      const same = runnable.filter((alarm) => alarm.time === latest);
      const instant = instantOf(day, latest);
      if (this.options.store.lastManualAt() >= instant) return;
      for (const alarm of past) {
        if (alarm.time <= latest) this.executed.add(`${day}#${alarm.id}`);
      }
      this.options.store.setAuto(actionOf(same));
    } catch (error) {
      this.options.logger?.warn(`lark-super-agent: 补执行失败：${describeError(error)}`);
    } finally {
      this.running = false;
    }
  }

  /** 丢弃非当天的执行记录，避免无界增长。 */
  private prune(day: string): void {
    for (const key of this.executed) {
      if (!key.startsWith(`${day}#`)) this.executed.delete(key);
    }
  }

  private now(): Date {
    return this.options.now?.() ?? new Date();
  }
}
