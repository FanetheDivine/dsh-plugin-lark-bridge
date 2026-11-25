// @vitest-environment jsdom
// 在场按钮前端测试：控制器可用性、隐藏页、按钮图标与文案、槽位挂载。
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store';
import type { ModelDirectoryState } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/directory.ts';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

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

import type { ApiResult, PresenceStatus } from '../src/client/api.ts';
import { apply } from '../src/client/index.ts';
import { type NS, zh } from '../src/client/locales.ts';
import type { ModelDefaultsInjected } from '../src/client/model-defaults.ts';
import { PRESENCE_SLOT_ID, PresenceButton, presenceLabel } from '../src/client/presence-button.tsx';
import {
  type PresenceConfigFields,
  PresenceConfigForm,
  PresenceConfigPage,
  type PresenceConfigPageProps,
  type PresenceConfigState,
  presenceSwitchField,
} from '../src/client/presence-config.tsx';
import { PresenceController } from '../src/client/presence-controller.ts';
import { makeClientCtx, makeConfigFormScope } from './helpers.ts';

// React 18 的 act 环境标记，Radix Portal 的异步渲染也走 act。
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

/** 中文翻译座。 */
const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

const ok = (presence: 'local' | 'remote'): ApiResult<PresenceStatus> => ({
  ok: true,
  data: { presence, updatedAt: 1 },
});
const fail = (code: string): ApiResult<PresenceStatus> => ({
  ok: false,
  error: { code, message: code },
});

/** 构造不自动轮询的控制器。 */
function controllerWith(
  replies: ApiResult<PresenceStatus>[],
  hidden = () => false,
  write: (presence: 'local' | 'remote') => Promise<ApiResult<PresenceStatus>> = async (presence) =>
    ok(presence),
) {
  const fetchPresence = vi.fn(async () => replies.shift() ?? fail('network'));
  const writePresence = vi.fn(write);
  return {
    controller: new PresenceController({
      autoStart: false,
      fetchPresence,
      writePresence,
      hidden,
    }),
    fetchPresence,
    writePresence,
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('PresenceController', () => {
  it('成功回答置为可用并同步状态', async () => {
    const { controller } = controllerWith([ok('remote')]);
    await controller.refresh();
    expect(controller.getSnapshot()).toEqual({
      available: true,
      presence: 'remote',
      failed: false,
    });
  });

  it('invalid-response 置为不可用，network 保持原值', async () => {
    const { controller } = controllerWith([ok('local'), fail('network'), fail('invalid-response')]);
    await controller.refresh();
    await controller.refresh();
    expect(controller.getSnapshot().available).toBe(true);
    await controller.refresh();
    expect(controller.getSnapshot().available).toBe(false);
  });

  it('页面隐藏时不请求', async () => {
    const { controller, fetchPresence } = controllerWith([ok('local')], () => true);
    await controller.refresh();
    expect(fetchPresence).not.toHaveBeenCalled();
    expect(controller.getSnapshot().available).toBeNull();
  });

  it('内容未变时不通知订阅者', async () => {
    const { controller } = controllerWith([ok('local'), ok('local')]);
    const listener = vi.fn();
    controller.subscribe(listener);
    await controller.refresh();
    await controller.refresh();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('PresenceController.toggle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('立即显示目标状态，写入成功后以回答为准', async () => {
    let resolve!: (value: ApiResult<PresenceStatus>) => void;
    const { controller, writePresence } = controllerWith(
      [],
      () => false,
      () => new Promise((done) => (resolve = done)),
    );
    const pending = controller.toggle();
    expect(controller.getSnapshot().presence).toBe('remote');
    expect(writePresence).toHaveBeenCalledWith('remote');
    resolve(ok('remote'));
    await pending;
    expect(controller.getSnapshot()).toEqual({
      available: true,
      presence: 'remote',
      failed: false,
    });
  });

  it('写入期间跳过轮询', async () => {
    let resolve!: (value: ApiResult<PresenceStatus>) => void;
    const { controller, fetchPresence } = controllerWith(
      [ok('local')],
      () => false,
      () => new Promise((done) => (resolve = done)),
    );
    const pending = controller.toggle();
    await controller.refresh();
    expect(fetchPresence).not.toHaveBeenCalled();
    resolve(ok('remote'));
    await pending;
  });

  it('失败时恢复原状态并保持 3 秒错误态', async () => {
    vi.useFakeTimers();
    const { controller } = controllerWith(
      [],
      () => false,
      async () => fail('network'),
    );
    await controller.toggle();
    expect(controller.getSnapshot()).toMatchObject({ presence: 'local', failed: true });
    vi.advanceTimersByTime(2999);
    expect(controller.getSnapshot().failed).toBe(true);
    vi.advanceTimersByTime(1);
    expect(controller.getSnapshot().failed).toBe(false);
  });
});

describe('PresenceButton', () => {
  it('在电脑旁显示显示器与对应文案', () => {
    const { controller } = controllerWith([]);
    const html = renderToStaticMarkup(createElement(PresenceButton, { wide: true, t, controller }));
    expect(html).toContain('data-presence="local"');
    expect(html).toContain('<rect x="3" y="4" width="18" height="12" rx="2"></rect>');
    expect(html).not.toContain('title="在电脑旁 · 点击切换为离开"');
    expect(html).toContain('aria-label="在电脑旁 · 点击切换为离开"');
    expect(html).not.toContain('data-rail');
  });

  it('离开时显示手机，折叠栏带 rail 标记', async () => {
    const { controller } = controllerWith([ok('remote')]);
    await controller.refresh();
    const html = renderToStaticMarkup(
      createElement(PresenceButton, { wide: false, t, controller }),
    );
    expect(html).toContain('data-presence="remote"');
    expect(html).toContain('<rect x="7" y="2.5" width="10" height="19" rx="2.5"></rect>');
    expect(html).not.toContain('title="离开 · 点击切换为在电脑旁"');
    expect(html).toContain('data-rail="rail"');
  });

  it('失败时显示错误色与重试文案', async () => {
    const { controller } = controllerWith(
      [],
      () => false,
      async () => fail('network'),
    );
    await controller.toggle();
    const html = renderToStaticMarkup(createElement(PresenceButton, { wide: true, t, controller }));
    expect(html).toContain('color:var(--dsw-alias-state-error-primary)');
    expect(html).not.toContain('title="切换失败，点击重试"');
    controller.dispose();
  });

  /** 挂载页脚按钮，返回容器、根与按钮。 */
  async function mountButton(controller: PresenceController): Promise<{
    root: ReturnType<typeof createRoot>;
    button: HTMLButtonElement;
  }> {
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(PresenceButton, { wide: true, t, controller }));
    });
    const button = container.querySelector('button');
    if (button === null) throw new Error('presence button missing');
    return { root, button };
  }

  /** 等待零延迟工具提示完成一次渲染。 */
  async function settle(): Promise<void> {
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }

  it('悬停立即展示页面内提示，移出后收起', async () => {
    const { controller } = controllerWith([]);
    const { root, button } = await mountButton(controller);
    await act(async () => {
      button.dispatchEvent(new MouseEvent('pointermove', { bubbles: true }));
    });
    await settle();
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toBe('在电脑旁 · 点击切换为离开');
    expect(tooltip?.getAttribute('data-side')).toBe('top');
    expect(button.getAttribute('aria-describedby')).not.toBeNull();

    await act(async () => {
      button.dispatchEvent(
        new MouseEvent('pointerout', { bubbles: true, relatedTarget: document.body }),
      );
    });
    await settle();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => {
      root.unmount();
    });
    controller.dispose();
  });

  it('键盘聚焦立即展示提示，失焦后收起', async () => {
    const { controller } = controllerWith([]);
    const { root, button } = await mountButton(controller);
    await act(async () => {
      button.focus();
    });
    await settle();
    const tooltip = document.querySelector('[role="tooltip"]');
    expect(tooltip?.textContent).toBe('在电脑旁 · 点击切换为离开');

    await act(async () => {
      button.blur();
    });
    await settle();
    expect(document.querySelector('[role="tooltip"]')).toBeNull();
    await act(async () => {
      root.unmount();
    });
    controller.dispose();
  });

  it('失败文案优先', () => {
    expect(presenceLabel(t, { presence: 'local', failed: true })).toBe('切换失败，点击重试');
  });
});

describe('页脚槽位挂载', () => {
  /** 当前生效的页脚按钮注册。 */
  function footer(ctx: ReturnType<typeof makeClientCtx>) {
    return [...ctx._activeSlots].filter((entry) => entry.options.name === 'sidebar.footer.action');
  }

  /** 让 fetch 对在场路由返回指定回答。 */
  function stubPresence(reply: () => Response | Promise<Response>) {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) =>
        String(url).endsWith('/lark-bridge/presence')
          ? reply()
          : new Response(JSON.stringify({ ok: false, error: { code: 'x', message: 'x' } })),
      ),
    );
  }

  it('路由回答在场状态时挂载，返回 HTML 时卸载', async () => {
    let body = JSON.stringify({ ok: true, data: { presence: 'local', updatedAt: 1 } });
    stubPresence(() => new Response(body));
    const ctx = makeClientCtx();
    apply(ctx);
    await vi.waitFor(() => expect(footer(ctx)).toHaveLength(1));
    expect(footer(ctx)[0]?.options).toMatchObject({
      id: PRESENCE_SLOT_ID,
      order: 52,
    });
    expect(document.head.querySelector('style[data-plugin-css$="presence rail"]')).not.toBeNull();

    body = '<!doctype html><html></html>';
    window.dispatchEvent(new Event('focus'));
    await vi.waitFor(() => expect(footer(ctx)).toHaveLength(0));
    expect(document.head.querySelector('style[data-plugin-css$="presence rail"]')).toBeNull();
    ctx._dispose();
  });

  it('网络失败时不挂载', async () => {
    stubPresence(() => Promise.reject(new TypeError('offline')));
    const ctx = makeClientCtx();
    apply(ctx);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(footer(ctx)).toHaveLength(0);
    ctx._dispose();
  });
});

/** 渲染配置页时的模型目录注入桩。 */
function modelDefaultsStub(): ModelDefaultsInjected {
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
    resolveText: (text) => String(text),
  };
}

describe('在场开关配置页', () => {
  /** 构造开关表单。 */
  function setupForm(value: Partial<PresenceConfigFields> = {}) {
    const fake = makeConfigFormScope<PresenceConfigFields>({
      value: { guiInputSetsLocal: true, larkInputSetsRemote: true, ...value },
    });
    const form = new PresenceConfigForm(fake.scope);
    return { fake, form, state: () => form.inject().hooks.presenceConfig.getSnapshot() };
  }

  it('布尔字段以 true/false 文本暂存，其他文本无效', () => {
    const spec = presenceSwitchField('guiInputSetsLocal');
    expect(spec.format(false)).toBe('false');
    expect(spec.format(undefined)).toBe('true');
    expect(spec.parse('false')).toEqual({ kind: 'set', value: false });
    expect(spec.parse('true')).toEqual({ kind: 'set', value: true });
    expect(spec.parse('no')).toBeUndefined();
  });

  it('关闭开关后保存写入 false', async () => {
    const { fake, form, state } = setupForm();
    expect(state().larkInputSetsRemote.text).toBe('true');
    const actions = form.inject();
    actions.edit('larkInputSetsRemote', 'false');
    await actions.save();
    expect(fake.writes).toEqual([[{ op: 'set', path: ['larkInputSetsRemote'], value: false }]]);
    form.dispose();
  });

  it('工作会话模型三个字段成组保存，空值保存为空串', async () => {
    const { fake, form, state } = setupForm({
      workerProvider: 'deepseek',
      workerModel: 'deepseek-chat',
      workerEffort: 'high',
    });
    expect(state().workerModel.text).toBe('deepseek-chat');
    const actions = form.inject();
    actions.edit('workerProvider', 'other');
    actions.edit('workerModel', 'big');
    actions.edit('workerEffort', '');
    await actions.save();
    const ops = fake.writes.flat();
    expect(ops).toContainEqual({ op: 'set', path: ['workerProvider'], value: 'other' });
    expect(ops).toContainEqual({ op: 'set', path: ['workerModel'], value: 'big' });
    form.dispose();
  });

  it('页面渲染两个开关，摘要视图只给文案', () => {
    const { form } = setupForm({ guiInputSetsLocal: false });
    const injected = form.inject();
    const props = {
      t,
      view: 'page',
      usePresenceConfig: <S>(selector: (state: PresenceConfigState) => S) =>
        selector(injected.hooks.presenceConfig.getSnapshot()),
      ...injected,
      modelDefaults: modelDefaultsStub(),
      controller: new PresenceController({ autoStart: false }),
    } as unknown as PresenceConfigPageProps;
    const html = renderToStaticMarkup(createElement(PresenceConfigPage, props));
    expect(html).toContain('网页输入时切换为在电脑旁');
    expect(html).toContain('收到飞书消息时切换为离开');
    expect(html).toContain('data-dsh-lark-presence-config="guiInputSetsLocal"');
    expect(html).toContain('data-dsh-lark-config-model="worker"');
    expect(html).toContain('data-dsh-lark-model-select');
    expect(html).toContain('工作会话模型');
    expect(html).toContain('「用飞书和DSH对话」配置页的「模型」');
    const summary = renderToStaticMarkup(
      createElement(PresenceConfigPage, { ...props, view: 'summary' }),
    );
    expect(summary).toBe('在场状态的自动更新');
    form.dispose();
  });
});
