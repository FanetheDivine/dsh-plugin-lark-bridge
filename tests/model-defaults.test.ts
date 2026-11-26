// 模型目录测试：目录加载、草稿写入、已存模型可路由与连接重置后的重新加载。
import { describe, expect, it, vi } from 'vitest';

import { PluginConfigForm } from '../src/client/config-form.ts';
import { ModelDefaults } from '../src/client/model-defaults.ts';
import { PresenceConfigForm } from '../src/client/presence-config.tsx';
import {
  COMMON_TASK_MODEL_FIELD_NAMES,
  COMPLEX_TASK_MODEL_FIELD_NAMES,
} from '../src/client/task-model-field.tsx';
import { makeConfigFormScope } from './helpers.ts';

/** 目录返回的 provider 分组。 */
const GROUPS = [
  {
    id: 'deepseek',
    name: 'DeepSeek',
    models: [{ id: 'deepseek-chat', name: 'DeepSeek Chat' }],
  },
];

/** 构造目录依赖的客户端 ctx 与配置表单。 */
function setup(config: Record<string, string> = {}) {
  const modelCatalog = vi.fn(async () => ({
    ok: true,
    value: { groups: GROUPS, failures: [] },
  }));
  const listeners = new Map<string, () => void>();
  const ctx = {
    on: (event: string, fn: () => void) => {
      listeners.set(event, fn);
      return () => undefined;
    },
    remote: {
      $on: () => () => undefined,
      session: { modelCatalog },
    },
  };
  const fake = makeConfigFormScope({
    value: {
      workspaceRoot: '/c/work',
      sessionProvider: '',
      sessionModel: '',
      sessionEffort: '',
      sessionPreset: '',
      ...config,
    },
  });
  const form = new PluginConfigForm(fake.scope);
  const injected = form.inject();
  const models = new ModelDefaults(ctx as never, injected.hooks.configForm, injected.edit);
  return { models, injected, modelCatalog, listeners, fake };
}

/** 等待目录加载完成。 */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ModelDefaults 自定义字段名', () => {
  it('普通与复杂任务模型的字段名分别为 commonTask* 与 complexTask*', () => {
    expect(COMMON_TASK_MODEL_FIELD_NAMES).toEqual({
      provider: 'commonTaskProvider',
      model: 'commonTaskModel',
      effort: 'commonTaskEffort',
    });
    expect(COMPLEX_TASK_MODEL_FIELD_NAMES).toEqual({
      provider: 'complexTaskProvider',
      model: 'complexTaskModel',
      effort: 'complexTaskEffort',
    });
  });

  it('读写普通与复杂任务模型字段，并随草稿显示当前选择', async () => {
    const fake = makeConfigFormScope({
      value: { guiInputSetsLocal: true, larkInputSetsRemote: true },
    });
    const form = new PresenceConfigForm(fake.scope);
    const injected = form.inject();
    // 主行的默认模型草稿与存储，用来确认选择任务会话模型不会触碰它们。
    const main = setup({ sessionProvider: 'deepseek', sessionModel: 'deepseek-chat' });
    const ctx = {
      on: () => () => undefined,
      remote: {
        $on: () => () => undefined,
        session: {
          modelCatalog: async () => ({ ok: true, value: { groups: GROUPS, failures: [] } }),
        },
      },
    };
    const commonModels = new ModelDefaults(
      ctx as never,
      injected.hooks.presenceConfig,
      injected.edit,
      COMMON_TASK_MODEL_FIELD_NAMES,
    );
    const complexModels = new ModelDefaults(
      ctx as never,
      injected.hooks.presenceConfig,
      injected.edit,
      COMPLEX_TASK_MODEL_FIELD_NAMES,
    );
    const commonDefaults = commonModels.inject((() => '') as never, (text) => String(text));
    const complexDefaults = complexModels.inject((() => '') as never, (text) => String(text));
    await settle();
    expect(commonDefaults.directory.getSnapshot().current).toBeNull();
    expect(complexDefaults.directory.getSnapshot().current).toBeNull();
    await commonDefaults.select({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'low' as never,
    });
    await complexDefaults.select({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high' as never,
    });
    const state = injected.hooks.presenceConfig.getSnapshot();
    expect(state.commonTaskProvider.text).toBe('deepseek');
    expect(state.commonTaskModel.text).toBe('deepseek-chat');
    expect(state.commonTaskEffort.text).toBe('low');
    expect(state.complexTaskProvider.text).toBe('deepseek');
    expect(state.complexTaskModel.text).toBe('deepseek-chat');
    expect(state.complexTaskEffort.text).toBe('high');
    expect(commonDefaults.directory.getSnapshot().current).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'low',
    });
    expect(complexDefaults.directory.getSnapshot().current).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    expect(commonDefaults.directory.getSnapshot().routable).toBe(true);
    expect(complexDefaults.directory.getSnapshot().routable).toBe(true);
    expect(fake.writes).toEqual([]);
    expect(main.fake.writes).toEqual([]);
    const defaultState = main.injected.hooks.configForm.getSnapshot();
    expect(defaultState.sessionProvider.text).toBe('deepseek');
    expect(defaultState.sessionModel.text).toBe('deepseek-chat');
    expect(defaultState.sessionEffort.text).toBe('');
    form.dispose();
  });
});

describe('ModelDefaults', () => {
  it('加载目录后进入 ready 并暴露分组', async () => {
    const { models, injected } = setup();
    await settle();
    const state = injected.hooks.configForm.getSnapshot();
    expect(state.sessionProvider.text).toBe('');
    const directory = models.inject((() => '') as never, (text) => String(text)).directory;
    expect(directory.getSnapshot().status).toBe('ready');
    expect(directory.getSnapshot().groups).toEqual(GROUPS);
  });

  it('选择写入 provider、model 与 effort 草稿', async () => {
    const { models, injected } = setup();
    const defaults = models.inject((() => '') as never, (text) => String(text));
    await defaults.select({ provider: 'deepseek', model: 'deepseek-chat' });
    const state = injected.hooks.configForm.getSnapshot();
    expect(state.sessionProvider.text).toBe('deepseek');
    expect(state.sessionModel.text).toBe('deepseek-chat');
    expect(state.sessionEffort.text).toBe('');
  });

  it('已存模型不在目录中时不可路由', async () => {
    const { models, injected } = setup();
    injected.edit('sessionProvider', 'other');
    injected.edit('sessionModel', 'missing');
    const defaults = models.inject((() => '') as never, (text) => String(text));
    await settle();
    expect(defaults.directory.getSnapshot().routable).toBe(false);
  });

  it('连接重置后重新读取目录', async () => {
    const { models, modelCatalog, listeners } = setup();
    const defaults = models.inject((() => '') as never, (text) => String(text));
    await settle();
    const before = modelCatalog.mock.calls.length;
    listeners.get('connection/reset')?.();
    await settle();
    expect(modelCatalog.mock.calls.length).toBeGreaterThan(before);
    expect(defaults.directory.getSnapshot().status).toBe('ready');
  });
});
