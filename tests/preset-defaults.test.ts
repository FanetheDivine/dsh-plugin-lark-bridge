// 预设目录测试：名册读取、损坏过滤、无服务、失败重试与草稿写入。
import { describe, expect, it, vi } from 'vitest';

import { PluginConfigForm } from '../src/client/config-form.ts';
import { PresetDefaults, type PresetRemoteLike } from '../src/client/preset-defaults.ts';
import { makeConfigFormScope } from './helpers.ts';

/** 构造目录依赖的客户端 ctx 与配置表单。 */
function setup(remote?: PresetRemoteLike, preset = '') {
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
    remote,
  );
  return { presets, injected, fake };
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

  it('缺少远程命名空间时进入 noService', async () => {
    const { presets } = setup();
    await presets.load();
    expect(presets.inject().hooks.presetDefaults.getSnapshot().status).toBe('noService');
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
