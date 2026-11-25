/** SA-调度会话预设子行：注册调度提示词、任务与会话工具，并按全局在场状态插入提醒。 */
import type { Context } from '../types.ts';
import { SA_DISPATCH_PROMPT } from './prompt.ts';
import {
  buildSessionCreateTool,
  type LlmLike,
  type SessionControllerLike,
} from './session-create.ts';
import { type DispatchContext, registerDispatchTools } from './tools.ts';

/** 子行标识，与预设补丁一致。 */
export const name = 'sa-dispatch';

/** 全局服务、提示词与工具注册表；全局行停用时本子行随依赖下线。 */
export const inject = ['larkSuperAgent', 'systemPrompt', 'tools'];

/** 等待全局共享服务，并在该预设作用域注册能力。 */
export function apply(ctx: Context): void {
  ctx.inject(inject, (injected) => {
    const dispatchCtx = injected as DispatchContext;
    const service = dispatchCtx.larkSuperAgent;
    dispatchCtx.systemPrompt.section({
      name: 'sa-dispatch:instructions',
      order: 700,
      text: SA_DISPATCH_PROMPT,
    });
    registerDispatchTools(dispatchCtx);
    // 覆写 meta-tools 的 session_create：预设补丁关闭了 meta-tools 的同名工具，这里提供带任务会话预设的版本。
    dispatchCtx.inject(['sessionController'], (scoped) => {
      const sessionController = scoped.get('sessionController') as
        | SessionControllerLike
        | undefined;
      if (sessionController === undefined) return;
      try {
        scoped.tools.register(
          buildSessionCreateTool({
            sessionController,
            llm: scoped.get('llm') as LlmLike | undefined,
            reads: { get: (name: string) => scoped.get(name) },
            service,
            logger: dispatchCtx.logger,
          }),
        );
      } catch (error) {
        dispatchCtx.logger.warn(
          'sa-dispatch cannot register session_create; disable session_create in the meta-tools row',
          error,
        );
      }
    });
    dispatchCtx.on('agent/pre-step', async ({ agent }, next) => {
      const decision = await next();
      if (decision.kind === 'reject') return decision;
      const notice = service.presence.reminderFor(agent.session, decision.messages);
      if (notice === undefined) return decision;
      return { ...decision, messages: [notice, ...decision.messages] };
    });
  });
}
