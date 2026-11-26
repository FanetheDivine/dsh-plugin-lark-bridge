/**
 * 插话收尾：驱动已判定轮次结束时，steer 的消息可能留在 next-step 无人唤醒，此时改为 followup。
 * 导出 SteeringAgent 与 settleSteering。
 */

/** 收尾所需的最小 agent 结构。 */
export interface SteeringAgent {
  readonly status: string;
  readonly inbox: {
    readonly nextStep: readonly { readonly id: string }[];
    remove(id: string): unknown;
  };
  followup(message: never): unknown;
}

/** 日志接口。 */
export interface SteeringLogger {
  warn(message: string): void;
}

/**
 * 收尾一次运行中投递：会话已空闲且消息仍在待处理队列时，移除后改为 followup。
 * @param agent - 接收消息的会话 agent。
 * @param message - 刚用 steer 投递的消息。
 * @param logger - 记录改投的日志。
 */
export async function settleSteering<M extends { readonly id: string }>(
  agent: SteeringAgent,
  message: M,
  logger: SteeringLogger,
): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  if (agent.status !== 'idle') return;
  if (!agent.inbox.nextStep.some((pending) => pending.id === message.id)) return;
  agent.inbox.remove(message.id);
  logger.warn(`steering landed after the turn ended; delivering ${message.id} as a followup`);
  agent.followup(message as never);
}
