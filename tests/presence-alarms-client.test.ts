// @vitest-environment jsdom
// 自动切换时间配置测试：字段暂存、分区渲染、条目交互、弹窗与节假日提示。
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/directory.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type NS, zh } from '../src/client/locales.ts';
import {
  ALARMS_FIELD,
  type PresenceConfigFields,
  PresenceConfigForm,
  PresenceConfigPage,
  type PresenceConfigPageProps,
  type PresenceConfigState,
  presenceAlarmsField,
} from '../src/client/presence-config.tsx';
import { PresenceController } from '../src/client/presence-controller.ts';
import type { PresetDefaultsInjected, PresetDefaultsState } from '../src/client/preset-defaults.ts';
import { formatAlarmList, type PresenceAlarm } from '../src/lark-super-agent/alarms.ts';
import { makeConfigFormScope } from './helpers.ts';

vi.mock('@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx', async () => {
  const { createElement } = await import('react');
  return {
    ModelSelect: (props: { locked: boolean }) =>
      createElement('div', {
        'data-dsh-lark-model-select': '',
        'data-locked': String(props.locked),
      }),
  };
});

/** 中文翻译座。 */
const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

/** 构造一条闹钟。 */
function alarm(overrides: Partial<PresenceAlarm> = {}): PresenceAlarm {
  return {
    id: 'a1',
    time: '09:00',
    action: 'local',
    enabled: true,
    skipWeekends: true,
    skipHolidays: true,
    ...overrides,
  };
}

/** 构造不轮询的在场状态控制器。 */
function controllerWith(state: 'fresh' | 'stale' | 'missing' = 'fresh') {
  const controller = new PresenceController({
    autoStart: false,
    fetchPresence: async () => ({
      ok: true,
      data: { presence: 'local', updatedAt: 1, holidays: { state, fetchedAt: 1 } },
    }),
  });
  return controller;
}

/** 模型选择器注入桩。 */
function modelDefaultsStub() {
  return {
    directory: createSnapshotStore<ModelDirectoryState>({
      current: null,
      routable: null,
      groups: [],
      failures: [],
      status: 'ready',
      pending: null,
      error: null,
    }),
    load: () => undefined,
    select: async () => ({ ok: true, value: undefined }),
    t: ((key: string) => key) as never,
    resolveText: (text: string) => String(text),
  };
}

/** 预设名册注入桩。 */
function presetDefaultsStub(): PresetDefaultsInjected {
  const store = createSnapshotStore<PresetDefaultsState>({
    status: 'ready',
    error: null,
    rows: [],
    current: '',
  });
  return { hooks: { presetDefaults: store }, load: () => undefined, select: () => undefined };
}

/** 构造表单与页面 props。 */
async function setup(
  value: Partial<PresenceConfigFields> = {},
  holidays: 'fresh' | 'stale' | 'missing' = 'fresh',
) {
  const fake = makeConfigFormScope<PresenceConfigFields>({
    value: { guiInputSetsLocal: true, larkInputSetsRemote: true, ...value },
  });
  const form = new PresenceConfigForm(fake.scope);
  const controller = controllerWith(holidays);
  await controller.refresh();
  const injected = form.inject();
  const edit = vi.fn((field: string, text: string) => {
    injected.edit(field, text);
  });
  const props = {
    t,
    view: 'page',
    usePresenceConfig: <S>(selector: (state: PresenceConfigState) => S) =>
      selector(injected.hooks.presenceConfig.getSnapshot()),
    ...injected,
    edit,
    modelDefaults: modelDefaultsStub(),
    presetDefaults: presetDefaultsStub(),
    controller,
  } as unknown as PresenceConfigPageProps;
  return {
    fake,
    form,
    controller,
    props,
    edit,
    state: () => injected.hooks.presenceConfig.getSnapshot(),
  };
}

// React 18 的 act 需要显式声明测试环境。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

afterEach(() => {
  document.body.innerHTML = '';
});

describe('presenceAlarmsField', () => {
  it('把配置值格式化为规范化 JSON，空列表为空串', () => {
    const spec = presenceAlarmsField();
    expect(spec.format(undefined)).toBe('');
    expect(spec.format([])).toBe('');
    expect(spec.format([alarm({ time: '18:00', action: 'remote' }), alarm()])).toBe(
      formatAlarmList([alarm({ time: '18:00', action: 'remote' }), alarm()]),
    );
  });

  it('解析合法 JSON，空串为清空，非法文本无效', () => {
    const spec = presenceAlarmsField();
    expect(spec.parse('')).toEqual({ kind: 'clear' });
    expect(spec.parse(formatAlarmList([alarm()]))).toEqual({
      kind: 'set',
      value: [alarm()],
    });
    expect(spec.parse('{')).toBeUndefined();
  });
});

describe('闹钟表单', () => {
  it('保存写入规范化后的条目列表', async () => {
    const { fake, form } = await setup();
    const actions = form.inject();
    actions.edit(
      ALARMS_FIELD,
      JSON.stringify([
        { id: 'b', time: '18:00', action: 'remote', enabled: true, skipWeekends: false },
        { id: 'a', time: '09:00', action: 'local' },
      ]),
    );
    await actions.save();
    const ops = fake.writes.flat();
    expect(ops).toContainEqual({
      op: 'set',
      path: [ALARMS_FIELD],
      value: [
        {
          id: 'a',
          time: '09:00',
          action: 'local',
          enabled: true,
          skipWeekends: true,
          skipHolidays: true,
        },
        {
          id: 'b',
          time: '18:00',
          action: 'remote',
          enabled: true,
          skipWeekends: false,
          skipHolidays: true,
        },
      ],
    });
    form.dispose();
  });

  it('清空全部条目时写入 unset', async () => {
    const { fake, form } = await setup({
      presenceAlarms: [alarm()],
    });
    const actions = form.inject();
    actions.edit(ALARMS_FIELD, '');
    await actions.save();
    expect(fake.writes.flat()).toContainEqual({ op: 'unset', path: [ALARMS_FIELD] });
    form.dispose();
  });
});

describe('配置页渲染', () => {
  it('两个分区各自展示条目与添加按钮', async () => {
    const { form, props } = await setup({
      presenceAlarms: [
        alarm({ id: 'a', time: '09:00', action: 'local' }),
        alarm({ id: 'b', time: '18:00', action: 'remote' }),
      ],
    });
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).toContain('自动切换在电脑旁的时间');
    expect(html).toContain('自动切换离开的时间');
    expect(html).toContain('data-dsh-lark-presence-config="alarms-local"');
    expect(html).toContain('data-dsh-lark-presence-config="alarms-remote"');
    expect(html).toContain('data-dsh-lark-alarm="a"');
    expect(html).toContain('data-dsh-lark-alarm="b"');
    expect(html).toContain('09:00');
    expect(html).toContain('18:00');
    expect(html).toContain('添加时间');
    expect(html).toContain('跳过周末');
    expect(html).toContain('跳过节假日');
    form.dispose();
  });

  it('空分区提示还没有时间点', async () => {
    const { form, props } = await setup();
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).toContain('还没有时间点');
    form.dispose();
  });

  it('节假日数据缺失且有条目跳过节假日时给出提示', async () => {
    const { form, props } = await setup(
      { presenceAlarms: [alarm({ skipHolidays: true })] },
      'missing',
    );
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).toContain('节假日数据获取失败');
    form.dispose();
  });

  it('节假日数据过期时提示使用缓存', async () => {
    const { form, props } = await setup({ presenceAlarms: [alarm()] }, 'stale');
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).toContain('正在使用上次缓存');
    form.dispose();
  });

  it('数据正常或不跳过节假日时不提示', async () => {
    const { form, props } = await setup(
      { presenceAlarms: [alarm({ skipHolidays: false })] },
      'missing',
    );
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).not.toContain('节假日数据获取失败');
    form.dispose();
  });
});

describe('条目交互', () => {
  /** 挂载页面并返回容器。 */
  async function mount(props: PresenceConfigPageProps) {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PresenceConfigPage, props));
    });
    return { container, root };
  }

  it('点击 x 移除条目并暂存新列表', async () => {
    const { form, props, edit } = await setup({
      presenceAlarms: [
        alarm({ id: 'a', time: '09:00', action: 'local' }),
        alarm({ id: 'b', time: '10:00', action: 'local' }),
      ],
    });
    const { container, root } = await mount(props);
    const row = container.querySelector('[data-dsh-lark-alarm="a"]');
    const remove = row?.querySelector('button[aria-label^="删除时间"]');
    await act(async () => {
      remove?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(edit).toHaveBeenCalledWith(
      ALARMS_FIELD,
      formatAlarmList([alarm({ id: 'b', time: '10:00', action: 'local' })]),
    );
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('点击跳过项切换该条设置', async () => {
    const { form, props, edit } = await setup({
      presenceAlarms: [alarm({ id: 'a', skipWeekends: true })],
    });
    const { container, root } = await mount(props);
    const row = container.querySelector('[data-dsh-lark-alarm="a"]');
    const skip = [...(row?.querySelectorAll('button') ?? [])].find(
      (button) => button.textContent === '跳过周末',
    );
    await act(async () => {
      skip?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(edit).toHaveBeenCalledWith(
      ALARMS_FIELD,
      formatAlarmList([alarm({ id: 'a', skipWeekends: false })]),
    );
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('停用条目整行呈现停用态', async () => {
    const { form, props } = await setup({
      presenceAlarms: [alarm({ id: 'a', enabled: false })],
    });
    const { container, root } = await mount(props);
    const row = container.querySelector('[data-dsh-lark-alarm="a"]');
    expect(row?.hasAttribute('data-off')).toBe(true);
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('点时间按钮打开编辑弹窗并回填该条设置', async () => {
    const { form, props } = await setup({
      presenceAlarms: [alarm({ id: 'a', time: '07:30', skipWeekends: false })],
    });
    const { container, root } = await mount(props);
    const open = container.querySelector('[data-dsh-lark-alarm="a"] .dsh-lark-alarm-time');
    await act(async () => {
      open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const editor = document.body.querySelector('[data-dsh-lark-alarm-editor]');
    expect(editor).not.toBeNull();
    const input = editor?.querySelector<HTMLInputElement>('[data-slot="time-picker-input"] input');
    expect(input?.value).toBe('07:30');
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('弹窗里的时钟按钮展开小时与分钟两列，选中小时即改时间', async () => {
    const { form, props } = await setup({
      presenceAlarms: [alarm({ id: 'a', time: '09:00' })],
    });
    const { container, root } = await mount(props);
    const open = container.querySelector('[data-dsh-lark-alarm="a"] .dsh-lark-alarm-time');
    await act(async () => {
      open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const trigger = document.body.querySelector('[data-slot="time-picker-input-trigger"]');
    await act(async () => {
      trigger?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const columns = document.body.querySelectorAll('[data-slot="time-picker-column"]');
    expect(columns).toHaveLength(2);
    const hourOption = [...document.body.querySelectorAll('[role="option"]')].find(
      (option) => option.textContent === '10',
    );
    await act(async () => {
      hourOption?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    const input = document.body.querySelector<HTMLInputElement>(
      '[data-slot="time-picker-input"] input',
    );
    expect(input?.value).toBe('10:00');
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('新增条目的默认时间与已有条目重合时提示重复并禁用确认', async () => {
    // 新条目默认取当前时间，因此把已有条目设成当前时间即触发重复。
    const now = new Date();
    const current = `${`${now.getHours()}`.padStart(2, '0')}:${`${now.getMinutes()}`.padStart(2, '0')}`;
    const { form, props } = await setup({
      presenceAlarms: [alarm({ id: 'a', time: current })],
    });
    const { container, root } = await mount(props);
    const open = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加时间'),
    );
    await act(async () => {
      open?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.textContent).toContain('该分区已有这个时间');
    const confirm = [...document.body.querySelectorAll('button')].find(
      (button) => button.textContent === '确认',
    );
    expect(confirm?.hasAttribute('disabled')).toBe(true);
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });

  it('点击添加打开弹窗', async () => {
    const { form, props } = await setup();
    const { container, root } = await mount(props);
    const add = [...container.querySelectorAll('button')].find((button) =>
      button.textContent?.includes('添加时间'),
    );
    await act(async () => {
      add?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(document.body.querySelector('[data-dsh-lark-alarm-editor]')).not.toBeNull();
    expect(document.body.textContent).toContain('添加时间');
    await act(async () => {
      root.unmount();
    });
    form.dispose();
  });
});
