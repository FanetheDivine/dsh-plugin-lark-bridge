// JSON 路由测试：安全状态投影、来源校验与检测动作。
import { describe, expect, it, vi } from 'vitest';

import type { AuthSnapshot } from '../src/auth.ts';
import { type RouteDeps, registerRoutes } from '../src/routes.ts';

/** 包含内部诊断与身份元数据的就绪快照。 */
const SNAPSHOT: AuthSnapshot = {
  cli: 'connected',
  bot: 'connected',
  user: 'connected',
  ready: true,
  appId: 'cli_x',
  userName: '袁',
  ownerOpenId: 'ou_1',
  checkedAt: 1,
  detail: 'raw cli diagnostic',
};

/** 手动检测返回的新快照。 */
const CHECKED_SNAPSHOT: AuthSnapshot = { ...SNAPSHOT, checkedAt: 2 };

const SAFE_FIELDS = ['cli', 'bot', 'user', 'ready', 'checkedAt'];
const FORBIDDEN_FIELDS = [
  'detail',
  'appId',
  'userName',
  'ownerOpenId',
  'login',
  'error',
  'session',
  'sessionId',
  'sessionWorkspace',
  'sessionTitle',
  'verificationUrl',
  'deviceCode',
  'token',
  'scope',
  'stage',
  'botStatus',
  'workspaceRoot',
];

/** 记录注册路由的假 WebServer。 */
function makeWebServer() {
  const routes = new Map<string, (req: unknown, res: unknown) => Promise<void>>();
  return {
    routes,
    webServer: {
      getOrigin: () => 'http://127.0.0.1:1234',
      register: (route: {
        path: string;
        handler: (req: unknown, res: unknown) => Promise<void>;
      }) => {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      },
    },
  };
}

/** 构造假的请求对象。 */
function request(
  method: string,
  body = '',
  headers: Record<string, string> = {},
  remoteAddress = '127.0.0.1',
): {
  method: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string };
  [Symbol.asyncIterator]: () => AsyncGenerator<Buffer>;
} {
  return {
    method,
    headers,
    socket: { remoteAddress },
    async *[Symbol.asyncIterator]() {
      if (body !== '') yield Buffer.from(body);
    },
  };
}

/** 构造假的响应对象。 */
function response() {
  const captured: { status: number; body: string; headers: Record<string, string> } = {
    status: 0,
    body: '',
    headers: {},
  };
  return {
    captured,
    res: {
      writeHead: (status: number, headers: Record<string, string>) => {
        captured.status = status;
        captured.headers = headers;
      },
      end: (body: string) => {
        captured.body = body;
      },
    },
  };
}

/** 构造路由依赖。 */
function setup(connection?: RouteDeps['connection']) {
  const { webServer, routes } = makeWebServer();
  const check = vi.fn(async () => CHECKED_SNAPSHOT);
  const onAuthChanged = vi.fn();
  const deps: RouteDeps = {
    webServer,
    ...(connection === undefined ? {} : { connection }),
    auth: { current: SNAPSHOT, check } as never,
    logger: { warn: vi.fn() },
    onAuthChanged,
  };
  const dispose = registerRoutes(deps);
  return { routes, dispose, check, onAuthChanged };
}

/** 校验成功响应只含浏览器可读的笼统状态。 */
function expectSafeStatus(body: string, snapshot: AuthSnapshot): void {
  const reply = JSON.parse(body) as { data: Record<string, unknown> };
  expect(reply).toEqual({
    ok: true,
    data: {
      cli: snapshot.cli,
      bot: snapshot.bot,
      user: snapshot.user,
      ready: snapshot.ready,
      checkedAt: snapshot.checkedAt,
    },
  });
  expect(Object.keys(reply.data).sort()).toEqual([...SAFE_FIELDS].sort());
  for (const field of FORBIDDEN_FIELDS) expect(reply.data).not.toHaveProperty(field);
}

describe('registerRoutes', async () => {
  it('只注册 status 与 check 两条路由', async () => {
    const { routes } = setup();
    expect([...routes.keys()].sort()).toEqual(['/lark-bridge/check', '/lark-bridge/status']);
  });

  it('GET status 返回只读安全快照', async () => {
    const { routes, check, onAuthChanged } = setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(request('GET'), res);
    expect(captured.status).toBe(200);
    expectSafeStatus(captured.body, SNAPSHOT);
    expect(captured.headers['content-type']).toContain('application/json');
    expect(check).not.toHaveBeenCalled();
    expect(onAuthChanged).not.toHaveBeenCalled();
  });

  it('POST check 执行检测并通知状态变化', async () => {
    const { routes, check, onAuthChanged } = setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/check')?.(request('POST', '{}'), res);
    expect(captured.status).toBe(200);
    expect(check).toHaveBeenCalledOnce();
    expect(check).toHaveBeenCalledWith();
    expect(onAuthChanged).toHaveBeenCalledOnce();
    expect(onAuthChanged).toHaveBeenCalledWith(CHECKED_SNAPSHOT);
    expectSafeStatus(captured.body, CHECKED_SNAPSHOT);
  });

  it('拒绝非回环请求', async () => {
    const { routes, check } = setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(request('GET', '', {}, '203.0.113.10'), res);
    expect(captured.status).toBe(403);
    expect(check).not.toHaveBeenCalled();
  });

  it('拒绝跨源请求', async () => {
    const { routes, check } = setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(
      request('GET', '', { origin: 'http://evil.example' }),
      res,
    );
    expect(captured.status).toBe(403);
    expect(check).not.toHaveBeenCalled();
  });

  it('沿用宿主 connection 请求校验', async () => {
    const requestRejection = vi.fn(() => 403);
    const { routes, check } = setup({ requestRejection });
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(request('GET'), res);
    expect(requestRejection).toHaveBeenCalledWith({ method: 'GET', headers: {} });
    expect(captured.status).toBe(403);
    expect(check).not.toHaveBeenCalled();
  });

  it('不注册授权、会话重置和未知路由', async () => {
    const { routes } = setup();
    for (const path of [
      '/lark-bridge/auth/start',
      '/lark-bridge/auth/cancel',
      '/lark-bridge/session/reset',
      '/lark-bridge/app',
      '/lark-bridge/unknown',
    ]) {
      expect(routes.has(path)).toBe(false);
    }
  });
});
