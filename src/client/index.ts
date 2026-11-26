/** 浏览器入口：注册字典、共用连接弹窗、配置页、任务配置页、上报卡片与通知正文卡片。导出 inject 与 apply。 */
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-locale/client';
// Type-only：拉取 conversation.chat.node 槽位与 uiConversation 服务声明。
import type {} from '@deepseek-ai/dsh-client-ui-chat/client';
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import { AuthOverlay } from './auth-overlay.tsx';
import { PluginConfigForm, ROW_ID, ROW_KEY } from './config-form.ts';
import { ConfigPage } from './config-page.tsx';
import { en, NS, zh } from './locales.ts';
import { ModelDefaults } from './model-defaults.ts';
import { NotifyCard } from './notify-card.tsx';
import { NOTIFY_NODE_KIND, registerNotifyDefinition } from './notify-node.ts';
import { PresetDefaults, type PresetRemoteLike } from './preset-defaults.ts';
import { ReportCard } from './report-card.tsx';
import { REPORT_NODE_KIND, registerReportDefinition } from './report-node.ts';
import { StatusController } from './status-controller.ts';
import {
  TASK_PRESET_EXCLUDED_IDS,
  TASK_PRESET_FIELD,
  TASK_ROW_ID,
  TASK_ROW_KEY,
  TaskConfigForm,
  TaskConfigPage,
} from './task-config.tsx';
import {
  COMMON_TASK_MODEL_FIELD_NAMES,
  COMPLEX_TASK_MODEL_FIELD_NAMES,
} from './task-model-field.tsx';

/** 需要宿主注入的客户端服务。 */
export const inject = ['slots', 'locale', 'configForms', 'remote', 'remote.session'];

/** 注册共享状态、弹窗和配置页。 */
export function apply(ctx: Context): void {
  ctx.inject(['locale'], (ctx) => {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), `${NS}: dictionaries`);
  });

  // 上报与通知卡片：成功结果产出轮次层级节点，工具行保持宿主默认行。
  ctx.inject(['slots', 'uiConversation'], (ctx) => {
    ctx.effect(() => {
      const unregisterReport = registerReportDefinition(ctx);
      const unregisterNotify = registerNotifyDefinition(ctx);
      return () => {
        unregisterNotify();
        unregisterReport();
      };
    }, `${NS}: report and notify definitions`);
    ctx.slots.inject('conversation.chat.node', () =>
      ctx.slots.register(
        { name: 'conversation.chat.node', key: REPORT_NODE_KIND, locale: NS },
        ReportCard as never,
      ),
    );
    ctx.slots.inject('conversation.chat.node', () =>
      ctx.slots.register(
        { name: 'conversation.chat.node', key: NOTIFY_NODE_KIND, locale: NS },
        NotifyCard as never,
      ),
    );
  });

  ctx.inject(['slots', 'locale', 'configForms', 'remote', 'remote.session'], (ctx) => {
    const form = new PluginConfigForm(ctx.configForms.get(ROW_ID));
    const injected = form.inject();
    const taskForm = new TaskConfigForm(ctx.configForms.get(TASK_ROW_ID));
    const models = new ModelDefaults(ctx, injected.hooks.configForm, injected.edit);
    const taskInjected = taskForm.inject();
    const commonTaskModels = new ModelDefaults(
      ctx,
      taskInjected.hooks.taskConfig,
      taskInjected.edit,
      COMMON_TASK_MODEL_FIELD_NAMES,
    );
    const complexTaskModels = new ModelDefaults(
      ctx,
      taskInjected.hooks.taskConfig,
      taskInjected.edit,
      COMPLEX_TASK_MODEL_FIELD_NAMES,
    );
    const presets = new PresetDefaults(ctx, injected.hooks.configForm, injected.edit);
    const taskPresets = new PresetDefaults(
      ctx,
      taskInjected.hooks.taskConfig,
      taskInjected.edit,
      TASK_PRESET_FIELD,
      undefined,
      TASK_PRESET_EXCLUDED_IDS,
    );
    // 预设服务是可选依赖：就绪后接入，缺失时选择器保持禁用。
    ctx.inject(['remote.agentPresets'], (scoped) => {
      const remote = (scoped.remote as unknown as { agentPresets?: PresetRemoteLike }).agentPresets;
      if (remote !== undefined && typeof remote.list === 'function') {
        presets.attach(remote);
        taskPresets.attach(remote);
      }
    });
    const modelT = ctx.locale.bind('model');
    const canPoll =
      typeof window !== 'undefined' &&
      typeof window.setInterval === 'function' &&
      typeof window.clearInterval === 'function';
    const controller = new StatusController({ autoStart: canPoll });
    ctx.effect(
      () => () => {
        controller.dispose();
        form.dispose();
        taskForm.dispose();
        models.dispose();
        commonTaskModels.dispose();
        complexTaskModels.dispose();
        presets.dispose();
        taskPresets.dispose();
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
          key: TASK_ROW_KEY,
          locale: NS,
          inject: () => ({
            ...taskInjected,
            commonModelDefaults: commonTaskModels.inject(modelT, (text) =>
              ctx.locale.resolveText(text),
            ),
            complexModelDefaults: complexTaskModels.inject(modelT, (text) =>
              ctx.locale.resolveText(text),
            ),
            presetDefaults: taskPresets.inject(),
          }),
        },
        TaskConfigPage,
      ),
    );
  });
}
