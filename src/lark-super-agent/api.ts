/**
 * lark-super-agent 的共享数据与服务接口。全局行实现服务，调度会话子行只依赖这些类型。
 */

import type { ModelSelection } from '@deepseek-ai/dsh-agent';

/** 任务类型：普通任务与复杂任务。 */
export const TASK_TYPES = ['common', 'complex'] as const;

/** 任务类型。 */
export type TaskType = (typeof TASK_TYPES)[number];

/** 未结束任务的状态。 */
export type TaskStatus = 'in_progress' | 'waiting_user' | 'failed';

/** 任务归档的原因。 */
export type EndReason =
  | 'completed'
  | 'cancelled'
  | 'unmanaged'
  | 'session_archived'
  | 'session_missing';

/** 任务关联的一条用户消息。 */
export interface TaskMessage {
  readonly messageId?: string;
  readonly text: string;
  readonly time: string;
}

/** 一条未归档任务；一个任务对应一个被管理会话。 */
export interface Task {
  readonly id: string;
  title: string;
  status: TaskStatus;
  /** 对应的被管理会话。 */
  readonly sessionId: string;
  /** 会话所在工作区；手动管理且无工作区时为 null。 */
  workspaceId: string | null;
  /** 会话工作目录。 */
  cwd: string;
  reportIds: string[];
  messages: TaskMessage[];
  readonly createdAt: string;
  updatedAt: string;
}

/** 一个可派发工作区的笔记。 */
export interface WorkspaceNote {
  readonly workspaceId: string;
  summary: string;
  keywords: string[];
  notes: string;
  updatedAt: string;
}

/** 新建任务的参数。 */
export interface CreateTaskInput {
  title: string;
  sessionId: string;
  workspaceId: string | null;
  cwd: string;
  message: { text: string; messageId?: string };
}

/** 修改任务的参数。 */
export interface UpdateTaskInput {
  taskId: string;
  status?: TaskStatus;
  title?: string;
  addMessage?: { text: string; messageId?: string };
}

/** 上报类型：进度与提问。上报不结束任务。 */
export const REPORT_KINDS = ['progress', 'question'] as const;

/** 上报类型。 */
export type ReportKind = (typeof REPORT_KINDS)[number];

/** 上报来源：会话主动上报、轮次结束自动上报或提问拦截代为上报。 */
export type ReportOrigin = 'send_report' | 'turn_end' | 'ask_intercept';

/** 上报参数。 */
export interface SendReportInput {
  kind: ReportKind;
  text?: string;
  files?: string[];
  desc?: string;
}

/** 上报结果。 */
export interface SendReportResult {
  reportId: string;
  taskId: string;
  delivered: true;
  warning?: string;
}

/** lark-bridge 的桥接状态。 */
export interface BridgeState {
  sessionId: string | null;
  workspaceRoot: string | null;
}

/** 笔记与上报服务。 */
export interface LarkSuperAgentService {
  /** 按任务类型（省略时取默认任务类型）读取新建任务会话时使用的模型；未配置时返回 undefined。 */
  readonly taskModel: (taskType?: TaskType) => ModelSelection | undefined;
  /** 读取新建任务会话时使用的预设；未配置时返回空串。 */
  readonly taskPreset: () => string;
  /** 读取调度会话 id；读取失败时返回 null。 */
  bridgeSessionId(): Promise<string | null>;
  /** 读取会话对应的未结束任务；会话未被管理时返回 undefined。 */
  managedTask(sessionId: string): Promise<Task | undefined>;
  createTask(input: CreateTaskInput): Promise<{ taskId: string }>;
  /** 任务建立后通知监听者；用于结束该会话等待中的提问。 */
  setManagedSessionListener(listener: (sessionId: string) => void): void;
  /** 校验工作区可派发：已在宿主注册且已有工作区笔记。 */
  assertDispatchable(workspaceId: string): Promise<void>;
  /** 为一个已有会话建立任务，使其成为被管理会话。 */
  manageSession(
    sessionId: string,
    signal?: AbortSignal,
  ): Promise<{ sessionId: string; taskId: string; title: string }>;
  updateTask(input: UpdateTaskInput): Promise<{ taskId: string; status: TaskStatus }>;
  /** 归档任务并记录结束原因。 */
  endTask(taskId: string, endReason: EndReason): Promise<{ taskId: string }>;
  /** 结束会话已归档或不存在的任务。 */
  pruneTasks(): Promise<{ ended: number }>;
  setWorkspaceNote(input: {
    workspaceId: string;
    summary: string;
    keywords: string[];
    notes?: string;
  }): Promise<{ workspaceId: string; created: boolean }>;
  removeWorkspaceNote(workspaceId: string): Promise<{ workspaceId: string; removed: boolean }>;
  /** 存档并投递一份上报；调用方必须已被管理。 */
  sendReport(
    input: SendReportInput,
    callerSessionId: string,
    origin?: ReportOrigin,
  ): Promise<SendReportResult>;
  /** 为被管理会话投递轮次失败通知。 */
  notifyFailure(sessionId: string, error: unknown): Promise<void>;
  /** 通知调度会话某个被管理会话已被归档。 */
  notifyArchived(sessionId: string): Promise<void>;
}

/** 调用工具时的最小 Agent 结构。 */
export interface AgentExecution {
  agent?: { session?: { id?: string } };
}

/** 宿主工作区注册表的最小结构。 */
export interface WorkspaceRegistryLike {
  list?(): Iterable<{ id: unknown; path: string }>;
  workspaces?(): Iterable<{ id: unknown; path: string }>;
  entries?(): Iterable<{ id: unknown; path: string }>;
  archivedSessionIds?: readonly string[];
  archiveSession?(id: string, options?: { stopActivity?: boolean }): Promise<unknown> | unknown;
  unarchiveSession?(id: string): Promise<unknown> | unknown;
}
