/** 浏览器侧调用宿主 `/lark-bridge/*` 路由。导出 BridgeStatus 与 fetch 函数。 */

/** 鉴权阶段。 */
export type AuthStage = 'cli-missing' | 'bot-unavailable' | 'user-missing' | 'ready';

/** 路由返回的状态。 */
export interface BridgeStatus {
  readonly ready: boolean;
  readonly stage: AuthStage;
  readonly appId?: string;
  readonly botStatus?: string;
  readonly userName?: string;
  readonly ownerOpenId?: string;
  readonly checkedAt: number;
  readonly detail?: string;
  readonly workspaceRoot: string;
  readonly sessionId: string | null;
  readonly sessionWorkspace: string | null;
  readonly sessionTitle: string | null;
  /** 最近一次消息注入失败的原因。 */
  readonly error?: string;
  readonly login: { verificationUrl: string; expiresAt: number } | null;
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

/** 一次调用结果。 */
export type ApiResult<T> = ApiSuccess<T> | ApiFailure;

/** 构造路由地址。 */
function endpoint(path: string): string {
  return `${window.location.origin}/lark-bridge/${path}`;
}

/** 发起一次 JSON 调用；网络失败映射为可显示的失败。 */
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

/** 读取鉴权状态。 */
export function fetchStatus(signal?: AbortSignal): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('status', { method: 'GET' }, signal);
}

/** 重新检测。 */
export function checkAuth(): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('check', { method: 'POST', body: '{}' });
}

/** 开始设备码授权。 */
export function startLogin(): Promise<ApiResult<{ verificationUrl: string; expiresAt: number }>> {
  return callApi('auth/start', { method: 'POST', body: '{}' });
}

/** 取消设备码授权。 */
export function cancelLogin(): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('auth/cancel', { method: 'POST', body: '{}' });
}

/** 清除桥接会话记录。 */
export function resetSession(): Promise<ApiResult<BridgeStatus>> {
  return callApi<BridgeStatus>('session/reset', { method: 'POST', body: '{}' });
}
