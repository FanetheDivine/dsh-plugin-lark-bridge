// 在场状态路由测试：读取、切换、参数校验与来源校验。
import { describe, expect, it, vi } from 'vitest';

import { PresenceStore } from '../src/lark-super-agent/presence.ts';
import { PRESENCE_PATH, registerPresenceRoute } from '../src/lark-super-agent/routes.ts';

type Handler = (req: unknown, res: unknown) => Promise<void>;

/** 构造路由依赖与记录注册的假 WebServer。 */
function setup() {
  const routes = new Map<string, Handler>();
  const webServer = {
    getOrigin: () => 'http://127.0.0.1:1234',
    register: (route: { path: string; handler: Handler }) => {
      routes.set(route.path, route.handler);
      return () => routes.delete(route.path);
    },
  };
  const store = new PresenceStore({
    switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
    now: () => 5,
  });
  const holidays = { status: () => ({ state: 'fresh' as const, fetchedAt: 4 }) };
  const dispose = registerPresenceRoute({
    webServer,
    store,
    holidays,
    logger: { warn: vi.fn() },
  });
  return { routes, store, dispose };
}

/** 发送一次请求并解析响应。 */
async function call(
  routes: Map<string, Handler>,
  method: string,
  body = '',
  headers: Record<string, string> = {},
  remoteAddress = '127.0.0.1',
): Promise<{ status: number; body: Record<string, unknown> }> {
  const handler = routes.get(PRESENCE_PATH);
  if (handler === undefined) throw new Error('route missing');
  const captured = { status: 0, body: '' };
  await handler(
    {
      method,
      headers,
      socket: { remoteAddress },
      async *[Symbol.asyncIterator]() {
        if (body !== '') yield Buffer.from(body);
      },
    },
    {
      writeHead: (status: number) => {
        captured.status = status;
      },
      end: (text: string) => {
        captured.body = text;
      },
    },
  );
  return { status: captured.status, body: JSON.parse(captured.body) as Record<string, unknown> };
}

describe('registerPresenceRoute', () => {
  it('GET 返回当前快照', async () => {
    const { routes } = setup();
    expect(await call(routes, 'GET')).toEqual({
      status: 200,
      body: {
        ok: true,
        data: { presence: 'local', updatedAt: 5, holidays: { state: 'fresh', fetchedAt: 4 } },
      },
    });
  });

  it('POST 写入目标状态', async () => {
    const { routes, store } = setup();
    const reply = await call(routes, 'POST', JSON.stringify({ presence: 'remote' }));
    expect(reply.status).toBe(200);
    expect(reply.body).toEqual({
      ok: true,
      data: { presence: 'remote', updatedAt: 5, holidays: { state: 'fresh', fetchedAt: 4 } },
    });
    expect(store.get().presence).toBe('remote');
  });

  it('非法 presence 或非 JSON 返回 invalid-presence', async () => {
    const { routes, store } = setup();
    for (const body of [JSON.stringify({ presence: 'away' }), 'not json', '']) {
      const reply = await call(routes, 'POST', body);
      expect(reply.status).toBe(400);
      expect((reply.body.error as { code: string }).code).toBe('invalid-presence');
    }
    expect(store.get().presence).toBe('local');
  });

  it('其他方法返回 method-not-allowed', async () => {
    const { routes } = setup();
    const reply = await call(routes, 'PUT');
    expect(reply.status).toBe(400);
    expect((reply.body.error as { code: string }).code).toBe('method-not-allowed');
  });

  it('非回环地址与来源不符返回 403', async () => {
    const { routes, store } = setup();
    const remote = await call(routes, 'POST', '{"presence":"remote"}', {}, '10.0.0.2');
    const origin = await call(routes, 'POST', '{"presence":"remote"}', {
      origin: 'http://evil.test',
    });
    expect(remote.status).toBe(403);
    expect(origin.status).toBe(403);
    expect(store.get().presence).toBe('local');
  });

  it('没有节假日日历时按 missing 回答', async () => {
    const routes = new Map<string, Handler>();
    const webServer = {
      getOrigin: () => 'http://127.0.0.1:1234',
      register: (route: { path: string; handler: Handler }) => {
        routes.set(route.path, route.handler);
        return () => routes.delete(route.path);
      },
    };
    const store = new PresenceStore({
      switches: () => ({ guiInputSetsLocal: true, larkInputSetsRemote: true }),
      now: () => 5,
    });
    registerPresenceRoute({ webServer, store, logger: { warn: vi.fn() } });
    const reply = await call(routes, 'GET');
    expect((reply.body.data as { holidays: unknown }).holidays).toEqual({
      state: 'missing',
      fetchedAt: null,
    });
  });

  it('注销后不再处理', () => {
    const { routes, dispose } = setup();
    dispose();
    expect(routes.has(PRESENCE_PATH)).toBe(false);
  });
});
