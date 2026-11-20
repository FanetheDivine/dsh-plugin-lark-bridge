// 前端测试：入口接线、字典、安全连接状态展示与共享状态控制器。
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, beforeEach, describe, expect, expectTypeOf, it, vi } from 'vitest';

import type { ApiResult, BridgeStatus } from '../src/client/api.ts';
import { AuthOverlay } from '../src/client/auth-overlay.tsx';
import { AuthPanelStatus } from '../src/client/auth-panel.tsx';
import { ROW_ID, ROW_KEY } from '../src/client/config-form.ts';
import { ConfigPage } from '../src/client/config-page.tsx';
import * as clientEntry from '../src/client/index.ts';
import { en, NS, zh } from '../src/client/locales.ts';
import { StatusController } from '../src/client/status-controller.ts';
import type { ConnectionState } from '../src/types.ts';
import { type ClientServiceName, makeClientCtx } from './helpers.ts';

const { apply } = clientEntry;
const ALL_SERVICES: ClientServiceName[] = ['slots', 'locale', 'configForms'];
const CLI_COMMAND = 'npm install -g @larksuite/cli@latest';
const BOT_COMMAND = 'lark-cli config init';
const USER_COMMAND = 'lark-cli auth login --scope auth:user.id:read';

/** 用字典构造翻译函数。 */
function translate(dict: Record<string, string>): TranslateNS<typeof NS> {
  return (key, params) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(params?.[name] ?? ''),
    );
}

/** 构造只含浏览器安全字段的连接状态。 */
function statusFor(states: Partial<Pick<BridgeStatus, 'cli' | 'bot' | 'user'>> = {}): BridgeStatus {
  const cli = states.cli ?? 'connected';
  const bot = states.bot ?? 'connected';
  const user = states.user ?? 'connected';
  return {
    cli,
    bot,
    user,
    ready: cli === 'connected' && bot === 'connected' && user === 'connected',
    checkedAt: 1,
  };
}

/** 渲染连接状态面板。 */
function renderAuthPanel(status: BridgeStatus | undefined, busy = false): string {
  return renderToStaticMarkup(
    createElement(AuthPanelStatus, {
      t: translate(zh),
      status,
      busy,
      onCheck: vi.fn(),
    }),
  );
}

/** 构造成功的路由结果。 */
function ok(data: BridgeStatus): ApiResult<BridgeStatus> {
  return { ok: true, data };
}

/** 构造可手动完成的异步结果。 */
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

/** 等待路由结果与控制器状态更新。 */
async function flushPromises(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('前端入口', () => {
  it('不声明必需服务，字典与共享槽位分两组加载', () => {
    expect('inject' in clientEntry).toBe(false);
    const ctx = makeClientCtx();
    apply(ctx);
    expect(ctx._injectGroups).toEqual([['locale'], ['slots', 'locale', 'configForms']]);
  });

  it('注册双语字典、全局鉴权弹窗与面板配置页', () => {
    const ctx = makeClientCtx();
    apply(ctx);

    expect(ctx._localeRegistrations.map((entry) => entry.ns)).toEqual([NS]);
    expect(Object.keys(ctx._localeRegistrations[0]?.dicts ?? {}).sort()).toEqual(['en', 'zh']);
    expect(ctx._slotInjections).toEqual(['shell.overlay', 'plugins.row.config']);
    expect(ctx._slotRegistrations[0]?.options).toMatchObject({
      name: 'shell.overlay',
      id: 'lark-bridge-auth',
      order: 20,
      locale: NS,
    });
    expect(ctx._slotRegistrations[0]?.component).toBe(AuthOverlay);
    expect(ctx._slotRegistrations[1]?.options).toMatchObject({
      name: 'plugins.row.config',
      key: ROW_KEY,
      locale: NS,
    });
    expect(ctx._slotRegistrations[1]?.component).toBe(ConfigPage);
    expect(ctx._configFormRequests).toEqual([ROW_ID]);
    expect(ROW_KEY).toBe(`${ROW_ID}#${ROW_ID}`);
  });

  it('卸载时释放配置表单的订阅', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    const scope = ctx._configFormScopes[0];
    expect(scope?.subscriberCount()).toBe(1);
    ctx._dispose();
    expect(scope?.subscriberCount()).toBe(0);
  });
});

/** 某组服务可用时应注册的内容。 */
function expectedRegistrations(services: ClientServiceName[]) {
  const has = (...names: ClientServiceName[]) => names.every((name) => services.includes(name));
  return {
    dictionary: has('locale'),
    overlay: has('slots', 'locale', 'configForms'),
    configPage: has('slots', 'locale', 'configForms'),
  };
}

/** 当前生效的注册内容。 */
function activeRegistrations(ctx: ReturnType<typeof makeClientCtx>) {
  const slotNames = [...ctx._activeSlots].map((entry) => entry.options.name);
  return {
    dictionary: ctx._activeLocales.size === 1,
    overlay: slotNames.includes('shell.overlay'),
    configPage: slotNames.includes('plugins.row.config'),
  };
}

/** 三个服务各有或无的全部 8 种组合。 */
const COMBINATIONS: ClientServiceName[][] = Array.from({ length: 8 }, (_, mask) =>
  ALL_SERVICES.filter((_name, index) => (mask >> index) & 1),
);

describe('前端服务可选', () => {
  it.each(COMBINATIONS.map((services) => [services]))(
    '服务 %j 可用时启用成功，注册内容与可用性一一对应',
    (services) => {
      const ctx = makeClientCtx({ services });
      expect(() => apply(ctx)).not.toThrow();
      expect(activeRegistrations(ctx)).toEqual(expectedRegistrations(services));
    },
  );

  it('configForms 缺失时不请求配置表单', () => {
    const ctx = makeClientCtx({ services: ['slots', 'locale'] });
    apply(ctx);
    expect(ctx._configFormRequests).toEqual([]);
  });

  it('configForms 晚就绪后配置页自动注册', () => {
    const ctx = makeClientCtx({ services: ['slots', 'locale'] });
    apply(ctx);
    expect(activeRegistrations(ctx).configPage).toBe(false);
    ctx._grant('configForms');
    expect(activeRegistrations(ctx)).toEqual({ dictionary: true, overlay: true, configPage: true });
    expect(ctx._configFormRequests).toEqual([ROW_ID]);
  });

  it('服务撤掉后只清理依赖它的功能', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    const scope = ctx._configFormScopes[0];
    ctx._revoke('configForms');
    expect(activeRegistrations(ctx)).toEqual({
      dictionary: true,
      overlay: false,
      configPage: false,
    });
    expect(scope?.subscriberCount()).toBe(0);
    ctx._grant('configForms');
    expect(ctx._activeSlots.size).toBe(2);
    expect(ctx._activeLocales.size).toBe(1);
  });

  it('locale 撤掉后三项功能都被清理', () => {
    const ctx = makeClientCtx();
    apply(ctx);
    ctx._revoke('locale');
    expect(activeRegistrations(ctx)).toEqual({
      dictionary: false,
      overlay: false,
      configPage: false,
    });
  });
});

describe('连接状态展示', () => {
  it('BridgeStatus 只暴露三个连接状态、ready 与 checkedAt', () => {
    expectTypeOf<BridgeStatus>().toEqualTypeOf<{
      readonly cli: ConnectionState;
      readonly bot: ConnectionState;
      readonly user: ConnectionState;
      readonly ready: boolean;
      readonly checkedAt: number;
    }>();
    expect(Object.keys(statusFor()).sort()).toEqual(['bot', 'checkedAt', 'cli', 'ready', 'user']);
  });

  it('分别显示 checking、connected、disconnected 三种笼统状态', () => {
    const html = renderAuthPanel(
      statusFor({ cli: 'checking', bot: 'connected', user: 'disconnected' }),
    );
    expect(html).toContain('检测中');
    expect(html).toContain('已连接');
    expect(html).toContain('未连接');
  });

  it('三个区域各有一个检测按钮，忙碌时全部禁用', () => {
    const idle = renderAuthPanel(statusFor());
    expect(idle.match(/<button\b/g)).toHaveLength(3);
    expect(idle).not.toContain('disabled');

    const busy = renderAuthPanel(statusFor(), true);
    expect(busy.match(/<button\b/g)).toHaveLength(3);
    expect(busy.match(/<button\b[^>]*\bdisabled/g)).toHaveLength(3);
  });

  it('分别展示安装、机器人配置与用户登录的固定终端命令', () => {
    const html = renderAuthPanel(
      statusFor({ cli: 'disconnected', bot: 'disconnected', user: 'disconnected' }),
    );
    expect(html).toContain(CLI_COMMAND);
    expect(html).toContain(BOT_COMMAND);
    expect(html).toContain(USER_COMMAND);
    expect(html).not.toContain(`${CLI_COMMAND} &amp;&amp; ${BOT_COMMAND}`);
  });

  it('忽略 URL、原始错误与身份元数据', () => {
    const sensitiveStatus = {
      ...statusFor({ cli: 'disconnected', bot: 'disconnected', user: 'disconnected' }),
      appId: 'app-id-sensitive',
      userName: 'username-sensitive',
      ownerOpenId: 'open_id-sensitive',
      detail: 'raw-error-sensitive',
      verificationUrl: 'https://example.test/auth?token=token-sensitive',
      token: 'token-sensitive',
      scope: 'scope-sensitive',
    } as BridgeStatus;
    const html = renderToStaticMarkup(
      createElement(AuthPanelStatus, {
        t: translate(zh),
        status: sensitiveStatus,
        error: 'raw-error-sensitive',
        busy: false,
        onCheck: vi.fn(),
      } as never),
    );

    for (const sensitive of [
      'https://example.test/auth?token=token-sensitive',
      'raw-error-sensitive',
      'app-id-sensitive',
      'username-sensitive',
      'open_id-sensitive',
      'token-sensitive',
      'scope-sensitive',
    ]) {
      expect(html).not.toContain(sensitive);
    }
    expect(html).not.toContain('<a');
    expect(html).not.toContain('href=');
    expect(html.match(/--scope/g)).toHaveLength(1);
  });
});

describe('字典', () => {
  it('中英字典键集一致且无空文案', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const value of [...Object.values(en), ...Object.values(zh)]) {
      expect(value.trim()).not.toBe('');
    }
  });
});

describe('StatusController', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  it('加载时完整检测一次，定时轮询只读取状态并通知订阅者', async () => {
    const initial = statusFor({ user: 'disconnected' });
    const polled = statusFor();
    const checkAuth = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(initial));
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(polled));
    const controller = new StatusController({ fetchStatus, checkAuth });

    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(controller.getSnapshot().busy).toBe(true);
    await flushPromises();
    expect(controller.getSnapshot()).toMatchObject({ status: initial, busy: false });

    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();
    await vi.advanceTimersToNextTimerAsync();
    await flushPromises();

    expect(checkAuth).toHaveBeenCalledTimes(1);
    expect(fetchStatus).toHaveBeenCalledTimes(1);
    expect(controller.getSnapshot()).toMatchObject({ status: polled, busy: false });
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ status: polled }));
    controller.dispose();
  });

  it('并发手动检测共享同一次请求与 busy 状态', async () => {
    const initial = statusFor({ bot: 'disconnected' });
    const checked = statusFor();
    const pending = deferred<ApiResult<BridgeStatus>>();
    const checkAuth = vi
      .fn<() => Promise<ApiResult<BridgeStatus>>>()
      .mockResolvedValueOnce(ok(initial))
      .mockReturnValueOnce(pending.promise);
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(initial));
    const controller = new StatusController({ fetchStatus, checkAuth });
    await flushPromises();
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    const first = controller.check();
    const second = controller.check();
    expect(checkAuth).toHaveBeenCalledTimes(2);
    expect(controller.getSnapshot().busy).toBe(true);
    expect(listener).toHaveBeenLastCalledWith(expect.objectContaining({ busy: true }));

    pending.resolve(ok(checked));
    await Promise.all([first, second]);
    await flushPromises();
    expect(controller.getSnapshot()).toMatchObject({ status: checked, busy: false });
    expect(listener).toHaveBeenLastCalledWith(
      expect.objectContaining({ status: checked, busy: false }),
    );
    controller.dispose();
  });

  it('dispose 清理轮询计时器与订阅监听', async () => {
    const pending = deferred<ApiResult<BridgeStatus>>();
    const checkAuth = vi.fn((): Promise<ApiResult<BridgeStatus>> => pending.promise);
    const fetchStatus = vi.fn(async (): Promise<ApiResult<BridgeStatus>> => ok(statusFor()));
    const controller = new StatusController({ fetchStatus, checkAuth });
    const listener = vi.fn();
    controller.subscribe(listener);
    listener.mockClear();

    expect(vi.getTimerCount()).toBe(1);
    controller.dispose();
    expect(vi.getTimerCount()).toBe(0);

    pending.resolve(ok(statusFor()));
    await flushPromises();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(fetchStatus).not.toHaveBeenCalled();
    expect(listener).not.toHaveBeenCalled();
  });
});
