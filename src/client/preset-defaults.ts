/**
 * 配置页的预设目录：读取宿主预设名册，把选择写入配置草稿。
 * 导出 PresetDefaults、PresetDefaultsInjected 与 PresetDefaultsState。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';

/** 名册里的一行预设；字段与宿主远程返回一致。 */
export interface AgentPresetRowLike {
  readonly id: string;
  readonly name?: string;
  readonly description?: string;
  readonly isDefault?: boolean;
  readonly broken?: string;
}

/** 名册读取的四种结果。 */
export type PresetRosterStatus = 'loading' | 'ready' | 'noService' | 'error';

/** 一份配置草稿中预设字段的最小读取面。 */
export interface PresetDraft {
  getSnapshot(): unknown;
  subscribe(listener: () => void): () => void;
}

/** 配置页预设选择器读取的状态。 */
export interface PresetDefaultsState {
  /** 名册读取状态。 */
  status: PresetRosterStatus;
  /** 读取失败时的说明。 */
  error: string | null;
  /** 可用预设，按宿主顺序。 */
  rows: readonly AgentPresetRowLike[];
  /** 配置草稿中的预设标识；空值表示跟随宿主默认。 */
  current: string;
}

/** 配置页预设选择器使用的注入值。 */
export interface PresetDefaultsInjected {
  /** 选择器读取的状态。 */
  hooks: { presetDefaults: SnapshotStore<PresetDefaultsState> };
  /** 重新读取宿主名册。 */
  load: () => void;
  /** 把选择写入配置草稿。 */
  select: (id: string) => void;
}

/** 一次名册读取的返回值形状。 */
type RosterRead =
  | { ok: true; value: { readonly presets: readonly AgentPresetRowLike[] } }
  | { ok: false; error: { readonly code: string; readonly message: string } };

/** 浏览器侧的预设目录远程命名空间。 */
export interface PresetRemoteLike {
  list(): Promise<RosterRead>;
}

/** 保存名册、配置草稿与选择器共享状态的订阅。 */
export class PresetDefaults {
  private readonly store: SnapshotStore<PresetDefaultsState> = createSnapshotStore({
    status: 'noService',
    error: null,
    rows: [],
    current: '',
  });
  private readonly disposers: Array<() => void> = [];
  private reading = false;
  private remote: PresetRemoteLike | undefined;

  /**
   * @param ctx - 前端根上下文，提供连接事件。
   * @param form - 配置草稿状态。
   * @param edit - 配置草稿编辑动作。
   * @param field - 草稿中保存预设的字段名。
   * @param remote - 预设名册远程命名空间；缺失时选择器保持禁用。
   * @param excludeIds - 不进入可选项的预设标识；已存值不受影响。
   */
  constructor(
    ctx: Context,
    private readonly form: PresetDraft,
    private readonly edit: (field: string, text: string) => void,
    private readonly field: string = 'sessionPreset',
    remote?: PresetRemoteLike,
    private readonly excludeIds: readonly string[] = [],
  ) {
    this.remote = remote;
    this.disposers.push(form.subscribe(() => this.sync()));
    this.disposers.push(ctx.on('connection/reset', () => this.load(true)));
    this.sync();
  }

  /** 宿主预设服务就绪后接入名册，并读取一次。 */
  attach(remote: PresetRemoteLike): void {
    this.remote = remote;
    void this.load(true);
  }

  /** @returns 配置页选择器的注入值。 */
  inject(): PresetDefaultsInjected {
    return {
      hooks: { presetDefaults: this.store },
      load: () => {
        void this.load(true);
      },
      select: (id) => this.edit(this.field, id),
    };
  }

  /** 释放对配置草稿与连接事件的订阅。 */
  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  /** 读取宿主的可用预设；失败时保留已保存值。 */
  async load(force = false): Promise<void> {
    if (this.reading) return;
    if (!force && this.store.getSnapshot().status === 'ready') return;
    const remote = this.remote;
    if (remote === undefined) {
      this.store.update((state) => {
        state.status = 'noService';
        state.error = null;
      });
      return;
    }
    this.reading = true;
    this.store.update((state) => {
      state.status = 'loading';
      state.error = null;
    });
    try {
      const result = await remote.list();
      if (result.ok) {
        const rows = result.value.presets.filter(
          (row) => row.broken === undefined && !this.excludeIds.includes(row.id),
        );
        this.store.update((state) => {
          state.status = 'ready';
          state.rows = rows;
        });
      } else if (result.error.code === 'gateway/invocation-unavailable') {
        this.store.update((state) => {
          state.status = 'noService';
          state.error = null;
        });
      } else {
        this.store.update((state) => {
          state.status = 'error';
          state.error = result.error.message;
        });
      }
    } catch (error) {
      this.store.update((state) => {
        state.status = 'error';
        state.error = error instanceof Error ? error.message : String(error);
      });
    } finally {
      this.reading = false;
    }
  }

  /** 从配置草稿重建当前选择。 */
  private sync(): void {
    const snapshot = this.form.getSnapshot() as Record<string, { text?: string } | undefined>;
    const current = snapshot[this.field]?.text ?? '';
    this.store.update((state) => {
      state.current = current.trim();
    });
  }
}
