/** SA-调度会话预设子行：注册调度提示词、五个笔记与候选工具，并按全局在场状态插入提醒。 */
import type { Context } from '../types.ts';
import { SA_DISPATCH_PROMPT } from './prompt.ts';
import { type DispatchContext, registerDispatchTools } from './tools.ts';

/** 子行标识，与预设补丁一致。 */
export const name = 'sa-dispatch';

/** 调度会话经 meta-tools 创建会话的工具名。 */
const SESSION_CREATE_TOOL = 'session_create';

/** 参数里是否显式指定了 provider 或 model；显式模型由 meta-tools 自己应用。 */
function hasExplicitModel(args: unknown): boolean {
  if (typeof args !== 'object' || args === null) return false;
  const record = args as Record<string, unknown>;
  return ['provider', 'model'].some((key) => {
    const value = record[key];
    return typeof value === 'string' && value.trim() !== '';
  });
}

/** 全局服务、提示词与工具注册表；全局行停用时本子行随依赖下线。 */
export const inject = ['larkSuperAgent', 'systemPrompt', 'tools'];

/** 等待全局共享服务，并在该预设作用域注册能力。 */
export function apply(ctx: Context): void {
  ctx.inject(inject, (injected) => {
    const dispatchCtx = injected as DispatchContext;
    dispatchCtx.systemPrompt.section({
      name: 'sa-dispatch:instructions',
      order: 700,
      text: SA_DISPATCH_PROMPT,
    });
    registerDispatchTools(dispatchCtx);
    // session_create 执行期间标记调度创建，工作子行据此给新会话选择配置的模型。
    dispatchCtx.on('tools/execute', (exec, next) =>
      exec.name === SESSION_CREATE_TOOL && !hasExplicitModel(exec.arguments)
        ? dispatchCtx.larkSuperAgent.workerModel.during(next)
        : next(),
    );
    dispatchCtx.on('agent/pre-step', async ({ agent }, next) => {
      const decision = await next();
      if (decision.kind === 'reject') return decision;
      const notice = dispatchCtx.larkSuperAgent.presence.reminderFor(
        agent.session,
        decision.messages,
      );
      if (notice === undefined) return decision;
      return { ...decision, messages: [notice, ...decision.messages] };
    });
  });
}
