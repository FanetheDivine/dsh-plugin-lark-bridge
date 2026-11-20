/**
 * 桥接会话：工作区校验、创建或恢复、标题、挂载、置顶与状态持久化。
 * 导出 SessionManager。
 */
import { randomUUID } from 'node:crypto';
import { stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import type { Context } from '@deepseek-ai/cordis';
import type { Agent, AgentOptions } from '@deepseek-ai/dsh-agent';
import { createUserMessage } from '@deepseek-ai/dsh-llm';
import { SessionId } from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-session-title';
import type { Workspace, WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';

import type { PluginConfig } from './config.ts';
import { SESSION_TITLE } from './constants.ts';
import { BridgeError } from './errors.ts';
import type { StateStore } from './state.ts';
import { describeError, reminder } from './utils.ts';
import {
  normalizeWorkspacePath,
  sameWorkspacePath,
  toHostWorkspacePath,
} from './workspace-path.ts';

declare module '@deepseek-ai/dsh-llm' {
  interface MessageSourceMap {
    'lark-bridge': { kind: 'lark-bridge' };
  }
}

/** 飞书来源的消息标记。 */
const SOURCE = { kind: 'lark-bridge' } as const;

/** 一次注入的结果。 */
export interface InjectionResult {
  readonly sessionId: string;
  readonly created: boolean;
}

/** 默认模型选择服务的最小接口。 */
interface DefaultModel {
  currentSelection(): {
    provider: string;
    model: string;
    reasoningEffort?: AgentOptions['reasoningEffort'];
  };
}

/** 会话恢复服务的最小接口。 */
interface SessionController {
  resolveAgent(id: SessionId): Promise<{ readonly agent: Agent } | { readonly error: unknown }>;
}

/** 日志接口。 */
export interface SessionLogger {
  info(message: string): void;
  warn(message: string): void;
}

/** SessionManager 的依赖。 */
export interface SessionDeps {
  readonly ctx: Context;
  readonly store: StateStore;
  readonly getConfig: () => Readonly<PluginConfig>;
  readonly logger: SessionLogger;
}

/** 把路径解析为绝对路径。 */
function absolute(path: string): string {
  return resolve(path);
}

/** 校验工作区目录。 */
async function assertWorkspace(path: string): Promise<string> {
  const target = absolute(path);
  try {
    const info = await stat(target);
    if (!info.isDirectory())
      throw new BridgeError('workspace-invalid', `工作区不是目录：${target}`);
  } catch (error) {
    if (error instanceof BridgeError) throw error;
    throw new BridgeError('workspace-invalid', `工作区不存在或不可访问：${target}`);
  }
  return target;
}

/** 主题事件的载荷。 */
interface TitleData {
  readonly title: string;
  readonly messageSeqs: readonly number[];
  readonly source: { readonly kind: 'user' };
}

/** 追加标题事件；兼容单事件与批量两种 `Session.append` 调用形态。 */
function appendTitle(session: { append: (...args: never[]) => unknown }, title: string): void {
  const data: TitleData = { title, messageSeqs: [], source: { kind: 'user' } };
  const append = session.append as unknown as (type: string, value: TitleData) => unknown;
  append.call(session, 'session/title', data);
}

/** 构造用于注入的 system-reminder 用户消息。 */
function reminderMessage(text: string) {
  return createUserMessage({
    content: [{ type: 'text', text: reminder(text) }],
    source: SOURCE,
  });
}

/** 桥接会话的创建、恢复与注入。 */
export class SessionManager {
  private readonly deps: SessionDeps;
  private failure: string | undefined;

  constructor(deps: SessionDeps) {
    this.deps = deps;
  }

  private get ctx(): Context {
    return this.deps.ctx;
  }

  /** 最近一次注入失败的原因，供状态接口与配置页诊断。 */
  get lastError(): string | undefined {
    return this.failure;
  }

  /** 记录一次失败。 */
  private fail(error: unknown): never {
    this.failure = describeError(error);
    throw error;
  }

  /** 读取工作区注册表。 */
  private registry(): WorkspaceRegistry {
    const registry = this.ctx.get('workspaceRegistry') as WorkspaceRegistry | undefined;
    if (registry === undefined)
      throw new BridgeError('workspace-unavailable', '宿主未提供工作区服务');
    return registry;
  }

  /** 默认模型选择；宿主未提供时返回空对象。 */
  private agentOptions(): AgentOptions {
    const defaults = this.ctx.get('agentDefaultModel') as DefaultModel | undefined;
    if (defaults === undefined) return {};
    return {
      get provider() {
        return defaults.currentSelection().provider;
      },
      get model() {
        return defaults.currentSelection().model;
      },
      get reasoningEffort() {
        return defaults.currentSelection().reasoningEffort;
      },
    };
  }

  /** 把会话挂到已注册工作区。 */
  private async attach(sessionId: string, workspace: Workspace): Promise<void> {
    const id = SessionId(sessionId);
    if (!workspace.sessionIds.includes(id)) await workspace.attachSession(id);
  }

  /** 恢复一个可用会话；失败返回 undefined。 */
  private async resume(sessionId: string): Promise<Agent | undefined> {
    const id = SessionId(sessionId);
    if (this.registry().archivedSessionIds.includes(id)) return undefined;
    const live = this.ctx.agents.get(id);
    if (live !== undefined) return live;
    try {
      const controller = this.ctx.get('sessionController') as SessionController | undefined;
      if (controller !== undefined) {
        const found = await controller.resolveAgent(id);
        return 'error' in found ? undefined : found.agent;
      }
      const handle = await this.ctx.agents.resume({ resumeSessionId: id });
      return handle.agent;
    } catch (error) {
      this.deps.logger.warn(
        `lark-bridge: cannot resume session ${sessionId}: ${describeError(error)}`,
      );
      return undefined;
    }
  }

  /** 新建会话，设置标题、挂到工作区并置顶。 */
  private async create(
    cwd: string,
    title: string,
    workspace: Workspace,
  ): Promise<{ sessionId: string; agent: Agent }> {
    const sessionId = randomUUID();
    const handle = await this.ctx.agents.create({
      sessionId: SessionId(sessionId),
      agentOptions: this.agentOptions(),
      meta: { cwd },
      setup: async (_childCtx, child) => {
        appendTitle(child.session, title);
      },
    });
    await this.attach(sessionId, workspace);
    await this.registry().pinSession(SessionId(sessionId));
    await this.deps.store.patch({
      sessionId,
      workspaceRoot: normalizeWorkspacePath(cwd),
      title,
    });
    this.deps.logger.info(`lark-bridge: created session ${sessionId} in ${cwd}`);
    return { sessionId, agent: handle.agent };
  }

  /** 确保标题与置顶状态符合配置。 */
  private async syncMeta(
    sessionId: string,
    agent: Agent,
    title: string,
    createdTitle: string,
  ): Promise<void> {
    if (createdTitle !== title) {
      appendTitle(agent.session, title);
      await this.deps.store.patch({ title });
    }
    try {
      await this.registry().pinSession(SessionId(sessionId));
    } catch (error) {
      this.deps.logger.warn(
        `lark-bridge: cannot pin session ${sessionId}: ${describeError(error)}`,
      );
    }
  }

  /**
   * 取得当前工作区对应的会话；没有记录或不可用时新建。
   * @param workspaceRoot - 配置的工作区路径。
   * @returns 会话标识、会话实例与是否新建。
   */
  async ensure(
    workspaceRoot: string,
  ): Promise<{ sessionId: string; agent: Agent; created: boolean; cwd: string }> {
    const cwd = toHostWorkspacePath(workspaceRoot);
    await assertWorkspace(cwd);
    const workspace = await this.registry().resolveByPath(cwd);
    if (workspace === undefined) {
      throw new BridgeError(
        'workspace-unregistered',
        `工作区未注册：${normalizeWorkspacePath(cwd)}`,
      );
    }
    const state = await this.deps.store.load();
    if (
      state.sessionId !== null &&
      state.workspaceRoot !== null &&
      sameWorkspacePath(state.workspaceRoot, cwd)
    ) {
      const agent = await this.resume(state.sessionId);
      if (agent !== undefined) {
        await this.syncMeta(state.sessionId, agent, SESSION_TITLE, state.title ?? SESSION_TITLE);
        return { sessionId: state.sessionId, agent, created: false, cwd };
      }
    }
    const created = await this.create(cwd, SESSION_TITLE, workspace);
    return { ...created, created: true, cwd };
  }

  /**
   * 把一段飞书文本注入桥接会话。
   * @param text - 已格式化的提醒正文。
   * @returns 注入目标与会话是否新建。
   */
  async inject(text: string): Promise<InjectionResult> {
    try {
      const config = this.deps.getConfig();
      if (config.workspaceRoot === '') {
        throw new BridgeError('workspace-missing', '尚未配置桥接工作区');
      }
      const { sessionId, agent, created, cwd } = await this.ensure(config.workspaceRoot);
      const workspace = await this.registry().resolveByPath(cwd);
      if (workspace === undefined) {
        throw new BridgeError(
          'workspace-unregistered',
          `工作区未注册：${normalizeWorkspacePath(cwd)}`,
        );
      }
      agent.followup(reminderMessage(text));
      this.failure = undefined;
      return { sessionId, created };
    } catch (error) {
      this.fail(error);
    }
  }
}
