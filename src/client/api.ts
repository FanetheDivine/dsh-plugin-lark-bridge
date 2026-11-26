/** 浏览器侧调用宿主 `/lark-bridge/*` 路由。导出安全状态与检测函数。 */

import type { ConnectionState } from '../types.ts';

/** 路由返回的笼统连接状态。 */
export interface BridgeStatus {
  readonly cli: ConnectionState;
  readonly bot: ConnectionState;
  readonly user: ConnectionState;
  readonly ready: boolean;
  readonly checkedAt: number;
}

/** 失败结果。 */
export interface ApiFailure {
  readonly ok: false;
  readonly error: { code: string; message: string };
}

/** 成功结果。 */
export interface ApiSuccess<T> {
  readonly ok: true;
  readonly data: T;
}

export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** 构造路由地址。 */
function endpoint(path: string): string {
  return `${window.location.origin}/lark-bridge/${path}`;
}

/** 发起一次 JSON 调用；网络失败映射为内部结果。 */
export async function callApi<T>(
  path: string,
  init: RequestInit = {},
  signal?: AbortSignal,
): Promise<ApiResult<T>> {
  try {
    const response = await fetch(endpoint(path), {
      ...init,
      credentials: 'same-origin',
      headers: { 'content-type': 'application/json', ...(init.headers ?? {}) },
      ...(signal === undefined ? {} : { signal }),
    });
    const text = await response.text();
    let body: unknown;
    try {
      body = JSON.parse(text) as unknown;
    } catch {
      return { ok: false, error: { code: 'invalid-response', message: text.slice(0, 200) } };
    }
    const record =
      typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
    if (record['ok'] === true) return { ok: true, data: record['data'] as T };
    const error =
      typeof record['error'] === 'object' && record['error'] !== null
        ? (record['error'] as Record<string, unknown>)
        : {};
    return {
      ok: false,
      error: {
        code: typeof error['code'] === 'string' ? error['code'] : 'unknown',
        message: typeof error['message'] === 'string' ? error['message'] : '请求失败',
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: { code: 'network', message: error instanceof Error ? error.message : String(error) },
    };
  }
}

/** 读取最近一次连接状态。 */
export function fetchStatus(signal?: AbortSignal): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('status', { method: 'GET' }, signal);
}

/** 执行一次完整检测。 */
export function checkAuth(): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('check', { method: 'POST', body: '{}' });
}
