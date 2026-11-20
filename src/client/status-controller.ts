/** 共享连接状态控制器：完整检测、只读轮询、订阅与清理。 */
import { useSyncExternalStore } from 'react';

import { type ApiResult, type BridgeStatus, checkAuth, fetchStatus } from './api.ts';

/** 控制器依赖。 */
export interface StatusControllerOptions {
  readonly fetchStatus?: () => Promise<ApiResult<BridgeStatus>>;
  readonly checkAuth?: () => Promise<ApiResult<BridgeStatus>>;
  /** 构造时开始检测与轮询；SSR 接线可关闭。 */
  readonly autoStart?: boolean;
  /** 只读轮询间隔，默认 3000 毫秒。 */
  readonly intervalMs?: number;
}

/** 组件订阅的状态。 */
export interface StatusSnapshot {
  readonly status: BridgeStatus;
  readonly busy: boolean;
}

const INITIAL_STATUS: BridgeStatus = {
  cli: 'checking',
  bot: 'checking',
  user: 'checking',
  ready: false,
  checkedAt: 0,
};

/** 共享一份状态，避免弹窗与配置页分别执行检测。 */
export class StatusController {
  private readonly options: StatusControllerOptions;
  private readonly fetchStatus: () => Promise<ApiResult<BridgeStatus>>;
  private readonly checkAuth: () => Promise<ApiResult<BridgeStatus>>;
  private snapshot: StatusSnapshot = { status: INITIAL_STATUS, busy: false };
  private readonly listeners = new Set<(snapshot: StatusSnapshot) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private checking: Promise<void> | undefined;
  private generation = 0;
  private disposed = false;

  constructor(options: StatusControllerOptions = {}) {
    this.options = options;
    this.fetchStatus = options.fetchStatus ?? fetchStatus;
    this.checkAuth = options.checkAuth ?? checkAuth;
    if (options.autoStart !== false) this.start();
  }

  /** 当前状态快照。 */
  getSnapshot = (): StatusSnapshot => this.snapshot;

  /** 订阅状态变化。 */
  subscribe(listener: (snapshot: StatusSnapshot) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 开始加载检测和只读轮询。 */
  start(): void {
    if (this.disposed || this.timer !== undefined) return;
    this.timer = setInterval(() => {
      void this.refresh();
    }, this.options.intervalMs ?? 3000);
    void this.check();
  }

  /** 完整检测；并发调用共享同一次请求。 */
  check(): Promise<void> {
    if (this.checking !== undefined) return this.checking;
    const generation = ++this.generation;
    this.publish({ ...this.snapshot, busy: true });
    this.checking = this.checkAuth()
      .then((result) => {
        if (!this.disposed && generation === this.generation && result.ok) {
          this.publish({ status: result.data, busy: false });
        }
      })
      .finally(() => {
        if (generation === this.generation) {
          this.checking = undefined;
          if (!this.disposed && this.snapshot.busy) {
            this.publish({ ...this.snapshot, busy: false });
          }
        }
      });
    return this.checking;
  }

  /** 停止轮询并使未完成的请求结果失效。 */
  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    this.checking = undefined;
    this.listeners.clear();
  }

  private async refresh(): Promise<void> {
    if (this.disposed || this.checking !== undefined) return;
    const generation = this.generation;
    const result = await this.fetchStatus();
    if (!this.disposed && generation === this.generation && result.ok) {
      this.publish({ ...this.snapshot, status: result.data });
    }
  }

  private publish(next: StatusSnapshot): void {
    if (this.disposed) return;
    this.snapshot = next;
    for (const listener of this.listeners) listener(next);
  }
}

/** 在 React 组件中订阅共享状态。 */
export function useStatusSnapshot(controller: StatusController): StatusSnapshot {
  return useSyncExternalStore(
    (listener) => controller.subscribe(() => listener()),
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
