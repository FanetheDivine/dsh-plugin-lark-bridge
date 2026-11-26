/**
 * 「调度会话」配置页的「普通任务模型」与「复杂任务模型」项：复用官方模型选择器，
 * 允许设置哪种任务类型作为默认任务，并说明调度会话自身的模型在「用飞书和DSH对话」配置页。
 * 导出 COMMON_TASK_MODEL_FIELD_NAMES、COMPLEX_TASK_MODEL_FIELD_NAMES、DEFAULT_TASK_TYPE_FIELD 与 TaskModelField。
 */
import { ModelSelect } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx';
import { Pill } from '@deepseek-ai/dsh-client-ui-primitives';
import type { CSSProperties } from 'react';

import type { TaskType } from '../lark-super-agent/api.ts';
import { renderModelSlot } from './config-page.tsx';
import type { ModelDefaultsInjected, ModelFieldNames } from './model-defaults.ts';

/** 普通任务模型在行配置里的三个字段名。 */
export const COMMON_TASK_MODEL_FIELD_NAMES: ModelFieldNames = {
  provider: 'commonTaskProvider',
  model: 'commonTaskModel',
  effort: 'commonTaskEffort',
};

/** 复杂任务模型在行配置里的三个字段名。 */
export const COMPLEX_TASK_MODEL_FIELD_NAMES: ModelFieldNames = {
  provider: 'complexTaskProvider',
  model: 'complexTaskModel',
  effort: 'complexTaskEffort',
};

/** 默认任务类型的字段名。 */
export const DEFAULT_TASK_TYPE_FIELD = 'defaultTaskType';

/** 任务模型项读取的文案键。 */
export type TaskModelLocaleKey =
  | 'presenceConfig.commonTaskModel.label'
  | 'presenceConfig.commonTaskModel.description'
  | 'presenceConfig.complexTaskModel.label'
  | 'presenceConfig.complexTaskModel.description'
  | 'presenceConfig.taskType.default'
  | 'presenceConfig.taskType.setDefault';

/** 任务模型项的属性。 */
export interface TaskModelFieldProps {
  readonly taskType: TaskType;
  readonly isDefault: boolean;
  readonly onSetDefault: () => void;
  readonly t: (key: TaskModelLocaleKey) => string;
  readonly modelDefaults: ModelDefaultsInjected;
  readonly available: boolean;
  readonly disabled: boolean;
}

const KEYS: Record<
  TaskType,
  { readonly label: TaskModelLocaleKey; readonly description: TaskModelLocaleKey }
> = {
  common: {
    label: 'presenceConfig.commonTaskModel.label',
    description: 'presenceConfig.commonTaskModel.description',
  },
  complex: {
    label: 'presenceConfig.complexTaskModel.label',
    description: 'presenceConfig.complexTaskModel.description',
  },
};

/** 渲染单个任务类型的模型选择项及默认切换按钮。 */
export function TaskModelField({
  taskType,
  isDefault,
  onSetDefault,
  t,
  modelDefaults,
  available,
  disabled,
}: TaskModelFieldProps) {
  const { label, description } = KEYS[taskType];
  return (
    <div data-dsh-lark-config-model={taskType} style={fieldStyle}>
      <div style={rowStyle}>
        <span style={titleStyle}>{t(label)}</span>
        <Pill
          data-dsh-lark-default-task-type={taskType}
          active={isDefault}
          disabled={disabled}
          onClick={onSetDefault}
        >
          {isDefault
            ? t('presenceConfig.taskType.default')
            : t('presenceConfig.taskType.setDefault')}
        </Pill>
      </div>
      <div style={{ display: 'grid' }}>
        <ModelSelect
          {...modelDefaults}
          locked={disabled}
          available={available}
          renderSlot={renderModelSlot}
        />
      </div>
      <p style={descriptionStyle}>{t(description)}</p>
    </div>
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
