/**
 * lark-super-agent 的服务实现：任务台账、上报存档、被管理会话判定与调度会话投递。
 * 全局行装配一次，被管理会话能力与调度会话工具共用。
 */

import type { ModelSelection } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import type { Context } from '../types.ts';
import { type SteeringAgent, settleSteering } from '../steering.ts';
import { toHostWorkspacePath } from '../workspace-path.ts';
import type {
  BridgeState,
  CreateTaskInput,
  EndReason,
  LarkSuperAgentService,
  ReportOrigin,
  SendReportInput,
  SendReportResult,
  Task,
  TaskType,
  UpdateTaskInput,
  WorkspaceRegistryLike,
} from './api.ts';
import { taskSessionArchived, taskSessionFailure, taskSessionMessage } from './blocks.ts';
import { readBridgeState } from './bridge.ts';
import { findTaskBySession, NotesStore } from './notes.ts';
import { appendTaskLogEntry } from './task-log.ts';
import { workspaceRelative } from './paths.ts';
import { ReportStore } from './reports.ts';

export { readBridgeState } from './bridge.ts';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-super-agent': {
      kind: 'lark-super-agent';
    };
  }
}

interface SessionLike {
  id?: string;
  title?: string;
  cwd?: string;
  running?: boolean;
}

export interface AgentLike {
  session?: SessionLike;
  /** 会话的首条用户消息文本，用于手动管理时填充任务首条消息。 */
  firstUserText?: string;
  steer?(message: unknown): unknown;
  /** 轮次结束兜底所需；缺失时不做兜底。 */
  status?: string;
  inbox?: SteeringAgent['inbox'];
  followup?(message: never): unknown;
}

interface SessionControllerLike {
  resolveAgent(
    sessionId: string,
  ): Promise<
    | { agent: AgentLike; error?: never }
    | { error: Error; agent?: never }
    | AgentLike
    | null
    | undefined
  >;
}

interface SessionQueryLike {
  listSessions?(): Promise<readonly unknown[]>;
  readTitleSnapshots?(ids: readonly string[]): Promise<
    readonly {
      sessionId: string;
      status: string;
      value?: { title?: { title?: string } };
    }[]
  >;
}

interface AgentsLike {
  get(sessionId: string): AgentLike | undefined;
}

/** 服务所需的宿主最小上下文；实际 Context 可直接传入。 */
export interface ContextLike {
  get: Context['get'];
  logger?: {
    warn?(...args: unknown[]): void;
    info?(...args: unknown[]): void;
  };
}

export interface SuperAgentServiceOptions {
  /** 按任务类型（省略时取默认任务类型）读取任务会话模型的实时值；缺省时视为未配置。 */
  taskModel?: (taskType?: TaskType) => ModelSelection | undefined;
  /** 读取任务会话预设的实时值；缺省时视为未配置。 */
  taskPreset?: () => string;
  home?: string;
  now?: () => Date;
  taskId?: (date: Date) => string;
  reportId?: (date: Date) => string;
  /** 转换调度工作区路径时使用的平台；缺省为当前平台。 */
  platform?: NodeJS.Platform;
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null && 'message' in error) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}

/** 读取会话表层第一条用户消息的文本。 */
function firstUserText(agent: AgentLike | undefined): string | undefined {
  const session = agent?.session as
    | {
        surface?: { nodes?: Iterable<number> };
        eventAt?(seq: number): { type: string; data?: unknown } | undefined;
      }
    | undefined;
  const nodes = session?.surface?.nodes;
  if (nodes === undefined || typeof session?.eventAt !== 'function') return undefined;
  for (const seq of nodes) {
    const event = session.eventAt(seq);
    if (event?.type !== 'user/message') continue;
    const content = (event.data as { content?: unknown } | undefined)?.content;
    if (!Array.isArray(content)) return undefined;
    const text = content
      .flatMap((block) =>
        isRecord(block) && block.type === 'text' && typeof block.text === 'string'
          ? [block.text]
          : [],
      )
      .join('\n')
      .trim();
    return text === '' ? undefined : text;
  }
  return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** 会话未被管理时 send_report 的错误。 */
export const NOT_MANAGED_ERROR =
  'send_report is only available in a session managed by the dispatch session';

/** lark-super-agent 的任务、上报与失败通知服务。 */
export class SuperAgentService implements LarkSuperAgentService {
  /** 按任务类型（省略时取默认任务类型）读取任务会话模型的实时值；未配置时返回 undefined。 */
  readonly taskModel: (taskType?: TaskType) => ModelSelection | undefined;
  /** 读取任务会话预设的实时值；未配置时返回空串。 */
  readonly taskPreset: () => string;
  private readonly ctx: ContextLike;
  private readonly options: SuperAgentServiceOptions;
  /** 任务建立后的监听；由被管理会话能力设置。 */
  private managedListener: ((sessionId: string) => void) | undefined;

  constructor(ctx: ContextLike, options: SuperAgentServiceOptions = {}) {
    this.ctx = ctx;
    this.options = options;
    this.taskModel = options.taskModel ?? (() => undefined);
    this.taskPreset = options.taskPreset ?? (() => '');
  }

  /** 读取桥接状态，并把 Linux 风格的调度工作区转换为当前平台的原生路径。 */
  private async bridgeState(): Promise<BridgeState> {
    const state = await readBridgeState(this.options.home);
    if (state.workspaceRoot === null) return state;
    return {
      ...state,
      workspaceRoot: toHostWorkspacePath(state.workspaceRoot, this.options.platform),
    };
  }

  private async storageRoot(): Promise<string> {
    const state = await this.bridgeState();
    if (state.workspaceRoot === null) {
      throw new Error('lark-bridge has no workspaceRoot; configure the dispatch workspace first');
    }
    return state.workspaceRoot;
  }

  private notes(root: string): NotesStore {
    return new NotesStore(root, {
      ...(this.options.now === undefined ? {} : { now: this.options.now }),
      ...(this.options.taskId === undefined ? {} : { taskId: this.options.taskId }),
    });
  }

  /** 读取调度会话 id；读取失败时返回 null。 */
  async bridgeSessionId(): Promise<string | null> {
    try {
      return (await this.bridgeState()).sessionId;
    } catch {
      return null;
    }
  }

  /** 读取会话对应的未结束任务；会话未被管理时返回 undefined。 */
  async managedTask(sessionId: string): Promise<Task | undefined> {
    if (sessionId.trim() === '') return undefined;
    const root = await this.storageRoot();
    return findTaskBySession(await this.notes(root).listTasks(), sessionId);
  }

  /** 校验工作区可派发：已在宿主注册且已有工作区笔记。 */
  async assertDispatchable(workspaceId: string): Promise<void> {
    this.registeredWorkspace(workspaceId);
    const notes = await this.notes(await this.storageRoot()).listWorkspaces();
    if (!notes.some((note) => note.workspaceId === workspaceId)) {
      throw new Error(`workspace ${workspaceId} has no note in workspaces.json`);
    }
  }

  /** 为一个已有会话建立任务；已管理或不存在时返回错误。 */
  async manageSession(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ sessionId: string; taskId: string; title: string }> {
    const id = sessionId.trim();
    if (id === '') throw new Error('session_manage needs a session id');
    const state = await this.bridgeState();
    if (state.sessionId !== null && id === state.sessionId) {
      throw new Error('the dispatch session cannot be managed');
    }
    if ((await this.managedTask(id)) !== undefined) {
      throw new Error(`session ${id} is already managed`);
    }
    const controller = this.ctx.get('sessionController') as SessionControllerLike | undefined;
    if (controller === undefined || typeof controller.resolveAgent !== 'function') {
      throw new Error('sessionController is unavailable; cannot read the session');
    }
    const resolved = await controller.resolveAgent(id);
    signal?.throwIfAborted();
    if (resolved === null || resolved === undefined) {
      throw new Error(`session ${id} does not exist`);
    }
    if ('error' in resolved && resolved.error !== undefined) throw resolved.error;
    const agent = 'agent' in resolved ? resolved.agent : resolved;
    const title = agent?.session?.title?.replace(/\s*[\r\n]+\s*/g, ' ').trim() || id;
    const cwd = agent?.session?.cwd ?? process.cwd();
    const first = firstUserText(agent);
    const { taskId } = await this.createTask({
      title,
      sessionId: id,
      workspaceId: this.workspaceOf(cwd),
      cwd,
      message: { text: first ?? title },
    });
    return { sessionId: id, taskId, title };
  }

  /** 按工作目录匹配已注册工作区；没有匹配时返回 null。 */
  private workspaceOf(cwd: string): string | null {
    const registry = this.ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined;
    const list = registry?.list ?? registry?.workspaces ?? registry?.entries;
    if (registry === undefined || list === undefined) return null;
    const target = cwd.replaceAll('\\', '/').toLowerCase();
    for (const workspace of list.call(registry)) {
      if (typeof workspace.path !== 'string') continue;
      const path = workspace.path.replaceAll('\\', '/').toLowerCase();
      if (path === target && typeof workspace.id === 'string') return workspace.id;
    }
    return null;
  }

  async createTask(input: CreateTaskInput): Promise<{ taskId: string }> {
    const result = await this.notes(await this.storageRoot()).createTask(input);
    this.managedListener?.(input.sessionId);
    return result;
  }

  /** 任务建立后通知监听者；由被管理会话能力在加载时设置。 */
  setManagedSessionListener(listener: (sessionId: string) => void): void {
    this.managedListener = listener;
  }

  async updateTask(input: UpdateTaskInput): Promise<{ taskId: string; status: Task['status'] }> {
    return this.notes(await this.storageRoot()).updateTask(input);
  }

  async endTask(taskId: string, endReason: EndReason): Promise<{ taskId: string }> {
    return this.notes(await this.storageRoot()).endTask(taskId, endReason);
  }

  /** 结束会话已归档或不存在的任务。 */
  async pruneTasks(): Promise<{ ended: number }> {
    const root = await this.storageRoot();
    const tasks = await this.notes(root).listTasks();
    if (tasks.length === 0) return { ended: 0 };
    const registry = this.ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined;
    const archived = new Set<string>(registry?.archivedSessionIds ?? []);
    const query = this.ctx.get('sessionQuery') as SessionQueryLike | undefined;
    if (typeof query?.listSessions !== 'function') return { ended: 0 };
    const present = new Set<string>();
    try {
      const records = await query.listSessions();
      for (const record of records) {
        if (!isRecord(record)) continue;
        if (record.live === false && record.persisted === false) continue;
        const header = isRecord(record.header) ? record.header : record;
        if (typeof header.id === 'string') present.add(header.id);
      }
    } catch {
      return { ended: 0 };
    }
    return this.notes(root).pruneTasks(present, archived);
  }

  /** 校验工作区在宿主注册表中存在。 */
  registeredWorkspace(workspaceId: string): { id: unknown; path: string } {
    const registry = this.ctx.get('workspaceRegistry') as WorkspaceRegistryLike | undefined;
    if (registry === undefined) throw new Error('workspaceRegistry is unavailable');
    const list = registry.list ?? registry.workspaces ?? registry.entries;
    if (list === undefined) throw new Error('workspaceRegistry cannot list workspaces');
    for (const workspace of list.call(registry)) {
      if (workspace.id === workspaceId) {
        if (typeof workspace.path !== 'string' || workspace.path.trim() === '') {
          throw new Error(`registered workspace ${workspaceId} has no valid path`);
        }
        return workspace;
      }
    }
    throw new Error(`workspace ${workspaceId} is not registered in DSH`);
  }

  async setWorkspaceNote(input: {
    workspaceId: string;
    summary: string;
    keywords: string[];
    notes?: string;
  }): Promise<{ workspaceId: string; created: boolean }> {
    this.registeredWorkspace(input.workspaceId);
    return this.notes(await this.storageRoot()).setWorkspaceNote(input);
  }

  async removeWorkspaceNote(workspaceId: string) {
    return this.notes(await this.storageRoot()).removeWorkspaceNote(workspaceId);
  }

  private async resolveDispatchAgent(state: BridgeState): Promise<AgentLike> {
    if (state.sessionId === null) throw new Error('lark-bridge has no dispatch sessionId');
    const controller = this.ctx.get('sessionController') as SessionControllerLike | undefined;
    if (controller === undefined || typeof controller.resolveAgent !== 'function') {
      throw new Error('sessionController is unavailable; cannot reach the dispatch session');
    }
    const resolved = await controller.resolveAgent(state.sessionId);
    if (resolved === null || resolved === undefined) {
      throw new Error(`dispatch session is unavailable: ${state.sessionId}`);
    }
    if ('error' in resolved && resolved.error !== undefined) throw resolved.error;
    const agent = 'agent' in resolved ? resolved.agent : resolved;
    if (agent === undefined || typeof agent.steer !== 'function') {
      throw new Error(`dispatch agent cannot accept messages: ${state.sessionId}`);
    }
    return agent;
  }

  private async deliver(agent: AgentLike, block: string): Promise<void> {
    const message = createUserMessage({
      content: [{ type: 'text', text: block }],
      source: { kind: 'lark-super-agent' },
    });
    await agent.steer?.(message);
    if (agent.status === undefined || agent.inbox === undefined || agent.followup === undefined) {
      return;
    }
    await settleSteering(agent as SteeringAgent, message, {
      warn: (text) => this.ctx.logger?.warn?.(`lark-super-agent: ${text}`),
    });
  }

  /** 存档并投递一份上报；调用方必须已被管理。 */
  async sendReport(
    input: SendReportInput,
    callerSessionId: string,
    origin: ReportOrigin = 'send_report',
  ): Promise<SendReportResult> {
    const task = await this.managedTask(callerSessionId);
    if (task === undefined) throw new Error(NOT_MANAGED_ERROR);
    const caller = this.agent(callerSessionId);
    const cwd = caller?.session?.cwd ?? process.cwd();
    const state = await this.bridgeState();
    if (state.workspaceRoot === null) {
      throw new Error('lark-bridge has no workspaceRoot; report was not archived');
    }
    const agent = await this.resolveDispatchAgent(state);
    const reports = new ReportStore(state.workspaceRoot, {
      cwd,
      ...(this.options.now === undefined ? {} : { now: this.options.now }),
      ...(this.options.reportId === undefined ? {} : { reportId: this.options.reportId }),
    });
    const archived = await reports.archiveReport(
      input,
      callerSessionId,
      task.id,
      origin,
      (report) =>
        this.deliver(
          agent,
          taskSessionMessage({
            sessionId: callerSessionId,
            reportId: report.reportId,
            taskId: report.taskId,
            kind: input.kind,
            origin,
            reportPath: workspaceRelative(state.workspaceRoot as string, report.reportPath),
            attachmentPaths: report.files.map((file) =>
              workspaceRelative(state.workspaceRoot as string, file),
            ),
          }),
        ),
    );
    return {
      reportId: archived.reportId,
      taskId: archived.taskId,
      delivered: true,
      ...(archived.warning === undefined ? {} : { warning: archived.warning }),
    };
  }

  /** 为被管理会话追加一条任务日志；会话未被管理或任务已结束时丢弃。 */
  async appendTaskLog(
    sessionId: string,
    input: { seq: number; type: 'user_message' | 'user_stop'; text: string },
  ): Promise<'written' | 'duplicate' | 'dropped'> {
    const root = await this.storageRoot();
    const task = findTaskBySession(await this.notes(root).listTasks(), sessionId);
    if (task === undefined) return 'dropped';
    return appendTaskLogEntry(root, task.id, {
      sessionId,
      ...input,
      ...(this.options.now === undefined ? {} : { now: this.options.now }),
    });
  }

  /** 读取调度工作区根与未结束任务，供任务日志注入。 */
  async taskLogContext(): Promise<{ root: string; tasks: Task[] }> {
    const root = await this.storageRoot();
    return { root, tasks: await this.notes(root).listTasks() };
  }

  /** 为被管理会话投递轮次失败通知；未被管理的会话不通知。 */
  async notifyFailure(sessionId: string, error: unknown): Promise<void> {
    try {
      const task = await this.managedTask(sessionId);
      if (task === undefined) return;
      const state = await this.bridgeState();
      const agent = await this.resolveDispatchAgent(state);
      await this.deliver(
        agent,
        taskSessionFailure({ sessionId, taskId: task.id, error: errorMessage(error) }),
      );
    } catch (notificationError) {
      this.ctx.logger?.warn?.(
        `lark-super-agent: failure notification was not delivered: ${errorMessage(notificationError)}`,
        { sessionId },
      );
    }
  }

  /** 通知调度会话某个被管理会话已被归档。 */
  async notifyArchived(sessionId: string): Promise<void> {
    try {
      const state = await this.bridgeState();
      if (state.workspaceRoot === null) return;
      const tasks = await this.notes(state.workspaceRoot).listTasks();
      const task = findTaskBySession(tasks, sessionId);
      if (task === undefined) return;
      const agent = await this.resolveDispatchAgent(state);
      await this.notes(state.workspaceRoot).endTask(task.id, 'session_archived');
      await this.deliver(agent, taskSessionArchived({ sessionId, taskId: task.id }));
    } catch (notificationError) {
      this.ctx.logger?.warn?.(
        `lark-super-agent: archive notification was not delivered: ${errorMessage(notificationError)}`,
        { sessionId },
      );
    }
  }

  /** 读取已挂载的 agent。 */
  agent(sessionId: string): AgentLike | undefined {
    const agents = this.ctx.get('agents') as AgentsLike | undefined;
    return agents?.get(sessionId);
  }
}
