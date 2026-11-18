/**
 * 浏览器入口：注册字典、全局鉴权弹窗与插件行配置页。
 * 导出 apply；客户端服务按功能可选。
 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-locale/client';
// Type-only：拉取 shell.overlay 槽位与 ctx.layout 服务声明。
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
// Type-only：拉取 plugins.row.config 槽位声明。
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
// Type-only：拉取 ctx.slots 服务。
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
// Type-only：拉取 ctx.configForms 服务。
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import { AuthOverlay } from './auth-overlay.tsx';
import { PluginConfigForm, ROW_ID, ROW_KEY } from './config-form.ts';
import { ConfigPage } from './config-page.tsx';
import { en, NS, zh } from './locales.ts';

/**
 * 插件在前端启用时调用。
 * 字典、弹窗与配置页各自等待所需服务；服务缺失时该功能不加载。
 */
export function apply(ctx: Context): void {
  ctx.inject(['locale'], (ctx) => {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: dictionaries`);
  });

  ctx.inject(['slots', 'locale'], (ctx) => {
    const layout = ctx.get('layout') as { selectPanel(id: string): void } | undefined;
    const navigation = ctx.get('pluginNavigation') as
      | { openBundle?(name: string): void }
      | undefined;
    ctx.slots.inject('shell.overlay', () =>
      ctx.slots.register(
        {
          name: 'shell.overlay',
          id: 'lark-bridge-auth',
          order: 20,
          locale: NS,
          inject: () => ({
            openSettings: () => {
              if (navigation?.openBundle !== undefined) {
                navigation.openBundle('dsh-plugin-lark-bridge');
                return;
              }
              layout?.selectPanel('plugins');
            },
          }),
        },
        AuthOverlay,
      ),
    );
  });

  ctx.inject(['slots', 'locale', 'configForms'], (ctx) => {
    const form = new PluginConfigForm(ctx.configForms.get(ROW_ID));
    ctx.effect(
      () => () => {
        form.dispose();
      },
      `${NS}: config form`,
    );
    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        { name: 'plugins.row.config', key: ROW_KEY, locale: NS, inject: () => form.inject() },
        ConfigPage,
      ),
    );
  });
}
