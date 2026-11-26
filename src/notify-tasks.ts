/**
 * `lark_notify` 的任务解析：按 task_id 读取调度工作区台账，取任务名与任务会话。
 * 不依赖 lark-super-agent 行，直接读状态文件与台账。导出 ResolvedTask 与 resolveTask。
 */
import { BridgeError } from './errors.ts';
import { readBridgeState } from './lark-super-agent/bridge.ts';
import { readTaskState } from './lark-super-agent/notes.ts';
import { toHostWorkspacePath } from './workspace-path.ts';

/** 解析出的任务。 */
export interface ResolvedTask {
  readonly id: string;
  readonly title: string;
  readonly sessionId: string;
}

/**
 * 按 task_id 查找未结束任务。
 * @param taskId - 任务标识。
 * @param home - 状态目录根，缺省取 `DSH_HOME`。
 * @returns 任务标识、标题与任务会话标识。
 * @throws BridgeError `task-ledger-unavailable`（工作区或台账不可读）或 `task-not-found`。
 */
export async function resolveTask(taskId: string, home?: string): Promise<ResolvedTask> {
  const state = await readBridgeState(home);
  if (state.workspaceRoot === null) {
    throw new BridgeError('task-ledger-unavailable', '尚未配置调度工作区，无法查找任务');
  }
  const ledger = await readTaskState(toHostWorkspacePath(state.workspaceRoot));
  if (ledger.invalid === true) {
    throw new BridgeError('task-ledger-unavailable', '任务台账校验失败，无法查找任务');
  }
  const task = ledger.tasks.find((item) => item.id === taskId);
  if (task === undefined) {
    throw new BridgeError('task-not-found', `任务不存在或已结束：${taskId}`);
  }
  return { id: task.id, title: task.title, sessionId: task.sessionId };
}
