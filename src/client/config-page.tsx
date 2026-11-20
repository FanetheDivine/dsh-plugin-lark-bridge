/**
 * 插件面板配置页：鉴权面板、会话设置与桥接会话重置。
 * 导出 ConfigPage。
 */

// Type-only：拉取 plugins.row.config 槽位声明。
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives';
import { SettingsForm, SettingsValueField, Switch } from '@deepseek-ai/dsh-client-ui-primitives';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useId } from 'react';

import { AuthPanel } from './auth-panel.tsx';
import type { ConfigPageInjected } from './config-form.ts';
import type { NS } from './locales.ts';

import type { StatusController } from './status-controller.ts';

/** 配置页组件 props。 */
export type ConfigPageProps = PropsRuntime<'plugins.row.config'> &
  PropsLocale<typeof NS> &
  InjectFace<ConfigPageInjected & { readonly controller: StatusController }>;

/** 表单框架文案。 */
function formLabels(t: ConfigPageProps['t']): SettingsFormLabels {
  return {
    unavailable: t('config.unavailable'),
    readOnly: t('config.readOnly'),
    saveFailed: t('config.saveFailed'),
    save: t('config.save'),
    saving: t('config.saving'),
  };
}

/** 渲染插件行配置。 */
export function ConfigPage(props: ConfigPageProps) {
  const { t } = props;
  const id = useId();
  const state = props.useConfigForm((value) => value);

  if (props.view === 'summary') return t('config.summary');

  const disabled = !state.writable || state.saving;

  return (
    <div>
      <AuthPanel t={t} controller={props.controller} />

      <SettingsForm
        state={state}
        labels={formLabels(t)}
        onSave={props.save}
        onDiscard={props.discard}
      >
        <h4 style={sectionTitleStyle}>{t('config.section.session')}</h4>

        <div style={fieldStyle} data-dsh-lark-config-workspace>
          <SettingsValueField
            id={`${id}-workspace`}
            label={t('config.workspaceRoot.title')}
            hint={t('config.workspaceRoot.description')}
            invalidLabel={t('config.workspaceRoot.invalid')}
            overriddenLabel={t('config.overridden')}
            resetLabel={t('config.reset')}
            text={state.workspaceRoot.text}
            overridden={state.workspaceRoot.overridden}
            invalid={state.workspaceRoot.invalid}
            disabled={disabled}
            onEdit={(text) => props.edit('workspaceRoot', text)}
            onReset={() => props.resetField('workspaceRoot')}
          />
        </div>

        <div style={fieldStyle}>
          <SettingsValueField
            id={`${id}-title`}
            label={t('config.sessionTitle.title')}
            hint={t('config.sessionTitle.description')}
            invalidLabel={t('config.sessionTitle.invalid')}
            overriddenLabel={t('config.overridden')}
            resetLabel={t('config.reset')}
            text={state.sessionTitle.text}
            overridden={state.sessionTitle.overridden}
            invalid={state.sessionTitle.invalid}
            disabled={disabled}
            onEdit={(text) => props.edit('sessionTitle', text)}
            onReset={() => props.resetField('sessionTitle')}
          />
        </div>

        <div style={rowStyle}>
          <div style={textStyle}>
            <span style={titleStyle}>{t('config.authCheckOnStartup.title')}</span>
            <p style={descriptionStyle}>{t('config.authCheckOnStartup.description')}</p>
          </div>
          <Switch
            checked={state.authCheckOnStartup.text !== 'false'}
            label={t('config.authCheckOnStartup.title')}
            disabled={disabled}
            onChange={(next) => props.edit('authCheckOnStartup', next ? 'true' : 'false')}
          />
        </div>
      </SettingsForm>
    </div>
  );
}

const sectionTitleStyle: CSSProperties = {
  margin: '16px 0 0',
  fontSize: 12,
  fontWeight: 600,
  color: 'var(--dsw-alias-label-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 24,
  padding: '12px 0',
};

const fieldStyle: CSSProperties = {
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
};

const textStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  minWidth: 0,
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-primary)',
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
};
