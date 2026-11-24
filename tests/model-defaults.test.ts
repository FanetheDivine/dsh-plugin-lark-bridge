// 模型目录测试：目录加载、草稿写入、已存模型可路由与连接重置后的重新加载。
import { describe, expect, it, vi } from 'vitest';

import { PluginConfigForm } from '../src/client/config-form.ts';
import { ModelDefaults } from '../src/client/model-defaults.ts';
import { PresenceConfigForm } from '../src/client/presence-config.tsx';
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
  it('读写 worker 字段，并随草稿显示当前选择', async () => {
    const fake = makeConfigFormScope({
      value: { guiInputSetsLocal: true, larkInputSetsRemote: true },
    });
    const form = new PresenceConfigForm(fake.scope);
    const injected = form.inject();
    const ctx = {
      on: () => () => undefined,
      remote: {
        $on: () => () => undefined,
        session: {
          modelCatalog: async () => ({ ok: true, value: { groups: GROUPS, failures: [] } }),
        },
      },
    };
    const models = new ModelDefaults(ctx as never, injected.hooks.presenceConfig, injected.edit, {
      provider: 'workerProvider',
      model: 'workerModel',
      effort: 'workerEffort',
    });
    const defaults = models.inject((() => '') as never, (text) => String(text));
    await settle();
    expect(defaults.directory.getSnapshot().current).toBeNull();
    await defaults.select({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high' as never,
    });
    const state = injected.hooks.presenceConfig.getSnapshot();
    expect(state.workerProvider.text).toBe('deepseek');
    expect(state.workerModel.text).toBe('deepseek-chat');
    expect(state.workerEffort.text).toBe('high');
    expect(defaults.directory.getSnapshot().current).toEqual({
      provider: 'deepseek',
      model: 'deepseek-chat',
      reasoningEffort: 'high',
    });
    expect(defaults.directory.getSnapshot().routable).toBe(true);
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
