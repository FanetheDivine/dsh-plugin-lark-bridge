/**
 * lark-super-agent 全局行：提供笔记与上报服务，以及全局在场状态与状态路由。
 * 两个预设子行通过 `larkSuperAgent` 服务复用同一套实现。
 */

import type { Context } from '../types.ts';
import { Config, readPresenceSwitches } from './config.ts';
import { PresenceStore } from './presence.ts';
import { registerPresenceRoute } from './routes.ts';
import { SuperAgentService } from './service.ts';
import { readWorkerModel } from './worker-model.ts';

export { Config };

/** 行标识，与 cordis.patch.yml 一致。 */
export const name = 'lark-super-agent';

/** 插件启用时提供共享服务并观察全部会话的输入；宿主的 Web 服务器就绪后注册在场状态路由。 */
export function apply(ctx: Context, config?: unknown): void {
  const presence = new PresenceStore({ switches: () => readPresenceSwitches(config) });
  const service = new SuperAgentService(ctx, {
    presence,
    workerModel: () => readWorkerModel(config),
  });
  ctx.effect(() => ctx.provide('larkSuperAgent', service), 'lark-super-agent: service');

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
      logger: scoped.logger,
    });
    scoped.effect(() => dispose, 'lark-super-agent: presence route');
  });
}
