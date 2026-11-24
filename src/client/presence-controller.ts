/**
 * 在场状态控制器：轮询全局在场状态，判断「飞书任务与调度会话」行是否可用。
 * 导出 PresenceController、PresenceViewState 与 usePresenceSnapshot。
 */
import { useSyncExternalStore } from 'react';

import {
  type ApiResult,
  fetchPresence,
  type Presence,
  type PresenceStatus,
  writePresence,
} from './api.ts';

/** 切换失败后保持错误态的时长。 */
const FAILED_MS = 3000;

/** 控制器依赖。 */
export interface PresenceControllerOptions {
  readonly fetchPresence?: () => Promise<ApiResult<PresenceStatus>>;
  readonly writePresence?: (presence: Presence) => Promise<ApiResult<PresenceStatus>>;
  /** 构造时开始轮询；测试与 SSR 可关闭。 */
  readonly autoStart?: boolean;
  /** 轮询间隔，默认 3000 毫秒。 */
  readonly intervalMs?: number;
  /** 页面是否隐藏；隐藏时跳过轮询。 */
  readonly hidden?: () => boolean;
}

/** 组件订阅的状态。 */
export interface PresenceViewState {
  /** true 表示行已启用，false 表示路由不存在，null 表示尚无结论。 */
  readonly available: boolean | null;
  readonly presence: Presence;
  /** 最近一次切换失败，3 秒后清除。 */
  readonly failed: boolean;
}

/** 默认的页面隐藏判断。 */
function documentHidden(): boolean {
  return typeof document !== 'undefined' && document.visibilityState === 'hidden';
}

/** 共享一份在场状态，供页脚按钮与挂载逻辑订阅。 */
export class PresenceController {
  private readonly options: PresenceControllerOptions;
  private readonly fetchPresence: () => Promise<ApiResult<PresenceStatus>>;
  private readonly writePresence: (presence: Presence) => Promise<ApiResult<PresenceStatus>>;
  private snapshot: PresenceViewState = { available: null, presence: 'local', failed: false };
  private failedTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly listeners = new Set<(snapshot: PresenceViewState) => void>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private running = false;
  /** 切换请求进行中；期间跳过轮询，避免旧状态覆盖目标状态。 */
  private writing = false;
  private generation = 0;
  private disposed = false;
  private readonly eager = (): void => {
    void this.refresh();
  };

  constructor(options: PresenceControllerOptions = {}) {
    this.options = options;
    this.fetchPresence = options.fetchPresence ?? fetchPresence;
    this.writePresence = options.writePresence ?? writePresence;
    if (options.autoStart !== false) this.start();
  }

  /** 当前状态快照。 */
  getSnapshot = (): PresenceViewState => this.snapshot;

  /** 订阅状态变化。 */
  subscribe(listener: (snapshot: PresenceViewState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** 开始轮询，并在页面重新可见或获得焦点时立即读取。 */
  start(): void {
    if (this.disposed || this.timer !== undefined) return;
    this.timer = setInterval(this.eager, this.options.intervalMs ?? 3000);
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.eager);
    if (typeof window !== 'undefined') window.addEventListener('focus', this.eager);
    void this.refresh();
  }

  /** 读取一次；页面隐藏或上一轮未结束时跳过。 */
  async refresh(): Promise<void> {
    if (this.disposed || this.running || this.writing) return;
    if ((this.options.hidden ?? documentHidden)()) return;
    this.running = true;
    const generation = this.generation;
    try {
      const result = await this.fetchPresence();
      if (this.disposed || generation !== this.generation) return;
      if (result.ok) {
        this.publish({ ...this.snapshot, available: true, presence: result.data.presence });
      } else if (result.error.code === 'invalid-response') {
        this.publish({ ...this.snapshot, available: false });
      }
    } finally {
      this.running = false;
    }
  }

  /**
   * 切换到另一状态：立即显示目标状态，再写入宿主。
   * 失败时恢复原状态并保持 3 秒错误态。
   */
  async toggle(): Promise<void> {
    if (this.disposed) return;
    const previous = this.snapshot.presence;
    const target: Presence = previous === 'local' ? 'remote' : 'local';
    const generation = ++this.generation;
    this.clearFailed();
    this.publish({ ...this.snapshot, presence: target, failed: false });
    this.writing = true;
    let result: ApiResult<PresenceStatus>;
    try {
      result = await this.writePresence(target);
    } finally {
      if (generation === this.generation) this.writing = false;
    }
    if (this.disposed || generation !== this.generation) return;
    if (result.ok) {
      this.publish({ ...this.snapshot, available: true, presence: result.data.presence });
      return;
    }
    this.publish({ ...this.snapshot, presence: previous, failed: true });
    this.failedTimer = setTimeout(() => {
      this.failedTimer = undefined;
      this.publish({ ...this.snapshot, failed: false });
    }, FAILED_MS);
  }

  /** 停止轮询并使未完成的请求结果失效。 */
  dispose(): void {
    this.disposed = true;
    this.generation += 1;
    this.clearFailed();
    if (this.timer !== undefined) clearInterval(this.timer);
    this.timer = undefined;
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', this.eager);
    }
    if (typeof window !== 'undefined') window.removeEventListener('focus', this.eager);
    this.listeners.clear();
  }

  /** 清除错误态计时。 */
  private clearFailed(): void {
    if (this.failedTimer !== undefined) clearTimeout(this.failedTimer);
    this.failedTimer = undefined;
  }

  /** 发布新快照；内容未变时不通知。 */
  protected publish(next: PresenceViewState): void {
    if (this.disposed) return;
    const previous = this.snapshot;
    this.snapshot = next;
    const keys = Object.keys(next) as (keyof PresenceViewState)[];
    if (keys.every((key) => previous[key] === next[key])) return;
    for (const listener of this.listeners) listener(next);
  }
}

/** 在 React 组件中订阅在场状态。 */
export function usePresenceSnapshot(controller: PresenceController): PresenceViewState {
  return useSyncExternalStore(
    (listener) => controller.subscribe(() => listener()),
    controller.getSnapshot,
    controller.getSnapshot,
  );
}
