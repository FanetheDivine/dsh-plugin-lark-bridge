/**
 * 浏览器与宿主之间的同源 JSON 路由：安全连接状态与完整检测。
 * 导出 registerRoutes 与 RouteDeps。
 */
import type { IncomingMessage, ServerResponse } from 'node:http';

import type { AuthManager, AuthSnapshot } from './auth.ts';
import { BridgeError } from './errors.ts';
import { describeError } from './utils.ts';

/** 路由前缀。 */
export const ROUTE_PREFIX = '/lark-bridge';

/** Web 服务器的最小接口。 */
export interface WebServerLike {
  getOrigin(): string;
  register(route: {
    kind: 'exact';
    path: string;
    handler: (req: IncomingMessage, res: ServerResponse) => void | Promise<void>;
  }): () => void;
}

/** 连接信任校验的最小接口。 */
export interface ConnectionLike {
  requestRejection?(request: { method?: string; headers: Record<string, unknown> }): unknown;
}

/** 路由依赖。 */
export interface RouteDeps {
  readonly webServer: WebServerLike;
  readonly connection?: ConnectionLike;
  readonly auth: AuthManager;
  readonly logger: { warn(message: string): void };
  /** 完整检测后的同步回调。 */
  readonly onAuthChanged?: (snapshot: AuthSnapshot) => void;
}

/** 统一响应体。 */
type Reply = { ok: true; data: unknown } | { ok: false; error: { code: string; message: string } };

/** 写 JSON 响应。 */
function send(res: ServerResponse, status: number, body: Reply): void {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(text),
  });
  res.end(text);
}

/** 判断请求是否来自回环地址。 */
function isLoopback(req: IncomingMessage): boolean {
  const address = req.socket.remoteAddress ?? '';
  return (
    address === '127.0.0.1' ||
    address === '::1' ||
    address.startsWith('127.') ||
    address.startsWith('::ffff:127.')
  );
}

/** 同源校验；失败返回错误说明。 */
function rejectReason(deps: RouteDeps, req: IncomingMessage): string | undefined {
  if (!isLoopback(req)) return '只允许本机请求';
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '';
  if (origin !== '' && origin !== deps.webServer.getOrigin()) return '来源不匹配';
  if (deps.connection?.requestRejection !== undefined) {
    try {
      const rejection = deps.connection.requestRejection({
        ...(req.method === undefined ? {} : { method: req.method }),
        headers: req.headers as Record<string, unknown>,
      });
      if (typeof rejection === 'number' && rejection >= 400) return `宿主拒绝请求（${rejection}）`;
      if (typeof rejection === 'string' && rejection !== '') return rejection;
    } catch (error) {
      return describeError(error);
    }
  }
  return undefined;
}

/** 投影浏览器可读的笼统状态，排除内部身份与诊断信息。 */
export function projectStatus(deps: Pick<RouteDeps, 'auth'>): Record<string, unknown> {
  const snapshot = deps.auth.current;
  return {
    cli: snapshot.cli,
    bot: snapshot.bot,
    user: snapshot.user,
    ready: snapshot.ready,
    checkedAt: snapshot.checkedAt,
  };
}

/** 执行路由动作并生成响应。 */
async function handle(deps: RouteDeps, path: string, method: string): Promise<Reply> {
  if (method === 'GET' && path === `${ROUTE_PREFIX}/status`) {
    return { ok: true, data: projectStatus(deps) };
  }
  if (method !== 'POST') throw new BridgeError('method-not-allowed', '只支持 GET 与 POST');
  if (path === `${ROUTE_PREFIX}/check`) {
    const snapshot = await deps.auth.check();
    deps.onAuthChanged?.(snapshot);
    return {
      ok: true,
      data: {
        cli: snapshot.cli,
        bot: snapshot.bot,
        user: snapshot.user,
        ready: snapshot.ready,
        checkedAt: snapshot.checkedAt,
      },
    };
  }
  throw new BridgeError('not-found', '未知的桥接接口');
}

/** 注册桥接路由并返回清理函数。 */
export function registerRoutes(deps: RouteDeps): () => void {
  const paths = ['status', 'check'];
  const disposers: Array<() => void> = [];
  for (const suffix of paths) {
    const path = `${ROUTE_PREFIX}/${suffix}`;
    disposers.push(
      deps.webServer.register({
        kind: 'exact',
        path,
        handler: async (req, res) => {
          const reason = rejectReason(deps, req);
          if (reason !== undefined) {
            send(res, 403, { ok: false, error: { code: 'forbidden', message: reason } });
            return;
          }
          try {
            const reply = await handle(deps, path, req.method ?? 'GET');
            send(res, 200, reply);
          } catch (error) {
            const code = error instanceof BridgeError ? error.code : 'internal';
            const message = describeError(error);
            if (code === 'internal')
              deps.logger.warn(`lark-bridge: route ${path} failed: ${message}`);
            send(res, code === 'internal' ? 500 : 400, {
              ok: false,
              error: { code, message },
            });
          }
        },
      }),
    );
  }
  return () => {
    for (const dispose of disposers.splice(0).reverse()) dispose();
  };
}
