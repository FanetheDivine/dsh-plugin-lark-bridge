/** 浏览器入口：注册字典、共用连接弹窗与工作区配置页。 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import { AuthOverlay } from './auth-overlay.tsx';
import { PluginConfigForm, ROW_ID, ROW_KEY } from './config-form.ts';
import { ConfigPage } from './config-page.tsx';
import { en, NS, zh } from './locales.ts';
import { StatusController } from './status-controller.ts';

/** 注册共享状态、弹窗和配置页。 */
export function apply(ctx: Context): void {
  ctx.inject(['locale'], (ctx) => {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: dictionaries`);
  });

  ctx.inject(['slots', 'locale', 'configForms'], (ctx) => {
    const form = new PluginConfigForm(ctx.configForms.get(ROW_ID));
    const canPoll =
      typeof window !== 'undefined' &&
      typeof window.setInterval === 'function' &&
      typeof window.clearInterval === 'function';
    const controller = new StatusController({ autoStart: canPoll });
    ctx.effect(
      () => () => {
        controller.dispose();
        form.dispose();
      },
      `${NS}: shared state`,
    );

    const layout = ctx.get('layout') as { selectPanel(id: string): void } | undefined;
    const navigation = ctx.get('pluginNavigation') as
      | { openBundle?(name: string): void }
      | undefined;
    const openSettings = (): void => {
      if (navigation?.openBundle !== undefined) {
        navigation.openBundle('dsh-plugin-lark-bridge');
        return;
      }
      layout?.selectPanel('plugins');
    };

    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'lark-bridge-auth',
          order: 20,
          locale: NS,
          inject: () => ({ ...form.inject(), controller, openSettings }),
        },
        AuthOverlay,
      ),
    );
    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.row.config',
          key: ROW_KEY,
          locale: NS,
          inject: () => ({ ...form.inject(), controller }),
        },
        ConfigPage,
      ),
    );
  });
}
