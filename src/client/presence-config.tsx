/**
 * 「飞书任务与调度会话」行配置页：两个自动更新在场状态的开关。
 * 导出 PRESENCE_ROW_ID、PRESENCE_ROW_KEY、PresenceConfigForm、presenceSwitchField 与 PresenceConfigPage。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import {
  type SettingsFieldSpec,
  type SettingsFieldState,
  SettingsForm,
  type SettingsFormActions,
  SettingsFormModel,
  type SettingsFormScope,
  type SettingsFormShell,
  Switch,
  settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CSSProperties } from 'react';

import type { NS } from './locales.ts';
import type { ModelDefaultsInjected } from './model-defaults.ts';
import { WORKER_MODEL_FIELD_NAMES, WorkerModelField } from './worker-model-field.tsx';

/** 行 id，同时是宿主配置的条目 id。 */
export const PRESENCE_ROW_ID = 'lark-super-agent';

/** 行配置页的槽位键：`<包名>#<行 id>`。 */
export const PRESENCE_ROW_KEY = `dsh-plugin-lark-bridge#${PRESENCE_ROW_ID}`;

/** 两个开关字段。 */
export const PRESENCE_FIELDS = ['guiInputSetsLocal', 'larkInputSetsRemote'] as const;

/** 开关字段名。 */
export type PresenceField = (typeof PRESENCE_FIELDS)[number];

/** 工作会话模型的三个文本字段。 */
const WORKER_FIELDS = Object.values(WORKER_MODEL_FIELD_NAMES);

/** 行配置的取值。 */
export type PresenceConfigFields = Record<PresenceField, boolean> &
  Record<'workerProvider' | 'workerModel' | 'workerEffort', string>;

/** 配置页读取的表单状态。 */
export interface PresenceConfigState extends SettingsFormShell {
  readonly guiInputSetsLocal: SettingsFieldState;
  readonly larkInputSetsRemote: SettingsFieldState;
  readonly workerProvider: SettingsFieldState;
  readonly workerModel: SettingsFieldState;
  readonly workerEffort: SettingsFieldState;
}

/** 配置页的注入值。 */
export interface PresenceConfigInjected extends SettingsFormActions {
  hooks: { presenceConfig: SnapshotStore<PresenceConfigState> };
}

/** 布尔开关字段：暂存文本为 `'true'` 或 `'false'`，缺省按开启显示。 */
export function presenceSwitchField(field: PresenceField): SettingsFieldSpec {
  return {
    field,
    format: (value) => (value === false ? 'false' : 'true'),
    parse: (text) => {
      if (text === 'true') return { kind: 'set', value: true };
      if (text === 'false') return { kind: 'set', value: false };
      return undefined;
    },
  };
}

/** 暂存两个开关的编辑，保存时写入宿主配置。 */
export class PresenceConfigForm {
  private readonly form: SettingsFormModel<PresenceConfigFields>;
  private readonly state: SnapshotStore<PresenceConfigState>;

  /** @param scope - 宿主为该行提供的配置表单。 */
  constructor(scope: SettingsFormScope<PresenceConfigFields>) {
    this.form = new SettingsFormModel(scope, [
      ...PRESENCE_FIELDS.map(presenceSwitchField),
      ...WORKER_FIELDS.map((field) => settingsTextField(field)),
    ]);
    this.state = this.form.bind(() => ({
      ...this.form.shell(),
      guiInputSetsLocal: this.form.field('guiInputSetsLocal'),
      larkInputSetsRemote: this.form.field('larkInputSetsRemote'),
      workerProvider: this.form.field('workerProvider'),
      workerModel: this.form.field('workerModel'),
      workerEffort: this.form.field('workerEffort'),
    }));
  }

  /** @returns 配置页的注入值。 */
  inject(): PresenceConfigInjected {
    return { hooks: { presenceConfig: this.state }, ...this.form.actions() };
  }

  /** 释放对宿主表单的订阅。 */
  dispose(): void {
    this.form.dispose();
  }
}

/** 配置页组件 props。 */
export type PresenceConfigPageProps = PropsRuntime<'plugins.row.config'> &
  PropsLocale<typeof NS> &
  InjectFace<PresenceConfigInjected & { readonly modelDefaults: ModelDefaultsInjected }>;

/** 开关文案键。 */
const FIELD_KEYS = {
  guiInputSetsLocal: {
    label: 'presenceConfig.guiInputSetsLocal.label',
    description: 'presenceConfig.guiInputSetsLocal.description',
  },
  larkInputSetsRemote: {
    label: 'presenceConfig.larkInputSetsRemote.label',
    description: 'presenceConfig.larkInputSetsRemote.description',
  },
} as const;

/** 渲染行配置页。 */
export function PresenceConfigPage(props: PresenceConfigPageProps) {
  const { t } = props;
  const state = props.usePresenceConfig((value) => value);
  if (props.view === 'summary') return t('presenceConfig.summary');
  const disabled = !state.available || !state.writable || state.saving;
  return (
    <SettingsForm
      state={state}
      labels={{
        unavailable: t('config.unavailable'),
        readOnly: t('config.readOnly'),
        saveFailed: t('config.saveFailed'),
        save: t('config.save'),
        saving: t('config.saving'),
      }}
      onSave={props.save}
      onDiscard={props.discard}
    >
      {PRESENCE_FIELDS.map((field) => (
        <div key={field} data-dsh-lark-presence-config={field} style={fieldStyle}>
          <div style={rowStyle}>
            <span style={titleStyle}>{t(FIELD_KEYS[field].label)}</span>
            <Switch
              checked={state[field].text !== 'false'}
              onChange={(next) => props.edit(field, next ? 'true' : 'false')}
              label={t(FIELD_KEYS[field].label)}
              disabled={disabled}
            />
          </div>
          <p style={descriptionStyle}>{t(FIELD_KEYS[field].description)}</p>
        </div>
      ))}
      <WorkerModelField
        t={t}
        modelDefaults={props.modelDefaults}
        available={state.available}
        disabled={disabled}
      />
    </SettingsForm>
  );
}

const fieldStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
  padding: '12px 0',
  borderTop: '0.5px solid var(--dsw-alias-border-l2)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
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
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-secondary)',
};
