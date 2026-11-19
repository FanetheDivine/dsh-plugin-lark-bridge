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
  larkCli: '',
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
    expect(current.larkCli.text).toBe('');
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

  it('相对工作区与空白标题被拒绝', () => {
    const { form, state } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', 'relative/path');
    actions.edit('sessionTitle', '   ');
    expect(state().workspaceRoot.invalid).toBe(true);
    expect(state().sessionTitle.invalid).toBe(true);
    expect(state().invalid).toBe(true);
  });

  it('状态不再包含档案名与 open_id 字段', () => {
    const { state } = setup();
    expect(state()).not.toHaveProperty('profile');
    expect(state()).not.toHaveProperty('ownerOpenId');
  });
});

describe('配置页保存', () => {
  it('一次写入多个字段并去掉首尾空白', async () => {
    const { fake, form } = setup();
    const actions = form.inject();
    actions.edit('workspaceRoot', '  D:/other  ');
    actions.edit('sessionTitle', '  桥  ');
    actions.edit('larkCli', '  D:/tools/lark-cli.exe  ');
    actions.edit('authCheckOnStartup', 'false');
    await actions.save();
    expect(fake.writes).toEqual([
      [
        { op: 'set', path: ['workspaceRoot'], value: 'D:/other' },
        { op: 'set', path: ['sessionTitle'], value: '桥' },
        { op: 'set', path: ['larkCli'], value: 'D:/tools/lark-cli.exe' },
        { op: 'set', path: ['authCheckOnStartup'], value: false },
      ],
    ]);
  });

  it('恢复默认提交清除操作', async () => {
    const { fake, form, state } = setup({}, { larkCli: 'other' });
    const actions = form.inject();
    expect(state().larkCli.overridden).toBe(true);
    actions.resetField('larkCli');
    expect(state().larkCli.text).toBe('');
    await actions.save();
    expect(fake.writes).toEqual([[{ op: 'unset', path: ['larkCli'] }]]);
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
