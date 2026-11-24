/**
 * lark-super-agent 全局行：提供笔记与上报服务，以及全局在场状态、到点调度与状态路由。
 * 两个预设子行通过 `larkSuperAgent` 服务复用同一套实现。
 */

import { holidayCachePath } from '../config.ts';
import type { Context } from '../types.ts';
import { Config, readPresenceAlarms, readPresenceSwitches } from './config.ts';
import { dayKeyOf, HolidayCalendar } from './holidays.ts';
import { PresenceStore } from './presence.ts';
import { registerPresenceRoute } from './routes.ts';
import { PresenceScheduler } from './schedule.ts';
import { SuperAgentService } from './service.ts';
import { readWorkerModel, WorkerModelStore } from './worker-model.ts';

export { Config };

/** 行标识，与 cordis.patch.yml 一致。 */
export const name = 'lark-super-agent';

/** 插件启用时提供共享服务并观察全部会话的输入；宿主的 Web 服务器就绪后注册在场状态路由。 */
export function apply(ctx: Context, config?: unknown): void {
  const presence = new PresenceStore({ switches: () => readPresenceSwitches(config) });
  const calendar = new HolidayCalendar({ cachePath: holidayCachePath(), logger: ctx.logger });
  const scheduler = new PresenceScheduler({
    alarms: () => readPresenceAlarms(config),
    store: presence,
    calendar,
    logger: ctx.logger,
  });
  const service = new SuperAgentService(ctx, {
    presence,
    workerModel: new WorkerModelStore(() => readWorkerModel(config)),
  });
  ctx.effect(() => ctx.provide('larkSuperAgent', service), 'lark-super-agent: service');
  // 到点调度随行启停；判定失败只记日志，不影响其他能力。
  ctx.effect(() => {
    scheduler.start();
    // 行启用时提前取一次节假日数据，配置页据此显示数据状态。
    void calendar.prepare(dayKeyOf(new Date()));
    return () => scheduler.stop();
  }, 'lark-super-agent: presence schedule');

  // 任一会话的 GUI 输入与飞书输入按开关更新全局状态。
  ctx.on('agent/pre-step', async (_payload, next) => {
    const decision = await next();
    if (decision.kind !== 'reject') presence.observe(decision.messages);
    return decision;
  });

  // webServer 是可选依赖：就绪后注册路由，下线时随作用域注销。
  ctx.inject(['webServer'], (scoped) => {
    const webServer = scoped.get('webServer');
    if (webServer === undefined) return;
    const connection = scoped.get('connection');
    const dispose = registerPresenceRoute({
      webServer,
      ...(connection === undefined ? {} : { connection }),
      store: presence,
      holidays: calendar,
      logger: scoped.logger,
    });
    scoped.effect(() => dispose, 'lark-super-agent: presence route');
  });
}
