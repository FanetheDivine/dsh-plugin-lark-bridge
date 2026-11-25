/**
 * 「飞书任务与调度会话」配置页的「任务会话模型」项：复用官方模型选择器，
 * 说明此处配置的是任务会话，调度会话自身的模型在「用飞书和DSH对话」配置页。
 * 导出 TASK_MODEL_FIELD_NAMES 与 TaskModelField。
 */
import { ModelSelect } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx';
import type { CSSProperties } from 'react';

import { renderModelSlot } from './config-page.tsx';
import type { ModelDefaultsInjected, ModelFieldNames } from './model-defaults.ts';

/** 任务会话模型在行配置里的三个字段名。 */
export const TASK_MODEL_FIELD_NAMES: ModelFieldNames = {
  provider: 'taskProvider',
  model: 'taskModel',
  effort: 'taskEffort',
};

/** 任务会话模型项的属性。 */
export interface TaskModelFieldProps {
  readonly t: (
    key: 'presenceConfig.taskModel.label' | 'presenceConfig.taskModel.description',
  ) => string;
  readonly modelDefaults: ModelDefaultsInjected;
  readonly available: boolean;
  readonly disabled: boolean;
}

/** 渲染「任务会话模型」选择项。 */
export function TaskModelField({ t, modelDefaults, available, disabled }: TaskModelFieldProps) {
  return (
    <div data-dsh-lark-config-model="task" style={fieldStyle}>
      <span style={titleStyle}>{t('presenceConfig.taskModel.label')}</span>
      <div style={{ display: 'grid' }}>
        <ModelSelect
          {...modelDefaults}
          locked={disabled}
          available={available}
          renderSlot={renderModelSlot}
        />
      </div>
      <p style={descriptionStyle}>{t('presenceConfig.taskModel.description')}</p>
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
