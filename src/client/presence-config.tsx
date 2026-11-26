/**
 * 「调度会话」行配置页：在场状态的自动更新开关、自动切换时间、普通/复杂任务模型、默认任务类型与任务会话预设。
 * 导出 PRESENCE_ROW_ID、PRESENCE_ROW_KEY、PresenceConfigForm、presenceSwitchField、
 * defaultTaskTypeField、presenceAlarmsField 与 PresenceConfigPage。
 */
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import {
  Button,
  IconClockOutlineRegular,
  IconCloseOutlineRegular,
  IconPlusOutlineRegular,
  Pill,
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
import { type CSSProperties, useState } from 'react';

import {
  formatAlarmList,
  normalizeAlarms,
  type PresenceAction,
  type PresenceAlarm,
  parseAlarmList,
} from '../lark-super-agent/alarms.ts';
import type { TaskType } from '../lark-super-agent/api.ts';
import type { NS } from './locales.ts';
import type { ModelDefaultsInjected } from './model-defaults.ts';
import type { PresetDefaultsInjected } from './preset-defaults.ts';
import './presence-alarms.css';
import { PresenceAlarmEditor } from './presence-alarms-editor.tsx';
import type { PresenceController } from './presence-controller.ts';
import { usePresenceSnapshot } from './presence-controller.ts';
import { PresetSelect } from './preset-select.tsx';
import {
  COMMON_TASK_MODEL_FIELD_NAMES,
  COMPLEX_TASK_MODEL_FIELD_NAMES,
  DEFAULT_TASK_TYPE_FIELD,
  TaskModelField,
} from './task-model-field.tsx';

/** 行 id，同时是宿主配置的条目 id。 */
export const PRESENCE_ROW_ID = 'lark-super-agent';

/** 行配置页的槽位键：`<包名>#<行 id>`。 */
export const PRESENCE_ROW_KEY = `dsh-plugin-lark-bridge#${PRESENCE_ROW_ID}`;

/** 两个开关字段。 */
export const PRESENCE_FIELDS = ['guiInputSetsLocal', 'larkInputSetsRemote'] as const;

/** 开关字段名。 */
export type PresenceField = (typeof PRESENCE_FIELDS)[number];

/** 闹钟条目的配置字段名。 */
export const ALARMS_FIELD = 'presenceAlarms';

/** 普通任务与复杂任务模型的六个文本字段。 */
const TASK_MODEL_FIELDS = [
  ...Object.values(COMMON_TASK_MODEL_FIELD_NAMES),
  ...Object.values(COMPLEX_TASK_MODEL_FIELD_NAMES),
] as const;

/** 任务会话预设的字段名。 */
export const TASK_PRESET_FIELD = 'taskPreset';

/** 两个自动切换分区。 */
const SECTIONS = [
  {
    action: 'local',
    label: 'presenceConfig.local.label',
    description: 'presenceConfig.local.description',
  },
  {
    action: 'remote',
    label: 'presenceConfig.remote.label',
    description: 'presenceConfig.remote.description',
  },
] as const;

/** 行配置的取值。 */
export type PresenceConfigFields = Record<PresenceField, boolean> &
  Record<
    | 'commonTaskProvider'
    | 'commonTaskModel'
    | 'commonTaskEffort'
    | 'complexTaskProvider'
    | 'complexTaskModel'
    | 'complexTaskEffort'
    | 'taskPreset',
    string
  > & {
    readonly defaultTaskType?: TaskType | undefined;
    readonly presenceAlarms?: readonly PresenceAlarm[] | undefined;
  };

/** 配置页读取的表单状态。 */
export interface PresenceConfigState extends SettingsFormShell {
  readonly guiInputSetsLocal: SettingsFieldState;
  readonly larkInputSetsRemote: SettingsFieldState;
  readonly commonTaskProvider: SettingsFieldState;
  readonly commonTaskModel: SettingsFieldState;
  readonly commonTaskEffort: SettingsFieldState;
  readonly complexTaskProvider: SettingsFieldState;
  readonly complexTaskModel: SettingsFieldState;
  readonly complexTaskEffort: SettingsFieldState;
  readonly defaultTaskType: SettingsFieldState;
  readonly taskPreset: SettingsFieldState;
  readonly presenceAlarms: SettingsFieldState;
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

/** 默认任务类型字段：暂存文本为 `'common'` 或 `'complex'`，缺省按 `'common'` 显示。 */
export function defaultTaskTypeField(): SettingsFieldSpec {
  return {
    field: DEFAULT_TASK_TYPE_FIELD,
    format: (value) => (value === 'complex' ? 'complex' : 'common'),
    parse: (text) => {
      if (text === 'common' || text === 'complex') return { kind: 'set', value: text };
      return undefined;
    },
  };
}

/** 闹钟列表字段：暂存文本是规范化 JSON，空列表暂存为空串。 */
export function presenceAlarmsField(): SettingsFieldSpec {
  return {
    field: ALARMS_FIELD,
    format: (value) => formatAlarmList(normalizeAlarms(value)),
    parse: (text) => {
      if (text.trim() === '') return { kind: 'clear' };
      const alarms = parseAlarmList(text);
      return alarms === undefined ? undefined : { kind: 'set', value: alarms };
    },
  };
}

/** 暂存开关、闹钟、普通/复杂任务模型、默认任务类型与预设的编辑，保存时写入宿主配置。 */
export class PresenceConfigForm {
  private readonly form: SettingsFormModel<PresenceConfigFields>;
  private readonly state: SnapshotStore<PresenceConfigState>;

  /** @param scope - 宿主为该行提供的配置表单。 */
  constructor(scope: SettingsFormScope<PresenceConfigFields>) {
    this.form = new SettingsFormModel(scope, [
      ...PRESENCE_FIELDS.map(presenceSwitchField),
      ...TASK_MODEL_FIELDS.map((field) => settingsTextField(field)),
      defaultTaskTypeField(),
      settingsTextField(TASK_PRESET_FIELD),
      presenceAlarmsField(),
    ]);
    this.state = this.form.bind(() => ({
      ...this.form.shell(),
      guiInputSetsLocal: this.form.field('guiInputSetsLocal'),
      larkInputSetsRemote: this.form.field('larkInputSetsRemote'),
      commonTaskProvider: this.form.field('commonTaskProvider'),
      commonTaskModel: this.form.field('commonTaskModel'),
      commonTaskEffort: this.form.field('commonTaskEffort'),
      complexTaskProvider: this.form.field('complexTaskProvider'),
      complexTaskModel: this.form.field('complexTaskModel'),
      complexTaskEffort: this.form.field('complexTaskEffort'),
      defaultTaskType: this.form.field(DEFAULT_TASK_TYPE_FIELD),
      taskPreset: this.form.field(TASK_PRESET_FIELD),
      presenceAlarms: this.form.field(ALARMS_FIELD),
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
  InjectFace<
    PresenceConfigInjected & {
      readonly commonModelDefaults: ModelDefaultsInjected;
      readonly complexModelDefaults: ModelDefaultsInjected;
      readonly presetDefaults: PresetDefaultsInjected;
      readonly controller: PresenceController;
    }
  >;

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

/** 正在编辑的条目：动作加被编辑的条目，缺省表示新增。 */
interface EditorTarget {
  readonly action: PresenceAction;
  readonly alarm?: PresenceAlarm | undefined;
}

/** 渲染行配置页。 */
export function PresenceConfigPage(props: PresenceConfigPageProps) {
  const { t } = props;
  const state = props.usePresenceConfig((value) => value);
  if (props.view === 'summary') return t('presenceConfig.summary');
  return <PresenceConfigBody {...props} state={state} />;
}

/** 配置页主体：需要表单状态与交互状态，故与摘要视图分开。 */
function PresenceConfigBody(
  props: PresenceConfigPageProps & { readonly state: PresenceConfigState },
) {
  const { t, state } = props;
  const presence = usePresenceSnapshot(props.controller);
  const [editor, setEditor] = useState<EditorTarget | null>(null);
  const disabled = !state.available || !state.writable || state.saving;
  const alarms = parseAlarmList(state.presenceAlarms.text) ?? [];
  const defaultTaskType: TaskType = state.defaultTaskType.text === 'complex' ? 'complex' : 'common';
  const commit = (next: readonly PresenceAlarm[]): void => {
    props.edit(ALARMS_FIELD, formatAlarmList(next));
  };
  const toggle = (
    target: PresenceAlarm,
    key: 'enabled' | 'skipWeekends' | 'skipHolidays',
  ): void => {
    commit(
      alarms.map((alarm) => (alarm.id === target.id ? { ...alarm, [key]: !alarm[key] } : alarm)),
    );
  };
  const remove = (target: PresenceAlarm): void => {
    commit(alarms.filter((alarm) => alarm.id !== target.id));
  };
  const submit = (next: PresenceAlarm): void => {
    const exists = alarms.some((alarm) => alarm.id === next.id);
    commit(
      exists ? alarms.map((alarm) => (alarm.id === next.id ? next : alarm)) : [...alarms, next],
    );
  };
  const holidayHint =
    !alarms.some((alarm) => alarm.enabled && alarm.skipHolidays) ||
    presence.holidays.state === 'fresh'
      ? undefined
      : presence.holidays.state === 'missing'
        ? t('presenceConfig.holidays.missing')
        : t('presenceConfig.holidays.stale');

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
      {SECTIONS.map((section) => {
        const list = alarms.filter((alarm) => alarm.action === section.action);
        return (
          <div
            key={section.action}
            data-dsh-lark-presence-config={`alarms-${section.action}`}
            style={fieldStyle}
          >
            <div style={rowStyle}>
              <span style={titleStyle}>{t(section.label)}</span>
              <Button
                variant="outline"
                size="sm"
                icon={<IconPlusOutlineRegular size={14} />}
                disabled={disabled}
                onClick={() => setEditor({ action: section.action })}
              >
                {t('presenceConfig.alarms.add')}
              </Button>
            </div>
            <p style={descriptionStyle}>{t(section.description)}</p>
            {list.length === 0 ? (
              <p style={emptyStyle}>{t('presenceConfig.alarms.empty')}</p>
            ) : (
              <div className="dsh-lark-alarm-list" data-dsh-lark-ui>
                {list.map((alarm) => (
                  <div
                    key={alarm.id}
                    className="dsh-lark-alarm"
                    data-dsh-lark-alarm={alarm.id}
                    data-off={alarm.enabled ? undefined : ''}
                  >
                    <div className="dsh-lark-alarm-head">
                      <button
                        type="button"
                        className="dsh-lark-alarm-time"
                        onClick={() => setEditor({ action: section.action, alarm })}
                        disabled={disabled}
                        title={t('presenceConfig.alarm.edit')}
                        aria-label={`${t('presenceConfig.alarm.edit')} ${alarm.time}`}
                      >
                        <IconClockOutlineRegular size={13} />
                        {alarm.time}
                      </button>
                    </div>
                    <div className="dsh-lark-alarm-actions">
                      <Switch
                        checked={alarm.enabled}
                        onChange={() => toggle(alarm, 'enabled')}
                        label={`${t('presenceConfig.alarm.enabled')} ${alarm.time}`}
                        disabled={disabled}
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        aria-label={`${t('presenceConfig.alarm.remove')} ${alarm.time}`}
                        disabled={disabled}
                        onClick={() => remove(alarm)}
                      >
                        <IconCloseOutlineRegular size={14} />
                      </Button>
                    </div>
                    <div className="dsh-lark-alarm-chips">
                      <Pill
                        active={alarm.skipWeekends}
                        onClick={() => toggle(alarm, 'skipWeekends')}
                        disabled={disabled}
                      >
                        {t('presenceConfig.alarm.skipWeekends')}
                      </Pill>
                      <Pill
                        active={alarm.skipHolidays}
                        onClick={() => toggle(alarm, 'skipHolidays')}
                        disabled={disabled}
                      >
                        {t('presenceConfig.alarm.skipHolidays')}
                      </Pill>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {holidayHint === undefined ? null : (
        <p style={warningStyle} role="status">
          {holidayHint}
        </p>
      )}
      <TaskModelField
        taskType="common"
        isDefault={defaultTaskType === 'common'}
        onSetDefault={() => props.edit(DEFAULT_TASK_TYPE_FIELD, 'common')}
        t={t}
        modelDefaults={props.commonModelDefaults}
        available={state.available}
        disabled={disabled}
      />
      <TaskModelField
        taskType="complex"
        isDefault={defaultTaskType === 'complex'}
        onSetDefault={() => props.edit(DEFAULT_TASK_TYPE_FIELD, 'complex')}
        t={t}
        modelDefaults={props.complexModelDefaults}
        available={state.available}
        disabled={disabled}
      />
      <div data-dsh-lark-presence-config="taskPreset" style={fieldStyle}>
        <span style={titleStyle}>{t('presenceConfig.taskPreset.label')}</span>
        <PresetSelect {...props.presetDefaults} locked={disabled} t={t} />
        <p style={descriptionStyle}>{t('presenceConfig.taskPreset.description')}</p>
      </div>
      {editor === null ? null : (
        <PresenceAlarmEditor
          key={`${editor.action}-${editor.alarm?.id ?? 'new'}`}
          t={t}
          action={editor.action}
          alarm={editor.alarm}
          existingTimes={alarms
            .filter((alarm) => alarm.action === editor.action && alarm.id !== editor.alarm?.id)
            .map((alarm) => alarm.time)}
          disabled={disabled}
          onClose={() => setEditor(null)}
          onSubmit={submit}
        />
      )}
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

const emptyStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-label-tertiary)',
};

const warningStyle: CSSProperties = {
  margin: 0,
  padding: '8px 0 0',
  fontSize: 12,
  lineHeight: 1.5,
  color: 'var(--dsw-alias-state-warn-primary)',
};
