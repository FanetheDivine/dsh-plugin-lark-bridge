/** 浏览器侧调用宿主 `/lark-bridge/*` 路由。导出安全状态、检测与在场状态函数。 */

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

/** 在场状态：local 表示在电脑旁，remote 表示离开。 */
export type Presence = 'local' | 'remote';

/** 节假日数据状态：fresh 为近期获取成功，stale 为使用旧缓存，missing 为没有数据。 */
export type HolidayState = 'fresh' | 'stale' | 'missing';

/** 节假日数据状态。 */
export interface HolidayDataStatus {
  readonly state: HolidayState;
  readonly fetchedAt: number | null;
}

/** 在场状态路由的回答。 */
export interface PresenceStatus {
  readonly presence: Presence;
  readonly updatedAt: number;
  readonly holidays: HolidayDataStatus;
}

/** 没有节假日数据时的状态。 */
export const MISSING_HOLIDAYS: HolidayDataStatus = { state: 'missing', fetchedAt: null };

/** 读取节假日数据状态；结构不符时按没有数据处理。 */
function holidayStatus(value: unknown): HolidayDataStatus {
  if (typeof value !== 'object' || value === null) return MISSING_HOLIDAYS;
  const record = value as Record<string, unknown>;
  const state = record['state'];
  if (state !== 'fresh' && state !== 'stale' && state !== 'missing') return MISSING_HOLIDAYS;
  const fetchedAt = record['fetchedAt'];
  return { state, fetchedAt: typeof fetchedAt === 'number' ? fetchedAt : null };
}

/** 校验在场状态回答；结构不符时映射为 invalid-response。 */
function presenceResult(result: ApiResult<unknown>): ApiResult<PresenceStatus> {
  if (!result.ok) return result;
  const data = result.data as Partial<PresenceStatus> | null | undefined;
  if (
    (data?.presence === 'local' || data?.presence === 'remote') &&
    typeof data.updatedAt === 'number'
  ) {
    return {
      ok: true,
      data: {
        presence: data.presence,
        updatedAt: data.updatedAt,
        holidays: holidayStatus((data as { holidays?: unknown }).holidays),
      },
    };
  }
  return { ok: false, error: { code: 'invalid-response', message: 'unexpected presence reply' } };
}

/** 读取全局在场状态。 */
export async function fetchPresence(): Promise<ApiResult<PresenceStatus>> {
  return presenceResult(await callApi<unknown>('presence', { method: 'GET' }));
}

/** 写入全局在场状态。 */
export async function writePresence(presence: Presence): Promise<ApiResult<PresenceStatus>> {
  return presenceResult(
    await callApi<unknown>('presence', { method: 'POST', body: JSON.stringify({ presence }) }),
  );
}
