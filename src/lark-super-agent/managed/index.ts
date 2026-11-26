/**
 * 被管理会话能力：send_report、调度消息包装、提问拦截、S 注入、自动上报、失败与归档通知。
 * 这些能力与预设无关，全部注册在全局 lark-super-agent 行。
 */
import type {} from '@deepseek-ai/dsh-session';

import type { Context } from '../../types.ts';
import type { LarkSuperAgentService } from '../api.ts';
import { AskGuard } from './ask-guard.ts';
import { wrapDispatchMessages } from './dispatch-message.ts';
import { buildSendReportTool } from './report-tool.ts';
import { insertionIndex, type SessionLike, TaskLogInjector } from './task-log-injector.ts';
import { TaskLogObserver } from './task-log-observer.ts';
import { hasTaskRules, taskRulesMessage } from './task-rules.ts';
import { TurnReporter } from './turn-report.ts';

/** 本模块依赖的全局服务。 */
export const inject = ['larkSuperAgent', 'tools'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/** 从会话事件中取规范化后的 type 与 data。 */
function eventData(event: unknown): { type?: unknown; data: Record<string, unknown> } {
  const record = isRecord(event) ? event : {};
  const data = isRecord(record.data) ? record.data : record;
  return { type: record.type ?? data.type, data };
}

/** 会话自身的 id 与其父会话链。 */
interface AgentLike {
  readonly session?: {
    readonly id?: string;
    readonly header?: { readonly origin?: string; readonly parentSession?: string };
  };
}

interface AgentsLike {
  list?(): Iterable<AgentLike>;
}

/** 判断会话是否仍有运行中的子代理。 */
function subagentChecker(ctx: Context): (sessionId: string) => boolean {
  return (sessionId: string): boolean => {
    const agents = ctx.get('agents') as AgentsLike | undefined;
    if (typeof agents?.list !== 'function') return false;
    try {
      for (const agent of agents.list()) {
        const header = agent.session?.header;
        if (header?.origin !== 'subagent') continue;
        if (header.parentSession === sessionId) return true;
      }
    } catch {
      return false;
    }
    return false;
  };
}

/** 在全局作用域注册被管理会话的全部能力。 */
export function applyManagedSessions(
  ctx: Context,
  service: LarkSuperAgentService,
  bridgeSessionId: () => Promise<string | null>,
): void {
  const isManaged = async (sessionId: string): Promise<boolean> =>
    (await service.managedTask(sessionId)) !== undefined;

  // send_report 对除调度会话外的所有会话可见；是否已管理由执行体判定。
  const unregister = ctx.tools.register(buildSendReportTool(service), {
    when: async ({ agent }) => {
      const sessionId = agent?.session?.id;
      if (sessionId === undefined || sessionId === '') return false;
      const dispatchId = await bridgeSessionId();
      return dispatchId === null || sessionId !== dispatchId;
    },
  });
  ctx.effect(() => () => unregister(), 'lark-super-agent: send_report tool');

  const askGuard = new AskGuard({
    isManaged,
    gateway: () => ctx.get('typertGateway') as never,
    logger: ctx.logger,
  });
  // 会话开始被管理时结束它等待中的提问；加载时再清一次网关里残留的请求。
  service.setManagedSessionListener((sessionId) => askGuard.cancel(sessionId));
  void askGuard.sweep();

  ctx.on('tools/pre-execute', (exec, next) => askGuard.beforeExecute(exec as never, next));
  ctx.on('tools/execute', (exec, next) => askGuard.aroundExecute(exec as never, next) as never);
  ctx.on('tools/post-execute', (exec, result, next) =>
    askGuard.afterExecute(exec as never, result, next as never),
  );

  const reporter = new TurnReporter({
    service,
    hasRunningSubagent: subagentChecker(ctx),
    logger: ctx.logger,
  });

  const taskLogObserver = new TaskLogObserver({
    service,
    archivedSessionIds: () =>
      (ctx.get('workspaceRegistry') as { archivedSessionIds?: readonly string[] } | undefined)
        ?.archivedSessionIds ?? [],
    logger: ctx.logger,
  });

  // 轮次结束自动上报、任务日志与失败通知。
  ctx.on('session/event', (session, event) => {
    const sessionId = session.id;
    if (sessionId === undefined || sessionId === '') return;
    const { type, data } = eventData(event);
    reporter.observe(sessionId, event);
    taskLogObserver.observe(sessionId, event);
    if (type !== 'turn/end') return;
    const reason = isRecord(data.reason) ? data.reason : undefined;
    if (reason?.kind !== 'error') return;
    void service.notifyFailure(sessionId, reason.error ?? 'turn failed').catch((error: unknown) => {
      ctx.logger.warn('lark-super-agent: failure notification failed', error);
    });
  });

  // 调度消息来源标记与 S 注入。
  ctx.on('agent/pre-step', async ({ agent }, next) => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    const sessionId = agent.session?.id;
    if (sessionId === undefined || sessionId === '') return decision;
    const wrapped = wrapDispatchMessages(decision.messages);
    const rules = askGuard.takeRules(sessionId);
    if (!rules)
      return wrapped === decision.messages ? decision : { ...decision, messages: wrapped };
    if (hasTaskRules(wrapped)) return { ...decision, messages: wrapped };
    return { ...decision, messages: [taskRulesMessage(), ...wrapped] };
  });

  // 调度会话每次 pre-step 前注入还没有的任务日志条目；全新会话先收到未结束任务快照。
  const logInjector = new TaskLogInjector(service);
  ctx.on('agent/pre-step', async ({ agent, step }, next) => {
    const decision = await next();
    if (decision.kind === 'reject') return decision;
    if (step === 1 && decision.messages.length === 0) return decision;
    const sessionId = agent.session?.id;
    if (sessionId === undefined || sessionId === '') return decision;
    try {
      if (sessionId !== (await bridgeSessionId())) return decision;
      const message = await logInjector.build(sessionId, agent.session as unknown as SessionLike);
      if (message === undefined) return decision;
      const messages = decision.messages.toSpliced(insertionIndex(decision.messages), 0, message);
      return { ...decision, messages };
    } catch (error) {
      ctx.logger.warn('lark-super-agent: task log injection failed', error);
      return decision;
    }
  });

  // 用户归档被管理会话时结束其任务并通知调度会话。
  ctx.on('workspace/session-archived', (payload) => {
    const sessionId = isRecord(payload) ? payload.sessionId : undefined;
    if (typeof sessionId !== 'string' || sessionId === '') return;
    void service.notifyArchived(sessionId).catch((error: unknown) => {
      ctx.logger.warn('lark-super-agent: archive notification failed', error);
    });
  });
}
