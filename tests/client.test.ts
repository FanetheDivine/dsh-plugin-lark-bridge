// 前端入口接线测试：服务声明、字典与槽位注册参数、双语文案键集与渲染结果。
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { AuthOverlay } from '../src/client/auth-overlay.tsx';
import { type ConfigFormState, ROW_ID, ROW_KEY } from '../src/client/config-form.ts';
import { ConfigPage } from '../src/client/config-page.tsx';
import * as clientEntry from '../src/client/index.ts';
import { en, NS, zh } from '../src/client/locales.ts';
import { type ClientServiceName, makeClientCtx } from './helpers.ts';

const { apply } = clientEntry;
const ALL_SERVICES: ClientServiceName[] = ['slots', 'locale', 'configForms'];

/** 用字典构造翻译函数。 */
function translate(dict: Record<string, string>): TranslateNS<typeof NS> {
  return (key, params) =>
    (dict[key] ?? key).replace(/\{(\w+)\}/g, (_match, name: string) =>
      String(params?.[name] ?? ''),
    );
}

/** 配置页的草稿状态。 */
function pageState(): ConfigFormState {
  return {
    available: true,
    writable: true,
    dirty: false,
    invalid: false,
    saving: false,
    failed: false,
    workspaceRoot: { text: 'D:/work', overridden: false, invalid: false },
    sessionTitle: { text: '飞书', overridden: false, invalid: false },
    larkCli: { text: '', overridden: false, invalid: false },
    authCheckOnStartup: { text: 'true', overridden: false, invalid: false },
  };
}

/** 渲染配置页。 */
function renderConfigPage(view: 'page' | 'summary', dict: Record<string, string>): string {
  const props = {
    view,
    t: translate(dict),
    useConfigForm: <S>(select: (value: ConfigFormState) => S): S => select(pageState()),
    edit: vi.fn(),
    resetField: vi.fn(),
    save: vi.fn(),
    discard: vi.fn(),
  };
  return renderToStaticMarkup(createElement(ConfigPage, props as never));
}

describe('前端入口', () => {
  it('不声明必需服务，按功能分三组等待各自用到的服务', () => {
    expect('inject' in clientEntry).toBe(false);
    const ctx = makeClientCtx();
    apply(ctx);
    expect(ctx._injectGroups).toEqual([
      ['locale'],
      ['slots', 'locale'],
      ['slots', 'locale', 'configForms'],
    ]);
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
    overlay: has('slots', 'locale'),
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
      overlay: true,
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

describe('字典与渲染', () => {
  it('中英字典键集一致且无空文案', () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(zh).sort());
    for (const value of [...Object.values(en), ...Object.values(zh)]) {
      expect(value.trim()).not.toBe('');
    }
  });

  it('配置页 summary 显示一行描述', () => {
    expect(renderConfigPage('summary', zh)).toBe(zh['config.summary']);
  });

  it('配置页渲染鉴权面板与会话字段', () => {
    const html = renderConfigPage('page', zh);
    expect(html).toContain(zh['auth.stage.cli-missing']);
    expect(html).toContain(zh['config.workspaceRoot.title']);
    expect(html).toContain(zh['config.sessionTitle.title']);
    expect(html).toContain(zh['config.resetSession']);
  });

  it('配置页没有机器人凭据、档案名与 open_id 输入', () => {
    for (const dict of [zh, en]) {
      const html = renderConfigPage('page', dict);
      expect(html).not.toContain('App Secret');
      expect(html).not.toContain('type="password"');
      expect(html).not.toContain('open_id');
      expect(html).not.toContain('档案');
      expect(html).not.toContain('profile');
    }
  });

  it('bot 身份不可用时提示用 lark-cli 配置机器人', () => {
    expect(zh['auth.stage.bot-unavailable.hint']).toContain('lark-cli config init');
    expect(en['auth.stage.bot-unavailable.hint']).toContain('lark-cli config init');
    expect(Object.keys(zh).filter((key) => key.startsWith('auth.stage.app-missing'))).toEqual([]);
  });

  it('弹窗在状态就绪时不渲染', () => {
    // 组件在 SSR 中以未加载状态返回 null。
    const html = renderToStaticMarkup(
      createElement(AuthOverlay, {
        t: translate(zh),
        openSettings: () => undefined,
      }),
    );
    expect(html).toBe('');
  });
});
