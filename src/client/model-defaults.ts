/**
 * 配置页的模型目录与草稿状态：复用宿主模型目录，读取配置里的模型，并把选择写入配置草稿。
 * 导出 ModelDefaults 与 ModelDefaultsInjected。
 */
import type { Context } from '@deepseek-ai/cordis';
import type { ModelCatalogModel, ModelSelection } from '@deepseek-ai/dsh-api-remotes/client';
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import { ModelCatalogDirectory } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/catalog.ts';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/directory.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';

/** 模型选择器读写的三个草稿字段名。 */
export interface ModelFieldNames {
  readonly provider: string;
  readonly model: string;
  readonly effort: string;
}

/** 主行配置页使用的字段名：新建桥接会话的模型。 */
export const SESSION_MODEL_FIELDS: ModelFieldNames = {
  provider: 'sessionProvider',
  model: 'sessionModel',
  effort: 'sessionEffort',
};

/** 草稿状态里按字段名读取暂存文本的最小结构。 */
export type ModelFormState = object;

/** 读取草稿里某字段的暂存文本；字段缺失按空处理。 */
function fieldText(state: ModelFormState, field: string): string {
  const value = (state as Record<string, unknown>)[field];
  if (typeof value !== 'object' || value === null || !('text' in value)) return '';
  const text = (value as { text: unknown }).text;
  return typeof text === 'string' ? text.trim() : '';
}

/** 配置页默认模型选择器使用的注入值。 */
export interface ModelDefaultsInjected {
  /** 官方选择器读取的目录状态。 */
  directory: SnapshotStore<ModelDirectoryState>;
  /** 加载或重试模型目录。 */
  load: () => void;
  /** 把选择写入配置草稿。 */
  select: (selection: ModelSelection) => Promise<{ ok: true; value: undefined }>;
  /** 官方选择器的文案。 */
  t: TranslateNS<'model'>;
  /** 解析模型徽标文案。 */
  resolveText: (text: NonNullable<ModelCatalogModel['badge']>['text']) => string;
}

/** 保存模型目录、配置草稿与选择器共享状态的订阅。 */
export class ModelDefaults {
  private readonly catalog: ModelCatalogDirectory;
  private readonly store: SnapshotStore<ModelDirectoryState> = createSnapshotStore({
    current: null,
    routable: null,
    groups: [],
    failures: [],
    status: 'idle',
    pending: null,
    error: null,
  });
  private readonly disposers: Array<() => void> = [];

  /**
   * @param ctx - 前端根上下文，提供模型目录与连接事件。
   * @param form - 配置页草稿状态。
   * @param edit - 配置页草稿编辑动作。
   * @param fields - 选择器读写的草稿字段名，缺省为新建桥接会话的模型。
   */
  constructor(
    ctx: Context,
    private readonly form: SnapshotStore<ModelFormState>,
    private readonly edit: (field: string, text: string) => void,
    private readonly fields: ModelFieldNames = SESSION_MODEL_FIELDS,
  ) {
    this.catalog = new ModelCatalogDirectory(ctx);
    this.disposers.push(this.catalog.store.subscribe(() => this.sync()));
    this.disposers.push(form.subscribe(() => this.sync()));
    this.disposers.push(
      ctx.on('connection/reset', () => {
        this.catalog.resetGeneration();
      }),
    );
    for (const event of [
      'llm/adapters-updated',
      'llm/models-updated',
      'settings/document-updated',
      'credentials/record-updated',
      'credentials/reference-updated',
    ] as const) {
      this.disposers.push(
        ctx.remote.$on(event, () => {
          this.catalog.refresh();
        }),
      );
    }
    void this.catalog.load().catch(() => undefined);
    this.sync();
  }

  /** @returns 配置页选择器的注入值。 */
  inject(
    t: TranslateNS<'model'>,
    resolveText: ModelDefaultsInjected['resolveText'],
  ): ModelDefaultsInjected {
    return {
      directory: this.store,
      load: () => {
        void this.catalog.load().catch(() => undefined);
      },
      select: (selection) => this.select(selection),
      t,
      resolveText,
    };
  }

  /** 释放目录、配置与连接事件的订阅。 */
  dispose(): void {
    for (const dispose of this.disposers.splice(0)) dispose();
  }

  /** 把选择写入草稿，并立即更新选择器显示。 */
  private select(selection: ModelSelection): Promise<{ ok: true; value: undefined }> {
    this.store.update((state) => {
      state.pending = selection;
      state.status = 'selecting';
      state.error = null;
    });
    this.edit(this.fields.provider, selection.provider);
    this.edit(this.fields.model, selection.model);
    this.edit(this.fields.effort, selection.reasoningEffort ?? '');
    this.store.update((state) => {
      state.pending = null;
      state.status = 'ready';
    });
    return Promise.resolve({ ok: true, value: undefined });
  }

  /** 从目录与配置草稿重建选择器状态。 */
  private sync(): void {
    const config = this.form.getSnapshot();
    const catalog = this.catalog.store.getSnapshot();
    const provider = fieldText(config, this.fields.provider);
    const model = fieldText(config, this.fields.model);
    const effort = fieldText(config, this.fields.effort);
    const current =
      provider === '' || model === ''
        ? null
        : { provider, model, ...(effort === '' ? {} : { reasoningEffort: effort }) };
    const groups = catalog.value?.groups ?? [];
    const routable =
      current === null || catalog.status !== 'ready'
        ? null
        : groups.some(
            (group) =>
              group.id === current.provider &&
              group.models.some((entry) => entry.id === current.model),
          );
    this.store.update((state) => {
      state.current = current;
      if (effort === '') delete state.retainedEffort;
      else state.retainedEffort = effort;
      state.routable = routable;
      state.groups = groups;
      state.failures = catalog.value?.failures ?? [];
      state.status =
        catalog.status === 'error' ? 'error' : catalog.status === 'ready' ? 'ready' : 'loading';
      state.error = catalog.error;
    });
  }
}
