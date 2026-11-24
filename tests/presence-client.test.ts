// @vitest-environment jsdom
// 在场按钮前端测试：控制器可用性、隐藏页、按钮图标与文案、槽位挂载。
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { ApiResult, PresenceStatus } from '../src/client/api.ts';
import { apply } from '../src/client/index.ts';
import { type NS, zh } from '../src/client/locales.ts';
import { PRESENCE_SLOT_ID, PresenceButton, presenceLabel } from '../src/client/presence-button.tsx';
import { PresenceController } from '../src/client/presence-controller.ts';
import { makeClientCtx } from './helpers.ts';

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
    expect(html).toContain('title="在电脑旁 · 点击切换为离开"');
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
    expect(html).toContain('title="离开 · 点击切换为在电脑旁"');
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
    expect(html).toContain('title="切换失败，点击重试"');
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
