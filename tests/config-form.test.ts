// 配置页草稿模型测试：字段校验、保存写操作、恢复默认、放弃与卸载。
import { describe, expect, it } from 'vitest';

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
  workspaceRoot: 'D:/work',
  sessionTitle: '飞书',
  profile: 'dsh-lark-bridge',
  larkCli: '',
  ownerOpenId: '',
  authCheckOnStartup: true,
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
  it('草稿来自宿主值，起初不脏也没有非法值', () => {
    const { state } = setup();
    const current = state();
    expect(current.workspaceRoot.text).toBe('D:/work');
    expect(current.sessionTitle.text).toBe('飞书');
    expect(current.profile.text).toBe('dsh-lark-bridge');
    expect(current.authCheckOnStartup.text).toBe('true');
    expect(current.dirty).toBe(false);
    expect(current.invalid).toBe(false);
  });

  it('命名空间未下发时不渲染控件', () => {
    const fake = makeConfigFormScope<ConfigFields>({ status: 'unavailable' });
    const form = new PluginConfigForm(fake.scope);
    const current: ConfigFormState = form.inject().hooks.configForm.getSnapshot();
    expect(current.available).toBe(false);
  });

  it('相对工作区、空白标题与非法档案名被拒绝', () => {
    const { form, state } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', 'relative/path');
    actions.edit('sessionTitle', '   ');
    actions.edit('profile', 'bad profile');
    expect(state().workspaceRoot.invalid).toBe(true);
    expect(state().sessionTitle.invalid).toBe(true);
    expect(state().profile.invalid).toBe(true);
    expect(state().invalid).toBe(true);
  });

  it('非法 open_id 被拒绝', () => {
    const { form, state } = setup();
    form.inject().edit('ownerOpenId', 'abc');
    expect(state().ownerOpenId.invalid).toBe(true);
    form.inject().edit('ownerOpenId', '');
    expect(state().ownerOpenId.invalid).toBe(false);
  });
});

describe('配置页保存', () => {
  it('一次写入多个字段并去掉首尾空白', async () => {
    const { fake, form } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', '  D:/other  ');
    actions.edit('sessionTitle', '  桥  ');
    actions.edit('profile', 'other');
    actions.edit('authCheckOnStartup', 'false');
    await actions.save();
    expect(fake.writes).toEqual([
      [
        { op: 'set', path: ['workspaceRoot'], value: 'D:/other' },
        { op: 'set', path: ['sessionTitle'], value: '桥' },
        { op: 'set', path: ['profile'], value: 'other' },
        { op: 'set', path: ['authCheckOnStartup'], value: false },
      ],
    ]);
  });

  it('恢复默认提交清除操作', async () => {
    const { fake, form, state } = setup({}, { profile: 'other' });
    const actions = form.inject();
    expect(state().profile.overridden).toBe(true);
    actions.resetField('profile');
    expect(state().profile.text).toBe('dsh-lark-bridge');
    await actions.save();
    expect(fake.writes).toEqual([[{ op: 'unset', path: ['profile'] }]]);
  });

  it('放弃草稿回到宿主值', () => {
    const { form, state } = setup();
    const actions = form.inject();
    actions.edit('sessionTitle', '临时');
    expect(state().dirty).toBe(true);
    actions.discard();
    expect(state().dirty).toBe(false);
    expect(state().sessionTitle.text).toBe('飞书');
  });

  it('只读部署不写入', async () => {
    const fake = makeConfigFormScope<ConfigFields>({ value: DEFAULTS, writable: false });
    const form = new PluginConfigForm(fake.scope);
    const actions = form.inject();
    actions.edit('sessionTitle', '临时');
    await actions.save();
    expect(fake.writes).toEqual([]);
  });
});

describe('配置页卸载', () => {
  it('卸载后宿主快照变化不再更新状态', () => {
    const { fake, form, state } = setup();
    const before = state();
    form.dispose();
    fake.publish({ value: { ...DEFAULTS, sessionTitle: 'gone' } });
    expect(state()).toBe(before);
  });
});
