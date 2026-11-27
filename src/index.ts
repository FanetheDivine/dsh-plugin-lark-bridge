/**
 * 插件入口：导出宿主约定的 name、inject、apply 与 Config。
 * 装配鉴权、事件桥、会话、通知工具与浏览器路由。
 */

import type {} from '@deepseek-ai/dsh-storage-domain';
import type { WorkspaceRegistry } from '@deepseek-ai/dsh-workspace';
import { AuthManager, type AuthSnapshot } from './auth.ts';
import { EventBridge } from './bridge.ts';
import { LarkCli } from './cli.ts';
import { type PluginConfig, readConfig, statePath } from './config.ts';
import { PLUGIN_LABEL } from './constants.ts';
import { resolveTask } from './notify-tasks.ts';
import { installReminderGuard } from './reminder.ts';
import { type ConnectionLike, registerRoutes, type WebServerLike } from './routes.ts';
import { SessionManager } from './sessions.ts';
import { StateStore } from './state.ts';
import { buildNotifyTool } from './tools.ts';
import type { Agent, Context } from './types.ts';
import { describeError } from './utils.ts';
import { WorkspaceSelection } from './workspace.ts';

export { Config } from './config.ts';

/** 插件名，与 cordis.patch.yml 的 id 一致。 */
export const name = PLUGIN_LABEL;

/** 需要宿主注入的服务。 */
export const inject = ['tools', 'agents', 'webServer', 'workspaceRegistry'];

/**
 * 插件启用时调用：读取配置、装配服务、注册工具与路由、启动鉴权检查。
 * 配置字段均为热重载引用，保存后更新配置并重新检测。
 */
export function apply(ctx: Context, config?: unknown): void {
  let current: Readonly<PluginConfig> = readConfig(config);
  ctx.logger.info(`[${PLUGIN_LABEL}] apply`);

  const store = new StateStore(statePath());
  const cli = new LarkCli();
  let lastStage = '';

  const sessions = new SessionManager({
    ctx,
    store,
    getConfig: () => current,
    logger: ctx.logger,
  });

  // 上报路径在调度会话缺失时复用桥接会话的创建流程。
  ctx.effect(
    () =>
      ctx.provide('larkBridgeSessions', {
        ensureDispatchSession: (workspaceRoot: string) =>
          sessions.ensureDispatchSession(workspaceRoot),
      }),
    `${PLUGIN_LABEL}: bridge sessions`,
  );

  const uninstallReminder = installReminderGuard({ ctx, sessions, logger: ctx.logger });
  ctx.effect(() => () => uninstallReminder(), `${PLUGIN_LABEL}: reminder guard`);

  const selection = new WorkspaceSelection({
    getWorkspaceRoot: () => current.workspaceRoot,
    getRegistry: () => ctx.get('workspaceRegistry') as WorkspaceRegistry | undefined,
  });

  let bridge!: EventBridge;
  let reconcile!: () => Promise<void>;
  const auth = new AuthManager({
    getCli: () => cli,
    logger: ctx.logger,
    onChange: (snapshot: AuthSnapshot) => {
      const state = snapshot.ready ? 'ready' : `${snapshot.cli}/${snapshot.bot}/${snapshot.user}`;
      if (state !== lastStage) {
        lastStage = state;
        ctx.logger.info(`[${PLUGIN_LABEL}] auth state: ${state}`);
      }
      if (!snapshot.ready) bridge.stop();
      void reconcile();
    },
  });

  bridge = new EventBridge({
    getCli: () => cli,
    getAuth: () => auth.current,
    getWorkspaceReady: () => selection.valid,
    store,
    sessions,
    logger: ctx.logger,
  });

  reconcile = async (): Promise<void> => {
    if (!auth.current.ready) bridge.stop();
    const result = await selection.resolve();
    if (result.current) bridge.sync(auth.current);
  };

  const isBridgeAgent = async (agent: Agent): Promise<boolean> => {
    try {
      return await sessions.isBridgeSession(agent.session);
    } catch {
      return false;
    }
  };
  const notifyTool = buildNotifyTool({
    getCli: () => cli,
    getOwner: () => auth.current.ownerOpenId,
    resolveTask: (taskId) => resolveTask(taskId),
    isBridgeAgent,
  });
  const unregisterTool = ctx.tools.register(notifyTool, {
    when: ({ agent }) => isBridgeAgent(agent),
  });
  ctx.effect(() => () => unregisterTool(), `${PLUGIN_LABEL}: notify tool`);

  let disposeRoutes: (() => void) | undefined;
  const webServer = ctx.get('webServer') as WebServerLike | undefined;
  if (webServer === undefined) {
    ctx.logger.warn(`[${PLUGIN_LABEL}] webServer is unavailable; the auth UI has no data source`);
  } else {
    const connection = ctx.get('connection') as ConnectionLike | undefined;
    disposeRoutes = registerRoutes({
      webServer,
      ...(connection === undefined ? {} : { connection }),
      auth,
      logger: ctx.logger,
    });
  }
  ctx.effect(() => () => disposeRoutes?.(), `${PLUGIN_LABEL}: routes`);

  const runCheck = (): void => {
    void auth
      .check()
      .then((snapshot) => {
        if (!snapshot.ready && snapshot.detail !== undefined) {
          ctx.logger.warn(`[${PLUGIN_LABEL}] auth check: ${snapshot.detail}`);
        }
      })
      .catch((error: unknown) => {
        ctx.logger.warn(`[${PLUGIN_LABEL}] auth check failed: ${describeError(error)}`);
      });
  };

  runCheck();

  ctx.on('domain/changed', (change) => {
    if (!selection.invalidate(change)) return;
    void reconcile();
  });

  ctx.on('loader/volatile-update', () => {
    try {
      const next = readConfig(config);
      current = next;
      selection.reset();
      void reconcile();
      ctx.logger.info(`[${PLUGIN_LABEL}] config updated`);
      runCheck();
    } catch (error) {
      ctx.logger.warn(`[${PLUGIN_LABEL}] config update ignored: ${String(error)}`);
    }
  });

  ctx.effect(() => () => bridge.stop(), `${PLUGIN_LABEL}: event bridge`);
}
