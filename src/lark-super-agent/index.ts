/**
 * lark-super-agent 全局行：提供任务与上报服务，以及被管理会话能力。
 * 调度会话子行通过 `larkSuperAgent` 服务复用同一套实现。
 */

import type { Context } from '../types.ts';
import { Config } from './config.ts';
import { applyManagedSessions } from './managed/index.ts';
import { SuperAgentService } from './service.ts';
import { readTaskModel, readTaskPreset } from './task-model.ts';

export { Config };

/** 行标识，与 cordis.patch.yml 一致。 */
export const name = 'lark-super-agent';

/** 全局工具注册表；被管理会话的 send_report 注册在这里。 */
export const inject = ['tools'];

/** 提供共享服务并注册被管理会话能力。 */
export function apply(ctx: Context, config?: unknown): void {
  const service = new SuperAgentService(ctx, {
    taskModel: (taskType) => readTaskModel(config, taskType),
    taskPreset: () => readTaskPreset(config),
  });
  ctx.effect(() => ctx.provide('larkSuperAgent', service), 'lark-super-agent: service');
  // 被管理会话的能力与预设无关，注册在全局作用域。
  applyManagedSessions(ctx, service, () => service.bridgeSessionId());
}
