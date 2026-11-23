/**
 * lark-super-agent 全局行：提供笔记与上报服务。
 * 两个预设子行通过 `larkSuperAgent` 服务复用同一套实现。
 */

import type { Context } from '../types.ts';
import { SuperAgentService } from './service.ts';

/** 行标识，与 cordis.patch.yml 一致。 */
export const name = 'lark-super-agent';

/** 插件启用时提供共享服务。 */
export function apply(ctx: Context): void {
  const service = new SuperAgentService(ctx);
  ctx.effect(() => ctx.provide('larkSuperAgent', service), 'lark-super-agent: service');
}
