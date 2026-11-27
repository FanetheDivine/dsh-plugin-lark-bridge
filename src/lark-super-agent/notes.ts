/**
 * 任务与工作区笔记的读写、zod 校验、归档与 git 提交。
 * 校验不通过的台账按空处理，下次写入直接覆盖。
 */
import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';

import type {
  CreateTaskInput,
  EndReason,
  Task,
  TaskMessage,
  TaskStatus,
  UpdateTaskInput,
  WorkspaceNote,
} from './api.ts';
import { commitFilesInQueue, runGit, runSerial } from './git.ts';
import { createTaskId } from './ids.ts';

export const TASKS_FILE = 'message-task-status.json';
export const WORKSPACES_FILE = 'workspaces.json';

/** 任务日志目录名。 */
export const TASK_LOG_DIR = 'task-logs';

/** 任务结束后归档目录里的日志文件名。 */
export const ARCHIVED_TASK_LOG = 'task-log.jsonl';

/** 未归档任务台账；`invalid` 说明磁盘内容未通过校验，按空处理。 */
export interface TaskState {
  version: 2;
  tasks: Task[];
  invalid?: true;
}

/** 工作区笔记台账；`invalid` 含义同上。 */
export interface WorkspaceState {
  version: 1;
  workspaces: WorkspaceNote[];
  invalid?: true;
}

/** 归档任务快照。 */
export interface ArchivedTask extends Task {
  archivedAt: string;
  endReason: EndReason;
}

export interface NotesStoreOptions {
  now?: () => Date;
  taskId?: (date: Date) => string;
}

export interface WorkspaceNoteInput {
  workspaceId: string;
  summary: string;
  keywords: string[];
  notes?: string;
}

const TASK_ID_PATTERN = /^task-\d{14}-[0-9a-f]{4}$/;

/** 单行非空文本。 */
const line = z
  .string()
  .refine((value) => value.trim() !== '' && !/[\r\n]/.test(value), 'needs single-line text');

/** 带时区的 ISO 时间。 */
const time = z.string().refine((value) => Number.isFinite(Date.parse(value)), 'needs an ISO time');

/** 非空文本，允许多行；消息正文保留原文换行。 */
const body = z.string().refine((value) => value.trim() !== '', 'needs non-empty text');

const messageSchema = z.object({
  messageId: z.string().optional(),
  text: body,
  time,
});

const taskSchema = z.object({
  id: z.string().regex(TASK_ID_PATTERN),
  title: line,
  status: z.enum(['in_progress', 'waiting_user', 'failed']),
  sessionId: line,
  workspaceId: line.nullable(),
  cwd: z.string(),
  reportIds: z.array(line),
  deliveredReportIds: z.array(line).optional(),
  messages: z.array(messageSchema).min(1),
  createdAt: time,
  updatedAt: time,
});

const taskStateSchema = z.object({
  version: z.literal(2),
  tasks: z.array(taskSchema),
});

const workspaceSchema = z.object({
  workspaceId: line,
  summary: line,
  keywords: z.array(line).min(1),
  notes: z.string(),
  updatedAt: time,
});

const workspaceStateSchema = z.object({
  version: z.literal(1),
  workspaces: z.array(workspaceSchema),
});

/** JSON 先写同目录临时文件，再原子替换目标。 */
export async function atomicWriteJson(path: string, value: unknown): Promise<void> {
  await mkdir(join(path, '..'), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, `${JSON.stringify(value, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
    });
    await rename(temporary, path);
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined);
    throw error;
  }
}

function isMissing(error: unknown): boolean {
  return (
    typeof error === 'object' && error !== null && (error as { code?: string }).code === 'ENOENT'
  );
}

async function readText(path: string): Promise<string | undefined> {
  try {
    return await readFile(path, 'utf8');
  } catch (error) {
    if (isMissing(error)) return undefined;
    throw error;
  }
}

async function readJson(path: string): Promise<{ value: unknown } | { invalid: true } | undefined> {
  const source = await readText(path);
  if (source === undefined) return undefined;
  try {
    return { value: JSON.parse(source) as unknown };
  } catch {
    return { invalid: true };
  }
}

/** 去掉可选字段上的 undefined，满足 exactOptionalPropertyTypes；旧任务按已投递初始化。 */
function normalizeTask(task: z.infer<typeof taskSchema>): Task {
  return {
    ...task,
    deliveredReportIds: task.deliveredReportIds ?? [...task.reportIds],
    messages: task.messages.map((message) =>
      message.messageId === undefined
        ? { text: message.text, time: message.time }
        : { messageId: message.messageId, text: message.text, time: message.time },
    ),
  };
}

/** 读取并校验未归档任务；文件缺失、格式不符或标识重复时按空台账处理。 */
export async function readTaskState(root: string): Promise<TaskState> {
  const parsed = await readJson(join(root, TASKS_FILE));
  if (parsed === undefined) return { version: 2, tasks: [] };
  if ('invalid' in parsed) return { version: 2, tasks: [], invalid: true };
  const result = taskStateSchema.safeParse(parsed.value);
  if (!result.success) return { version: 2, tasks: [], invalid: true };
  const taskIds = new Set<string>();
  const sessionIds = new Set<string>();
  for (const task of result.data.tasks) {
    if (taskIds.has(task.id) || sessionIds.has(task.sessionId)) {
      return { version: 2, tasks: [], invalid: true };
    }
    taskIds.add(task.id);
    sessionIds.add(task.sessionId);
  }
  return { version: 2, tasks: result.data.tasks.map(normalizeTask) };
}

/** 读取并校验工作区笔记；文件缺失或格式不符时按空白名单处理。 */
export async function readWorkspaceState(root: string): Promise<WorkspaceState> {
  const parsed = await readJson(join(root, WORKSPACES_FILE));
  if (parsed === undefined) return { version: 1, workspaces: [] };
  if ('invalid' in parsed) return { version: 1, workspaces: [], invalid: true };
  const result = workspaceStateSchema.safeParse(parsed.value);
  if (!result.success) return { version: 1, workspaces: [], invalid: true };
  const ids = new Set<string>();
  for (const note of result.data.workspaces) {
    if (ids.has(note.workspaceId)) return { version: 1, workspaces: [], invalid: true };
    ids.add(note.workspaceId);
  }
  return { version: 1, workspaces: result.data.workspaces };
}

/** 生成带本机时区偏移的 ISO 8601 时间。 */
export function isoTime(date: Date): string {
  if (Number.isNaN(date.getTime())) throw new Error('timestamp needs a valid date');
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');
  const offset = -date.getTimezoneOffset();
  const sign = offset < 0 ? '-' : '+';
  const absolute = Math.abs(offset);
  const local = [
    `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`,
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`,
    `.${pad(date.getMilliseconds(), 3)}`,
  ].join('');
  return `${local}${sign}${pad(Math.floor(absolute / 60))}:${pad(absolute % 60)}`;
}

function messageOf(input: { text: string; messageId?: string }, at: string): TaskMessage {
  if (input.text.trim() === '') throw new Error('message.text must not be empty');
  return {
    ...(input.messageId === undefined ? {} : { messageId: input.messageId }),
    text: input.text,
    time: at,
  };
}

function validateLine(value: string, label: string): string {
  if (value.trim() === '' || /[\r\n]/.test(value)) {
    throw new Error(`${label} must be non-empty and single-line`);
  }
  return value.trim();
}

/** 查找会话对应的未归档任务。 */
export function findTaskBySession(tasks: readonly Task[], sessionId: string): Task | undefined {
  return tasks.find((task) => task.sessionId === sessionId);
}

async function exists(path: string): Promise<boolean> {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (isMissing(error)) return false;
    throw error;
  }
}

/** 台账未通过校验时，按任务标识查找必然落空；给出真实原因而不是「任务不存在」。 */
function assertLedgerValid(state: TaskState): void {
  if (state.invalid === true) {
    throw new Error(`${TASKS_FILE} failed validation; its tasks are unreadable until it is fixed`);
  }
}

/** 任务状态允许的转换。 */
const TRANSITIONS: Record<TaskStatus, readonly TaskStatus[]> = {
  in_progress: ['waiting_user', 'failed'],
  waiting_user: ['in_progress', 'failed'],
  failed: ['in_progress'],
};

/** 任务与工作区笔记存储。所有公开写操作都包含一次限定路径 git 提交。 */
export class NotesStore {
  readonly root: string;
  private readonly now: () => Date;
  private readonly taskId: (date: Date) => string;

  constructor(root: string, options: NotesStoreOptions = {}) {
    this.root = root;
    this.now = options.now ?? (() => new Date());
    this.taskId = options.taskId ?? ((date) => createTaskId(date));
  }

  /** 建立任务；同一会话只允许一个未结束任务。 */
  async createTask(input: CreateTaskInput): Promise<{ taskId: string }> {
    return runSerial(this.root, async () => {
      const state = await readTaskState(this.root);
      if (state.invalid === true) state.tasks = [];
      if (findTaskBySession(state.tasks, input.sessionId) !== undefined) {
        throw new Error(`session ${input.sessionId} is already managed by another task`);
      }
      const date = this.now();
      const at = isoTime(date);
      const id = this.taskId(date);
      if (!TASK_ID_PATTERN.test(id)) throw new Error(`invalid task id: ${id}`);
      const task: Task = {
        id,
        title: validateLine(input.title, 'task title'),
        status: 'in_progress',
        sessionId: validateLine(input.sessionId, 'session id'),
        workspaceId:
          input.workspaceId === null ? null : validateLine(input.workspaceId, 'workspace id'),
        cwd: input.cwd,
        reportIds: [],
        deliveredReportIds: [],
        messages: [messageOf(input.message, at)],
        createdAt: at,
        updatedAt: at,
      };
      state.tasks.push(task);
      await atomicWriteJson(join(this.root, TASKS_FILE), { version: 2, tasks: state.tasks });
      await commitFilesInQueue(this.root, [TASKS_FILE], `lark-super-agent: create ${id}`);
      return { taskId: id };
    });
  }

  /** 修改未结束任务的状态、标题与消息。 */
  async updateTask(input: UpdateTaskInput): Promise<{ taskId: string; status: TaskStatus }> {
    if (input.status === undefined && input.addMessage === undefined && input.title === undefined) {
      throw new Error('task_update needs at least one change');
    }
    return runSerial(this.root, async () => {
      const state = await readTaskState(this.root);
      assertLedgerValid(state);
      const task = state.tasks.find((item) => item.id === input.taskId);
      if (task === undefined) throw new Error(`task not found: ${input.taskId}`);
      if (
        input.status !== undefined &&
        input.status !== task.status &&
        !TRANSITIONS[task.status].includes(input.status)
      ) {
        throw new Error(`invalid task status transition: ${task.status} -> ${input.status}`);
      }
      if (input.title !== undefined) task.title = validateLine(input.title, 'task title');
      const at = isoTime(this.now());
      if (input.addMessage !== undefined) task.messages.push(messageOf(input.addMessage, at));
      if (input.status !== undefined) task.status = input.status;
      task.updatedAt = at;
      await atomicWriteJson(join(this.root, TASKS_FILE), { version: 2, tasks: state.tasks });
      await commitFilesInQueue(this.root, [TASKS_FILE], `lark-super-agent: update ${task.id}`);
      return { taskId: task.id, status: task.status };
    });
  }

  /** 把一批报告记为已投递；没有变化时不写台账。 */
  async markReportsDelivered(
    entries: readonly { taskId: string; reportIds: readonly string[] }[],
  ): Promise<{ changed: boolean }> {
    return runSerial(this.root, async () => {
      const state = await readTaskState(this.root);
      assertLedgerValid(state);
      let changed = false;
      for (const entry of entries) {
        const task = state.tasks.find((item) => item.id === entry.taskId);
        if (task === undefined) continue;
        for (const reportId of entry.reportIds) {
          if (!task.reportIds.includes(reportId)) continue;
          if (task.deliveredReportIds.includes(reportId)) continue;
          task.deliveredReportIds.push(reportId);
          changed = true;
        }
      }
      if (!changed) return { changed: false };
      await atomicWriteJson(join(this.root, TASKS_FILE), { version: 2, tasks: state.tasks });
      await commitFilesInQueue(this.root, [TASKS_FILE], 'lark-super-agent: mark reports delivered');
      return { changed: true };
    });
  }

  /** 归档任务并记录结束原因；会话本身保持未归档。 */
  async endTask(taskId: string, endReason: EndReason): Promise<{ taskId: string }> {
    return runSerial(this.root, async () => {
      const state = await readTaskState(this.root);
      assertLedgerValid(state);
      const task = state.tasks.find((item) => item.id === taskId);
      if (task === undefined) throw new Error(`task not found: ${taskId}`);
      const at = isoTime(this.now());
      const archiveDirectory = join(this.root, 'archive', task.id);
      const reportDirectory = join(this.root, 'reports', task.id);
      const archivedReports = join(archiveDirectory, 'reports');
      const hasReports = await exists(reportDirectory);
      const logFile = join(this.root, TASK_LOG_DIR, `${task.id}.jsonl`);
      const hasLog = await exists(logFile);
      await mkdir(archiveDirectory, { recursive: true });
      await atomicWriteJson(join(archiveDirectory, 'task.json'), {
        ...task,
        archivedAt: at,
        endReason,
      } satisfies ArchivedTask);
      if (hasReports) await rename(reportDirectory, archivedReports);
      if (hasLog) await rename(logFile, join(archiveDirectory, ARCHIVED_TASK_LOG));
      state.tasks = state.tasks.filter((item) => item.id !== task.id);
      await atomicWriteJson(join(this.root, TASKS_FILE), { version: 2, tasks: state.tasks });
      const paths = [TASKS_FILE, join('archive', task.id, 'task.json')];
      if (hasReports) paths.push(join('reports', task.id), join('archive', task.id, 'reports'));
      if (hasLog) {
        paths.push(join('archive', task.id, ARCHIVED_TASK_LOG));
        // 日志平时不提交；源文件只有已被 git 跟踪时才有删除可提交。
        const source = join(TASK_LOG_DIR, `${task.id}.jsonl`);
        const tracked = await runGit(
          ['ls-files', '--', `./${TASK_LOG_DIR}/${task.id}.jsonl`],
          this.root,
        )
          .then((result) => result.stdout.trim() !== '')
          .catch(() => false);
        if (tracked) paths.push(source);
      }
      await commitFilesInQueue(this.root, paths, `lark-super-agent: archive ${task.id}`);
      return { taskId: task.id };
    });
  }

  /** 归档会话已归档或已不存在的任务。 */
  async pruneTasks(
    present: ReadonlySet<string>,
    archived: ReadonlySet<string>,
  ): Promise<{ ended: number }> {
    const state = await readTaskState(this.root);
    const stale = state.tasks.filter(
      (task) => archived.has(task.sessionId) || !present.has(task.sessionId),
    );
    let ended = 0;
    for (const task of stale) {
      await this.endTask(
        task.id,
        archived.has(task.sessionId) ? 'session_archived' : 'session_missing',
      );
      ended += 1;
    }
    return { ended };
  }

  /** 建立或替换工作区笔记。 */
  async setWorkspaceNote(input: WorkspaceNoteInput): Promise<{
    workspaceId: string;
    created: boolean;
  }> {
    const workspaceId = validateLine(input.workspaceId, 'workspaceId');
    if (input.summary.trim() === '') throw new Error('workspace summary must not be empty');
    const keywords = [...new Set(input.keywords.map((keyword) => keyword.trim()))];
    if (keywords.length === 0 || keywords.some((keyword) => keyword === '')) {
      throw new Error('workspace keywords must contain at least one non-empty string');
    }
    return runSerial(this.root, async () => {
      const state = await readWorkspaceState(this.root);
      if (state.invalid === true) state.workspaces = [];
      const note: WorkspaceNote = {
        workspaceId,
        summary: validateLine(input.summary, 'workspace summary'),
        keywords,
        notes: input.notes ?? '',
        updatedAt: isoTime(this.now()),
      };
      const index = state.workspaces.findIndex((item) => item.workspaceId === workspaceId);
      const created = index < 0;
      if (created) state.workspaces.push(note);
      else state.workspaces[index] = note;
      await atomicWriteJson(join(this.root, WORKSPACES_FILE), {
        version: 1,
        workspaces: state.workspaces,
      });
      await commitFilesInQueue(
        this.root,
        [WORKSPACES_FILE],
        `lark-super-agent: note ${workspaceId}`,
      );
      return { workspaceId, created };
    });
  }

  /** 删除工作区笔记。 */
  async removeWorkspaceNote(
    workspaceId: string,
  ): Promise<{ workspaceId: string; removed: boolean }> {
    return runSerial(this.root, async () => {
      const state = await readWorkspaceState(this.root);
      const remaining = state.workspaces.filter((item) => item.workspaceId !== workspaceId);
      const removed = remaining.length !== state.workspaces.length;
      if (!removed) return { workspaceId, removed: false };
      await atomicWriteJson(join(this.root, WORKSPACES_FILE), {
        version: 1,
        workspaces: remaining,
      });
      await commitFilesInQueue(
        this.root,
        [WORKSPACES_FILE],
        `lark-super-agent: remove note ${workspaceId}`,
      );
      return { workspaceId, removed: true };
    });
  }

  /** 读取未归档任务。 */
  async listTasks(): Promise<Task[]> {
    return (await readTaskState(this.root)).tasks;
  }

  /** 读取工作区笔记。 */
  async listWorkspaces(): Promise<WorkspaceNote[]> {
    return (await readWorkspaceState(this.root)).workspaces;
  }
}
