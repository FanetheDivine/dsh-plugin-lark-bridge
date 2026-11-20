/**
 * 插件私有状态：桥接会话标识、工作区与消息去重窗口。
 * 导出 BridgeState、emptyState 与 StateStore。
 */
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import { SEEN_LIMIT } from './constants.ts';
import { normalizeWorkspacePath } from './workspace-path.ts';

/** `state.json` 的内容。 */
export interface BridgeState {
  /** 当前桥接会话标识；尚未创建时为 null。 */
  sessionId: string | null;
  /** 会话所属工作区路径。 */
  workspaceRoot: string | null;
  /** 会话标题。 */
  title: string | null;
  /** 已注入的消息标识与时间，用于去重。 */
  seen: Record<string, number>;
  /** 最近一次写入时间（ISO）。 */
  updatedAt: string;
}

/** 空状态。 */
export function emptyState(): BridgeState {
  return { sessionId: null, workspaceRoot: null, title: null, seen: {}, updatedAt: '' };
}

/** 判断反序列化结果是否是状态对象。 */
function isState(value: unknown): value is BridgeState {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    (record['sessionId'] === null || typeof record['sessionId'] === 'string') &&
    (record['workspaceRoot'] === null || typeof record['workspaceRoot'] === 'string') &&
    (record['title'] === null || typeof record['title'] === 'string') &&
    typeof record['seen'] === 'object' &&
    record['seen'] !== null &&
    typeof record['updatedAt'] === 'string'
  );
}

/** 只保留最近 `limit` 条去重记录。 */
function trimSeen(seen: Record<string, number>, limit: number): Record<string, number> {
  const entries = Object.entries(seen);
  if (entries.length <= limit) return seen;
  entries.sort((a, b) => b[1] - a[1]);
  return Object.fromEntries(entries.slice(0, limit));
}

/** 串行写入状态文件；读取失败回落到空状态。 */
export class StateStore {
  /** 状态文件路径。 */
  readonly file: string;
  private readonly limit: number;
  private queue: Promise<unknown> = Promise.resolve();
  private cache: BridgeState | undefined;

  /**
   * @param file - `state.json` 的绝对路径。
   * @param limit - 去重窗口上限。
   */
  constructor(file: string, limit = SEEN_LIMIT) {
    this.file = file;
    this.limit = limit;
  }

  /** 读取状态；文件缺失或损坏时返回空状态。 */
  async load(): Promise<BridgeState> {
    if (this.cache !== undefined) return this.cache;
    try {
      const text = await readFile(this.file, 'utf8');
      const parsed: unknown = JSON.parse(text);
      this.cache = isState(parsed)
        ? {
            ...parsed,
            workspaceRoot:
              parsed.workspaceRoot === null ? null : normalizeWorkspacePath(parsed.workspaceRoot),
            seen: trimSeen(parsed.seen, this.limit),
          }
        : emptyState();
    } catch {
      this.cache = emptyState();
    }
    return this.cache;
  }

  /** 当前缓存值；未加载时返回空状态。 */
  get current(): BridgeState {
    return this.cache ?? emptyState();
  }

  /**
   * 合并写入一批字段，返回写入后的状态。
   * @param patch - 需要覆盖的字段。
   */
  patch(
    patch: Partial<Omit<BridgeState, 'seen' | 'updatedAt'>> & { seen?: Record<string, number> },
  ): Promise<BridgeState> {
    return this.enqueue(async () => {
      const current = await this.load();
      const next: BridgeState = {
        ...current,
        ...patch,
        seen: trimSeen({ ...current.seen, ...(patch.seen ?? {}) }, this.limit),
        updatedAt: new Date().toISOString(),
      };
      if (next.workspaceRoot !== null) {
        next.workspaceRoot = normalizeWorkspacePath(next.workspaceRoot);
      }
      await this.write(next);
      this.cache = next;
      return next;
    });
  }

  /**
   * 标记一条消息已处理。
   * @param id - 消息标识。
   * @param time - 消息时间（毫秒）。
   * @returns true 表示首次见到，false 表示重复。
   */
  markSeen(id: string, time: number): Promise<boolean> {
    return this.enqueue(async () => {
      const current = await this.load();
      if (current.seen[id] !== undefined) return false;
      const next: BridgeState = {
        ...current,
        seen: trimSeen({ ...current.seen, [id]: time }, this.limit),
        updatedAt: new Date().toISOString(),
      };
      await this.write(next);
      this.cache = next;
      return true;
    });
  }

  /**
   * 移除一条去重记录，用于注入失败后的重试。
   * @param id - 消息标识。
   */
  forget(id: string): Promise<BridgeState> {
    return this.enqueue(async () => {
      const current = await this.load();
      if (current.seen[id] === undefined) return current;
      const seen = { ...current.seen };
      delete seen[id];
      const next: BridgeState = { ...current, seen, updatedAt: new Date().toISOString() };
      await this.write(next);
      this.cache = next;
      return next;
    });
  }

  /** 把写操作串到同一条队列，避免并发覆盖。 */
  private enqueue<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.then(action, action);
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async write(state: BridgeState): Promise<void> {
    await mkdir(dirname(this.file), { recursive: true });
    const tmp = `${this.file}.${process.pid}.tmp`;
    await writeFile(tmp, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
    await rm(this.file, { force: true });
    await rename(tmp, this.file);
  }
}
