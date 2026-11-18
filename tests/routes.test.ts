// JSON 路由测试：状态投影、同源校验、绑定与错误映射。
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import type { AuthSnapshot } from '../src/auth.ts';
import type { PluginConfig } from '../src/config.ts';
import { projectStatus, type RouteDeps, registerRoutes } from '../src/routes.ts';
import { StateStore } from '../src/state.ts';

const CONFIG: PluginConfig = {
  workspaceRoot: 'D:/work',
  sessionTitle: '飞书',
  profile: 'dsh-lark-bridge',
  larkCli: '',
  ownerOpenId: '',
  authCheckOnStartup: true,
};

/** 就绪快照。 */
const SNAPSHOT: AuthSnapshot = {
  stage: 'ready',
  ready: true,
  profile: 'dsh-lark-bridge',
  appId: 'cli_x',
  botStatus: 'ready',
  userName: '袁',
  ownerOpenId: 'ou_1',
  checkedAt: 1,
  detail: undefined,
};

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
): {
  method: string;
  headers: Record<string, string>;
  socket: { remoteAddress: string };
  [Symbol.asyncIterator]: () => AsyncGenerator<Buffer>;
} {
  return {
    method,
    headers,
    socket: { remoteAddress: '127.0.0.1' },
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
async function setup() {
  const dir = await mkdtemp(path.join(tmpdir(), 'lark-bridge-routes-'));
  const store = new StateStore(path.join(dir, 'state.json'));
  await store.patch({ sessionId: 's1', workspaceRoot: 'D:/work', title: '飞书' });
  const { webServer, routes } = makeWebServer();
  const check = vi.fn(async () => SNAPSHOT);
  const bindApp = vi.fn(async () => SNAPSHOT);
  const startLogin = vi.fn(async () => ({
    verificationUrl: 'https://example.com/verify',
    deviceCode: 'dev',
    expiresAt: Date.now() + 60_000,
  }));
  const deps: RouteDeps = {
    webServer,
    auth: {
      current: SNAPSHOT,
      check,
      bindApp,
      startLogin,
      cancelLogin: vi.fn(),
      whenLoginSettled: async () => SNAPSHOT,
      pendingLogin: undefined,
    } as never,
    sessions: { reset: vi.fn(async () => undefined) } as never,
    store,
    getConfig: () => CONFIG,
    logger: { warn: vi.fn() },
  };
  const dispose = registerRoutes(deps);
  return { routes, dispose, deps, check, bindApp, startLogin, store };
}

describe('projectStatus', () => {
  it('包含鉴权、工作区与会话，不包含 secret', async () => {
    const { deps } = await setup();
    const status = await projectStatus(deps);
    expect(status).toMatchObject({
      ready: true,
      stage: 'ready',
      workspaceRoot: 'D:/work',
      sessionId: 's1',
      sessionTitle: '飞书',
      login: null,
    });
    expect(JSON.stringify(status)).not.toContain('secret');
  });
});

describe('registerRoutes', () => {
  it('注册六条精确路由', async () => {
    const { routes } = await setup();
    expect([...routes.keys()].sort()).toEqual([
      '/lark-bridge/app',
      '/lark-bridge/auth/cancel',
      '/lark-bridge/auth/start',
      '/lark-bridge/check',
      '/lark-bridge/session/reset',
      '/lark-bridge/status',
    ]);
  });

  it('GET status 返回 JSON', async () => {
    const { routes } = await setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(request('GET'), res);
    expect(captured.status).toBe(200);
    expect(JSON.parse(captured.body)).toMatchObject({ ok: true, data: { ready: true } });
    expect(captured.headers['content-type']).toContain('application/json');
  });

  it('跨源请求被拒绝', async () => {
    const { routes } = await setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/status')?.(
      request('GET', '', { origin: 'http://evil.example' }),
      res,
    );
    expect(captured.status).toBe(403);
  });

  it('POST app 调用绑定并返回状态', async () => {
    const { routes, bindApp } = await setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/app')?.(
      request('POST', JSON.stringify({ appId: 'cli_abc', appSecret: 'secret' })),
      res,
    );
    expect(bindApp).toHaveBeenCalledWith('cli_abc', 'secret');
    expect(JSON.parse(captured.body)).toMatchObject({ ok: true });
  });

  it('POST auth/start 返回授权链接', async () => {
    const { routes } = await setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/auth/start')?.(request('POST', '{}'), res);
    expect(JSON.parse(captured.body)).toMatchObject({
      ok: true,
      data: { verificationUrl: 'https://example.com/verify' },
    });
  });

  it('超大请求体被拒绝', async () => {
    const { routes, bindApp } = await setup();
    const { res, captured } = response();
    await routes.get('/lark-bridge/app')?.(request('POST', 'x'.repeat(65 * 1024)), res);
    expect(captured.status).toBe(400);
    expect(bindApp).not.toHaveBeenCalled();
  });

  it('未知路径不在注册表中', async () => {
    const { routes } = await setup();
    expect(routes.has('/lark-bridge/unknown')).toBe(false);
  });
});
