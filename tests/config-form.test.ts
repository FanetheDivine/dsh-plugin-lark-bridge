// 配置页草稿模型测试：单字段校验、路径归一化、保存写操作与卸载。
import { describe, expect, expectTypeOf, it } from 'vitest';

import {
  type ConfigFields,
  type ConfigFormState,
  PluginConfigForm,
  ROW_ID,
  ROW_KEY,
} from '../src/client/config-form.ts';
import { makeConfigFormScope } from './helpers.ts';

/** 默认配置值。 */
const DEFAULTS: ConfigFields = {
  workspaceRoot: 'C:/work',
  sessionProvider: '',
  sessionModel: '',
  sessionEffort: '',
  sessionPreset: '',
};

/** 构造表单与状态读取器。 */
function setup(overrides: Partial<ConfigFields> = {}, user?: unknown) {
  const value = { ...DEFAULTS, ...overrides };
  const fake = makeConfigFormScope<ConfigFields>({ value, base: DEFAULTS, user });
  const form = new PluginConfigForm(fake.scope);
  return { fake, form, state: () => form.inject().hooks.configForm.getSnapshot() };
}

describe('配置页常量', () => {
  it('行键与命名空间与宿主配置一致', () => {
    expect(ROW_KEY).toBe('dsh-plugin-lark-bridge#dsh-plugin-lark-bridge');
    expect(ROW_ID).toBe('dsh-plugin-lark-bridge');
  });
});

describe('配置页草稿', () => {
  it('只包含工作区字段，读取时归一化为 Linux 风格路径', () => {
    const { state } = setup({ workspaceRoot: 'C:\\work\\demo\\Lark' });
    const current = state();
    expect(current.workspaceRoot.text).toBe('/c/work/demo/Lark');
    expect(current.dirty).toBe(false);
    expect(current.invalid).toBe(false);
    expectTypeOf<ConfigFields>().toEqualTypeOf<{
      workspaceRoot: string;
      sessionProvider: string;
      sessionModel: string;
      sessionEffort: string;
      sessionPreset: string;
    }>();
    expectTypeOf<keyof ConfigFormState>().toEqualTypeOf<
      | 'available'
      | 'writable'
      | 'dirty'
      | 'invalid'
      | 'saving'
      | 'failed'
      | 'workspaceRoot'
      | 'sessionProvider'
      | 'sessionModel'
      | 'sessionEffort'
      | 'sessionPreset'
    >();
  });

  it('命名空间未下发时不渲染控件', () => {
    const fake = makeConfigFormScope<ConfigFields>({ status: 'unavailable' });
    const form = new PluginConfigForm(fake.scope);
    const current: ConfigFormState = form.inject().hooks.configForm.getSnapshot();
    expect(current.available).toBe(false);
  });

  it('相对工作区路径被拒绝', async () => {
    const { fake, form, state } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', 'relative/path');
    expect(state().workspaceRoot.invalid).toBe(true);
    expect(state().invalid).toBe(true);
    await actions.save();
    expect(fake.writes).toEqual([]);
  });

  it('模型与预设字段按文本写入', async () => {
    const { fake, form, state } = setup();
    const actions = form.inject();
    actions.edit('sessionProvider', ' deepseek ');
    actions.edit('sessionModel', 'deepseek-chat');
    actions.edit('sessionEffort', 'high');
    actions.edit('sessionPreset', 'bridge');
    expect(state().sessionProvider.text).toBe(' deepseek ');
    expect(state().sessionPreset.text).toBe('bridge');
    await actions.save();
    expect(fake.writes).toEqual([
      [
        { op: 'set', path: ['sessionProvider'], value: 'deepseek' },
        { op: 'set', path: ['sessionModel'], value: 'deepseek-chat' },
        { op: 'set', path: ['sessionEffort'], value: 'high' },
        { op: 'set', path: ['sessionPreset'], value: 'bridge' },
      ],
    ]);
  });

  it('状态不包含已移除的配置字段', () => {
    const { state } = setup();
    expect(state()).not.toHaveProperty('profile');
    expect(state()).not.toHaveProperty('ownerOpenId');
    expect(state()).not.toHaveProperty('larkCli');
    expect(state()).not.toHaveProperty('sessionTitle');
    expect(state()).not.toHaveProperty('authCheckOnStartup');
  });
});

describe('配置页保存', () => {
  it('只写入工作区并保存归一化路径', async () => {
    const { fake, form } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', '  C:\\work\\demo\\Other  ');
    await actions.save();
    expect(fake.writes).toEqual([
      [{ op: 'set', path: ['workspaceRoot'], value: '/c/work/demo/Other' }],
    ]);
  });

  it('恢复默认只提交工作区清除操作', async () => {
    const { fake, form, state } = setup({}, { workspaceRoot: 'C:\\work\\demo\\Custom' });
    const actions = form.inject();
    expect(state().workspaceRoot.overridden).toBe(true);
    actions.resetField('workspaceRoot');
    expect(state().workspaceRoot.text).toBe('/c/work');
    await actions.save();
    expect(fake.writes).toEqual([[{ op: 'unset', path: ['workspaceRoot'] }]]);
  });

  it('放弃草稿回到归一化的宿主值', () => {
    const { form, state } = setup({ workspaceRoot: 'C:\\work\\demo\\Host' });
    const actions = form.inject();
    actions.edit('workspaceRoot', '/tmp/draft');
    expect(state().dirty).toBe(true);
    actions.discard();
    expect(state().dirty).toBe(false);
    expect(state().workspaceRoot.text).toBe('/c/work/demo/Host');
  });

  it('只读部署不写入', async () => {
    const fake = makeConfigFormScope<ConfigFields>({ value: DEFAULTS, writable: false });
    const form = new PluginConfigForm(fake.scope);
    const actions = form.inject();
    actions.edit('workspaceRoot', '/tmp/draft');
    await actions.save();
    expect(fake.writes).toEqual([]);
  });
});

describe('配置页卸载', () => {
  it('卸载后宿主快照变化不再更新状态', () => {
    const { fake, form, state } = setup();
    const before = state();
    form.dispose();
    fake.publish({ value: { workspaceRoot: '/tmp/gone' } });
    expect(state()).toBe(before);
  });
});
