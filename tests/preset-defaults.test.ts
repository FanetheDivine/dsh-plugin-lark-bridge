// 预设目录测试：名册读取、损坏过滤、无服务、失败重试、草稿写入与自定义字段名。
import { describe, expect, it, vi } from 'vitest';

import { PluginConfigForm } from '../src/client/config-form.ts';
import { PresetDefaults, type PresetRemoteLike } from '../src/client/preset-defaults.ts';
import { TaskConfigForm } from '../src/client/task-config.tsx';
import { makeConfigFormScope } from './helpers.ts';

/** 构造目录依赖的客户端 ctx 与配置表单。 */
function setup(
  remote?: PresetRemoteLike,
  preset = '',
  field?: string,
  excludeIds?: readonly string[],
) {
  const ctx = {
    on: () => () => undefined,
  };
  const fake = makeConfigFormScope({
    value: {
      workspaceRoot: '/c/work',
      sessionProvider: '',
      sessionModel: '',
      sessionEffort: '',
      sessionPreset: preset,
    },
  });
  const form = new PluginConfigForm(fake.scope);
  const injected = form.inject();
  const presets = new PresetDefaults(
    ctx as never,
    injected.hooks.configForm,
    injected.edit,
    field,
    remote,
    excludeIds,
  );
  return { presets, injected, fake, form };
}

/** 等待一次名册读取完成。 */
async function settle(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe('PresetDefaults', () => {
  it('读取名册并过滤损坏条目', async () => {
    const list = vi.fn(async () => ({
      ok: true as const,
      value: {
        presets: [
          { id: 'a', name: 'A' },
          { id: 'b', broken: 'x' },
        ],
      },
    }));
    const { presets, injected } = setup({ list });
    presets.inject().load();
    await settle();
    const state = presets.inject().hooks.presetDefaults.getSnapshot();
    expect(state.status).toBe('ready');
    expect(state.rows.map((row) => row.id)).toEqual(['a']);
    expect(injected.hooks.configForm.getSnapshot().sessionPreset.text).toBe('');
  });

  it('选择写入 sessionPreset 草稿', async () => {
    const { presets, injected } = setup({
      list: async () => ({ ok: true, value: { presets: [] } }),
    });
    presets.inject().select('bridge');
    expect(injected.hooks.configForm.getSnapshot().sessionPreset.text).toBe('bridge');
  });

  it('自定义字段名时读写该字段，并显示草稿里的当前选择', async () => {
    const fake = makeConfigFormScope({
      value: { guiInputSetsLocal: true, larkInputSetsRemote: true, taskPreset: 'sa-dispatch' },
    });
    const form = new TaskConfigForm(fake.scope);
    const injected = form.inject();
    const presets = new PresetDefaults(
      { on: () => () => undefined } as never,
      injected.hooks.taskConfig,
      injected.edit,
      'taskPreset',
      { list: async () => ({ ok: true, value: { presets: [{ id: 'sa-dispatch' }] } }) },
    );
    await presets.load(true);
    expect(presets.inject().hooks.presetDefaults.getSnapshot().current).toBe('sa-dispatch');
    presets.inject().select('other');
    expect(injected.hooks.taskConfig.getSnapshot().taskPreset.text).toBe('other');
    expect(fake.writes).toEqual([]);
    form.dispose();
  });

  it('缺少远程命名空间时进入 noService', async () => {
    const { presets } = setup();
    await presets.load();
    expect(presets.inject().hooks.presetDefaults.getSnapshot().status).toBe('noService');
  });

  it('排除列表把预设移出可选项，其余条目保留', async () => {
    const list = vi.fn(async () => ({
      ok: true as const,
      value: {
        presets: [
          { id: 'sa-dispatch', name: 'SA-调度会话' },
          { id: 'worker', name: 'W' },
        ],
      },
    }));
    const { presets } = setup({ list }, '', 'taskPreset', ['sa-dispatch']);
    await presets.load(true);
    const state = presets.inject().hooks.presetDefaults.getSnapshot();
    expect(state.status).toBe('ready');
    expect(state.rows.map((row) => row.id)).toEqual(['worker']);
  });

  it('未提供排除列表时名册保持原样', async () => {
    const list = vi.fn(async () => ({
      ok: true as const,
      value: { presets: [{ id: 'sa-dispatch' }] },
    }));
    const { presets } = setup({ list });
    await presets.load(true);
    expect(
      presets
        .inject()
        .hooks.presetDefaults.getSnapshot()
        .rows.map((row) => row.id),
    ).toEqual(['sa-dispatch']);
  });

  it('已存的排除预设值保留在草稿与当前选择中', async () => {
    const fake = makeConfigFormScope({
      value: { guiInputSetsLocal: true, larkInputSetsRemote: true, taskPreset: 'sa-dispatch' },
    });
    const form = new TaskConfigForm(fake.scope);
    const injected = form.inject();
    const presets = new PresetDefaults(
      { on: () => () => undefined } as never,
      injected.hooks.taskConfig,
      injected.edit,
      'taskPreset',
      { list: async () => ({ ok: true, value: { presets: [{ id: 'worker' }] } }) },
      ['sa-dispatch'],
    );
    await presets.load(true);
    const state = presets.inject().hooks.presetDefaults.getSnapshot();
    expect(state.current).toBe('sa-dispatch');
    expect(state.rows.map((row) => row.id)).toEqual(['worker']);
    expect(injected.hooks.taskConfig.getSnapshot().taskPreset.text).toBe('sa-dispatch');
    expect(fake.writes).toEqual([]);
    form.dispose();
  });

  it('gateway 不可用映射为 noService', async () => {
    const list = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'gateway/invocation-unavailable', message: 'offline' },
    }));
    const { presets } = setup({ list });
    await presets.load(true);
    expect(presets.inject().hooks.presetDefaults.getSnapshot().status).toBe('noService');
  });

  it('读取失败进入 error 并保留已存值', async () => {
    const list = vi.fn(async () => ({
      ok: false as const,
      error: { code: 'x', message: '失败了' },
    }));
    const { presets } = setup({ list }, 'saved');
    await presets.load(true);
    const state = presets.inject().hooks.presetDefaults.getSnapshot();
    expect(state.status).toBe('error');
    expect(state.error).toBe('失败了');
    expect(state.current).toBe('saved');
  });

  it('attach 后读取一次名册', async () => {
    const list = vi.fn(async () => ({ ok: true as const, value: { presets: [] } }));
    const { presets } = setup();
    presets.attach({ list });
    await settle();
    expect(list).toHaveBeenCalledTimes(1);
  });
});
