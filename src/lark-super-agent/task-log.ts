/**
 * 任务日志：调度工作区 `task-logs/<taskId>.jsonl` 的追加与读取。
 * 记录调度会话看不到的用户直接交互；任务结束时由 `NotesStore.endTask` 迁入归档。
 * 导出 TaskLogEntry、追加与读取函数。
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { runSerial } from './git.ts';
import { ARCHIVED_TASK_LOG, isoTime, readTaskState, TASK_LOG_DIR } from './notes.ts';

export { ARCHIVED_TASK_LOG, TASK_LOG_DIR };

/** 用户原文的最大字符数；超过时截断并标记。 */
export const TASK_LOG_TEXT_LIMIT = 2000;

/** 日志事件类型：用户直接发消息、用户主动停止轮次。 */
export type TaskLogType = 'user_message' | 'user_stop';

/** 一条日志。 */
export interface TaskLogEntry {
  /** `<任务会话 id>:<事件 seq>`，同一事件重复观察得到同一 id。 */
  readonly id: string;
  /** 带本机时区偏移的 ISO 时间。 */
  readonly time: string;
  readonly taskId: string;
  readonly sessionId: string;
  readonly type: TaskLogType;
  /** 用户原文；`user_stop` 为空串。 */
  readonly text: string;
  /** 原文被截断时为 true。 */
  readonly truncated?: true;
}

/** 追加结果：写入、同 id 已存在、任务已结束或台账不可读而丢弃。 */
export type AppendResult = 'written' | 'duplicate' | 'dropped';

/** 返回任务日志的绝对路径。 */
export function taskLogPath(root: string, taskId: string): string {
  return join(root, TASK_LOG_DIR, `${taskId}.jsonl`);
}

/** 解析日志文本，跳过无法解析的行。 */
function parseLines(source: string): TaskLogEntry[] {
  const entries: TaskLogEntry[] = [];
  for (const line of source.split('\n')) {
    if (line.trim() === '') continue;
    try {
      const value = JSON.parse(line) as Partial<TaskLogEntry>;
      if (
        typeof value.id === 'string' &&
        typeof value.time === 'string' &&
        typeof value.taskId === 'string' &&
        typeof value.sessionId === 'string' &&
        (value.type === 'user_message' || value.type === 'user_stop') &&
        typeof value.text === 'string'
      ) {
        entries.push(value as TaskLogEntry);
      }
    } catch {
      // 损坏的行读取时跳过。
    }
  }
  return entries;
}

/**
 * 读取任务日志。
 * @param root - 调度工作区根。
 * @param taskId - 任务标识。
 * @returns 按写入顺序排列的条目；文件缺失时为空数组。
 */
export async function readTaskLog(root: string, taskId: string): Promise<TaskLogEntry[]> {
  try {
    return parseLines(await readFile(taskLogPath(root, taskId), 'utf8'));
  } catch (error) {
    if ((error as { code?: string }).code === 'ENOENT') return [];
    throw error;
  }
}

/** 一次追加的输入。 */
export interface AppendInput {
  readonly sessionId: string;
  readonly seq: number;
  readonly type: TaskLogType;
  readonly text: string;
  readonly now?: () => Date;
}

/**
 * 在工作区串行队列内追加一条日志。
 * 写入前重新读取台账确认任务仍未结束；同 id 已存在时跳过；不做 git 提交。
 * @param root - 调度工作区根。
 * @param taskId - 任务标识。
 * @param input - 事件信息。
 * @returns 写入结果。
 */
export function appendTaskLogEntry(
  root: string,
  taskId: string,
  input: AppendInput,
): Promise<AppendResult> {
  return runSerial(root, async () => {
    const state = await readTaskState(root);
    if (state.invalid === true || !state.tasks.some((task) => task.id === taskId)) {
      return 'dropped';
    }
    const id = `${input.sessionId}:${input.seq}`;
    const existing = await readTaskLog(root, taskId);
    if (existing.some((entry) => entry.id === id)) return 'duplicate';
    const truncated = input.text.length > TASK_LOG_TEXT_LIMIT;
    const entry: TaskLogEntry = {
      id,
      time: isoTime((input.now ?? (() => new Date()))()),
      taskId,
      sessionId: input.sessionId,
      type: input.type,
      text: truncated ? input.text.slice(0, TASK_LOG_TEXT_LIMIT) : input.text,
      ...(truncated ? { truncated: true as const } : {}),
    };
    const path = taskLogPath(root, taskId);
    await mkdir(dirname(path), { recursive: true });
    await appendFile(path, `${JSON.stringify(entry)}\n`, 'utf8');
    return 'written';
  });
}
