/**
 * 插件入口：导出宿主约定的 name、inject、apply 与 Config。
 * 装配鉴权、事件桥、会话、通知工具与浏览器路由。
 */
import { AuthManager, type AuthSnapshot } from './auth.ts';
import { EventBridge } from './bridge.ts';
import { LarkCli } from './cli.ts';
import { type PluginConfig, readConfig, statePath } from './config.ts';
import { PLUGIN_LABEL } from './constants.ts';
import { type ConnectionLike, registerRoutes, type WebServerLike } from './routes.ts';
import { SessionManager } from './sessions.ts';
import { StateStore } from './state.ts';
import { buildNotifyTool } from './tools.ts';
import type { Context } from './types.ts';
import { describeError } from './utils.ts';

export { Config } from './config.ts';

/** 插件名，与 cordis.patch.yml 的 id 一致。 */
export const name = PLUGIN_LABEL;

/** 需要宿主注入的服务。 */
export const inject = ['tools', 'agents', 'webServer'];

/**
 * 插件启用时调用：读取配置、装配服务、注册工具与路由、启动鉴权检查。
 * 配置字段均为热重载引用，保存后按新值重建 CLI 适配并重新检测。
 */
export function apply(ctx: Context, config?: unknown): void {
  let current: Readonly<PluginConfig> = readConfig(config);
  ctx.logger.info(`[${PLUGIN_LABEL}] apply`);

  const store = new StateStore(statePath());
  let cli = new LarkCli(current.larkCli);
  let lastStage = '';

  const sessions = new SessionManager({
    ctx,
    store,
    getConfig: () => current,
    logger: ctx.logger,
  });

  let bridge!: EventBridge;
  const auth = new AuthManager({
    getCli: () => cli,
    logger: ctx.logger,
    onChange: (snapshot: AuthSnapshot) => {
      const stage = snapshot.ready ? 'ready' : snapshot.stage;
      if (stage !== lastStage) {
        lastStage = stage;
        ctx.logger.info(`[${PLUGIN_LABEL}] auth stage: ${stage}`);
      }
      bridge.sync(snapshot);
    },
  });

  bridge = new EventBridge({
    getCli: () => cli,
    getAuth: () => auth.current,
    store,
    sessions,
    logger: ctx.logger,
  });

  const notifyTool = buildNotifyTool({
    getCli: () => cli,
    getOwner: () => auth.current.ownerOpenId,
  });
  const unregisterTool = ctx.tools.register(notifyTool);
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
      sessions,
      store,
      getConfig: () => current,
      logger: ctx.logger,
      onAuthChanged: (snapshot) => bridge.sync(snapshot),
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

  if (current.authCheckOnStartup) runCheck();

  ctx.on('loader/volatile-update', () => {
    try {
      const next = readConfig(config);
      const cliChanged = next.larkCli !== current.larkCli;
      current = next;
      if (cliChanged) cli = new LarkCli(next.larkCli);
      ctx.logger.info(`[${PLUGIN_LABEL}] config updated`);
      runCheck();
    } catch (error) {
      ctx.logger.warn(`[${PLUGIN_LABEL}] config update ignored: ${String(error)}`);
    }
  });

  ctx.effect(() => () => bridge.stop(), `${PLUGIN_LABEL}: event bridge`);
  ctx.effect(() => () => auth.cancelLogin(), `${PLUGIN_LABEL}: login`);
}
