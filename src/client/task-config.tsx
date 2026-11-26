/**
 * 「调度会话」行配置页：普通/复杂任务模型、默认任务类型与任务会话预设。
 * 导出 TASK_ROW_ID、TASK_ROW_KEY、TaskConfigForm、defaultTaskTypeField、
 * TASK_PRESET_FIELD 与 TaskConfigPage。
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
  settingsTextField,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { CSSProperties } from 'react';

import type { TaskType } from '../lark-super-agent/api.ts';
import type { NS } from './locales.ts';
import type { ModelDefaultsInjected } from './model-defaults.ts';
import type { PresetDefaultsInjected } from './preset-defaults.ts';
import { PresetSelect } from './preset-select.tsx';
import {
  COMMON_TASK_MODEL_FIELD_NAMES,
  COMPLEX_TASK_MODEL_FIELD_NAMES,
  DEFAULT_TASK_TYPE_FIELD,
  TaskModelField,
} from './task-model-field.tsx';

/** 行 id，同时是宿主配置的条目 id。 */
export const TASK_ROW_ID = 'lark-super-agent';

/** 行配置页的槽位键：`<包名>#<行 id>`。 */
export const TASK_ROW_KEY = `dsh-plugin-lark-bridge#${TASK_ROW_ID}`;

/** 普通任务与复杂任务模型的六个文本字段。 */
const TASK_MODEL_FIELDS = [
  ...Object.values(COMMON_TASK_MODEL_FIELD_NAMES),
  ...Object.values(COMPLEX_TASK_MODEL_FIELD_NAMES),
] as const;

/** 任务会话预设的字段名。 */
export const TASK_PRESET_FIELD = 'taskPreset';

/** 任务会话预设不提供的预设标识：调度会话自己不作为任务会话的预设。 */
export const TASK_PRESET_EXCLUDED_IDS = ['sa-dispatch'] as const;

/** 行配置的取值。 */
export type TaskConfigFields = Record<
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
};

/** 配置页读取的表单状态。 */
export interface TaskConfigState extends SettingsFormShell {
  readonly commonTaskProvider: SettingsFieldState;
  readonly commonTaskModel: SettingsFieldState;
  readonly commonTaskEffort: SettingsFieldState;
  readonly complexTaskProvider: SettingsFieldState;
  readonly complexTaskModel: SettingsFieldState;
  readonly complexTaskEffort: SettingsFieldState;
  readonly defaultTaskType: SettingsFieldState;
  readonly taskPreset: SettingsFieldState;
}

/** 配置页的注入值。 */
export interface TaskConfigInjected extends SettingsFormActions {
  hooks: { taskConfig: SnapshotStore<TaskConfigState> };
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

/** 暂存普通/复杂任务模型、默认任务类型与预设的编辑，保存时写入宿主配置。 */
export class TaskConfigForm {
  private readonly form: SettingsFormModel<TaskConfigFields>;
  private readonly state: SnapshotStore<TaskConfigState>;

  /** @param scope - 宿主为该行提供的配置表单。 */
  constructor(scope: SettingsFormScope<TaskConfigFields>) {
    this.form = new SettingsFormModel(scope, [
      ...TASK_MODEL_FIELDS.map((field) => settingsTextField(field)),
      defaultTaskTypeField(),
      settingsTextField(TASK_PRESET_FIELD),
    ]);
    this.state = this.form.bind(() => ({
      ...this.form.shell(),
      commonTaskProvider: this.form.field('commonTaskProvider'),
      commonTaskModel: this.form.field('commonTaskModel'),
      commonTaskEffort: this.form.field('commonTaskEffort'),
      complexTaskProvider: this.form.field('complexTaskProvider'),
      complexTaskModel: this.form.field('complexTaskModel'),
      complexTaskEffort: this.form.field('complexTaskEffort'),
      defaultTaskType: this.form.field(DEFAULT_TASK_TYPE_FIELD),
      taskPreset: this.form.field(TASK_PRESET_FIELD),
    }));
  }

  /** @returns 配置页的注入值。 */
  inject(): TaskConfigInjected {
    return { hooks: { taskConfig: this.state }, ...this.form.actions() };
  }

  /** 释放对宿主表单的订阅。 */
  dispose(): void {
    this.form.dispose();
  }
}

/** 配置页组件 props。 */
export type TaskConfigPageProps = PropsRuntime<'plugins.row.config'> &
  PropsLocale<typeof NS> &
  InjectFace<
    TaskConfigInjected & {
      readonly commonModelDefaults: ModelDefaultsInjected;
      readonly complexModelDefaults: ModelDefaultsInjected;
      readonly presetDefaults: PresetDefaultsInjected;
    }
  >;

/** 渲染行配置页。 */
export function TaskConfigPage(props: TaskConfigPageProps) {
  const { t } = props;
  const state = props.useTaskConfig((value) => value);
  if (props.view === 'summary') return t('taskConfig.summary');
  return <TaskConfigBody {...props} state={state} />;
}

/** 配置页主体：需要表单状态，故与摘要视图分开。 */
function TaskConfigBody(props: TaskConfigPageProps & { readonly state: TaskConfigState }) {
  const { t, state } = props;
  const disabled = !state.available || !state.writable || state.saving;
  const defaultTaskType: TaskType = state.defaultTaskType.text === 'complex' ? 'complex' : 'common';
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
      <div data-dsh-lark-task-config="taskPreset" style={fieldStyle}>
        <span style={titleStyle}>{t('taskConfig.taskPreset.label')}</span>
        <PresetSelect {...props.presetDefaults} locked={disabled} t={t} />
        <p style={descriptionStyle}>{t('taskConfig.taskPreset.description')}</p>
      </div>
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
