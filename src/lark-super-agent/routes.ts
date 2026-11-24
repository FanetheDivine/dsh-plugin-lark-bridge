/**
 * 在场状态路由：浏览器读取与切换全局在场状态。
 * 导出 PRESENCE_PATH 与 registerPresenceRoute。
 */
import type { IncomingMessage } from 'node:http';

import { BridgeError } from '../errors.ts';
import {
  type ConnectionLike,
  type Reply,
  rejectReason,
  send,
  type WebServerLike,
} from '../routes.ts';
import { describeError } from '../utils.ts';
import { isUserPresence, type PresenceStore } from './presence.ts';

/** 在场状态路由路径。 */
export const PRESENCE_PATH = '/lark-bridge/presence';

/** 请求体上限：只需容纳一个状态字段。 */
const MAX_BODY_BYTES = 1024;

/** 路由依赖。 */
export interface PresenceRouteDeps {
  readonly webServer: WebServerLike;
  readonly connection?: ConnectionLike;
  readonly store: PresenceStore;
  readonly logger: { warn(message: string): void };
}

/** 读取 JSON 请求体；超长或无法解析时抛出 invalid-presence。 */
async function readJson(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req as AsyncIterable<Buffer | string>) {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    size += buffer.length;
    if (size > MAX_BODY_BYTES) throw new BridgeError('invalid-presence', '请求体过大');
    chunks.push(buffer);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
  } catch {
    throw new BridgeError('invalid-presence', '请求体不是 JSON');
  }
}

/** 执行路由动作。 */
async function handle(deps: PresenceRouteDeps, req: IncomingMessage): Promise<Reply> {
  const method = req.method ?? 'GET';
  if (method === 'GET') return { ok: true, data: deps.store.get() };
  if (method !== 'POST') throw new BridgeError('method-not-allowed', '只支持 GET 与 POST');
  const body = await readJson(req);
  const presence =
    typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)['presence']
      : undefined;
  if (!isUserPresence(presence)) {
    throw new BridgeError('invalid-presence', 'presence 必须是 local 或 remote');
  }
  return { ok: true, data: deps.store.set(presence) };
}

/** 注册在场状态路由并返回注销函数。 */
export function registerPresenceRoute(deps: PresenceRouteDeps): () => void {
  return deps.webServer.register({
    kind: 'exact',
    path: PRESENCE_PATH,
    handler: async (req, res) => {
      const reason = rejectReason(deps, req);
      if (reason !== undefined) {
        send(res, 403, { ok: false, error: { code: 'forbidden', message: reason } });
        return;
      }
      try {
        send(res, 200, await handle(deps, req));
      } catch (error) {
        const code = error instanceof BridgeError ? error.code : 'internal';
        const message = describeError(error);
        if (code === 'internal')
          deps.logger.warn(`lark-bridge: route ${PRESENCE_PATH} failed: ${message}`);
        send(res, code === 'internal' ? 500 : 400, { ok: false, error: { code, message } });
      }
    },
  });
}
