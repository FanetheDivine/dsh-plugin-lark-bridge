/**
 * lark-super-agent 全局行：提供笔记与上报服务，以及全局在场状态与状态路由。
 * 两个预设子行通过 `larkSuperAgent` 服务复用同一套实现。
 */

import type { Context } from '../types.ts';
import { Config, readPresenceSwitches } from './config.ts';
import { PresenceStore } from './presence.ts';
import { registerPresenceRoute } from './routes.ts';
import { SuperAgentService } from './service.ts';

export { Config };

/** 行标识，与 cordis.patch.yml 一致。 */
export const name = 'lark-super-agent';

/** 插件启用时提供共享服务；宿主的 Web 服务器存在时注册在场状态路由。 */
export function apply(ctx: Context, config?: unknown): void {
  const presence = new PresenceStore({ switches: () => readPresenceSwitches(config) });
  const service = new SuperAgentService(ctx, { presence });
  ctx.effect(() => ctx.provide('larkSuperAgent', service), 'lark-super-agent: service');

  const webServer = ctx.get('webServer');
  if (webServer === undefined) return;
  const connection = ctx.get('connection');
  const dispose = registerPresenceRoute({
    webServer,
    ...(connection === undefined ? {} : { connection }),
    store: presence,
    logger: ctx.logger,
  });
  ctx.effect(() => dispose, 'lark-super-agent: presence route');
}
