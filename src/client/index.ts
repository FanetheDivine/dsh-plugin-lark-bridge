/** 浏览器入口：注册字典、共用连接弹窗、配置页与页脚在场按钮。导出 inject 与 apply。 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-locale/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
// Type-only：拉取 sidebar.footer.action 槽位声明。
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import { AuthOverlay } from './auth-overlay.tsx';
import { PluginConfigForm, ROW_ID, ROW_KEY } from './config-form.ts';
import { ConfigPage } from './config-page.tsx';
import { en, NS, zh } from './locales.ts';
import { ModelDefaults } from './model-defaults.ts';
import { PRESENCE_SLOT_ID, PresenceButton, RAIL_CSS } from './presence-button.tsx';
import {
  PRESENCE_ROW_ID,
  PRESENCE_ROW_KEY,
  PresenceConfigForm,
  PresenceConfigPage,
} from './presence-config.tsx';
import { PresenceController } from './presence-controller.ts';
import { PresetDefaults, type PresetRemoteLike } from './preset-defaults.ts';
import { StatusController } from './status-controller.ts';

/** 需要宿主注入的客户端服务。 */
export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.session'];

/** 注册共享状态、弹窗和配置页。 */
export function apply(ctx: Context): void {
  ctx.inject(['locale'], (ctx) => {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: dictionaries`);
  });

  ctx.inject(['slots', 'locale', 'configForms', 'remote', 'remote.session'], (ctx) => {
    const form = new PluginConfigForm(ctx.configForms.get(ROW_ID));
    const injected = form.inject();
    const presenceForm = new PresenceConfigForm(ctx.configForms.get(PRESENCE_ROW_ID));
    const models = new ModelDefaults(ctx, injected.hooks.configForm, injected.edit);
    const presets = new PresetDefaults(ctx, injected.hooks.configForm, injected.edit);
    // 预设服务是可选依赖：就绪后接入，缺失时选择器保持禁用。
    ctx.inject(['remote.agentPresets'], (scoped) => {
      const remote = (scoped.remote as unknown as { agentPresets?: PresetRemoteLike }).agentPresets;
      if (remote !== undefined && typeof remote.list === 'function') presets.attach(remote);
    });
    const modelT = ctx.locale.bind('model');
    const canPoll =
      typeof window !== 'undefined' &&
      typeof window.setInterval === 'function' &&
      typeof window.clearInterval === 'function';
    const controller = new StatusController({ autoStart: canPoll });
    const presence = new PresenceController({ autoStart: canPoll });
    ctx.effect(
      () => () => {
        controller.dispose();
        presence.dispose();
        form.dispose();
        presenceForm.dispose();
        models.dispose();
        presets.dispose();
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
          inject: () => ({ ...injected, controller, openSettings }),
        },
        AuthOverlay,
      ),
    );
    // 「飞书任务与调度会话」行启用时才挂页脚按钮；状态未知时保持现状。
    ctx.effect(() => {
      let unmount: (() => void) | undefined;
      const mount = (): (() => void) => {
        const style = typeof document === 'undefined' ? undefined : document.createElement('style');
        if (style !== undefined) {
          style.setAttribute('data-plugin-css', `${NS}: presence rail`);
          style.textContent = RAIL_CSS;
          document.head.appendChild(style);
        }
        const unregister = ctx.slots.inject('sidebar.footer.action', () =>
          ctx.slots.register(
            {
              name: 'sidebar.footer.action',
              id: PRESENCE_SLOT_ID,
              order: 52,
              locale: NS,
              inject: () => ({ controller: presence }),
            },
            PresenceButton,
          ),
        );
        return () => {
          unregister();
          style?.remove();
        };
      };
      const sync = (available: boolean | null): void => {
        if (available === true && unmount === undefined) unmount = mount();
        if (available === false && unmount !== undefined) {
          unmount();
          unmount = undefined;
        }
      };
      sync(presence.getSnapshot().available);
      const unsubscribe = presence.subscribe((snapshot) => sync(snapshot.available));
      return () => {
        unsubscribe();
        unmount?.();
        unmount = undefined;
      };
    }, `${NS}: presence button`);

    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.row.config',
          key: ROW_KEY,
          locale: NS,
          inject: () => ({
            ...injected,
            controller,
            modelDefaults: models.inject(modelT, (text) => ctx.locale.resolveText(text)),
            presetDefaults: presets.inject(),
          }),
        },
        ConfigPage,
      ),
    );
    ctx.slots.inject('plugins.row.config', () =>
      ctx.slots.register(
        {
          name: 'plugins.row.config',
          key: PRESENCE_ROW_KEY,
          locale: NS,
          inject: () => presenceForm.inject(),
        },
        PresenceConfigPage,
      ),
    );
  });
}
