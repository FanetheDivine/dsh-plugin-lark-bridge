/**
 * 「飞书任务与调度会话」配置页的「工作会话模型」项：复用官方模型选择器，
 * 说明此处配置的是工作会话，调度会话自身的模型在「用飞书和DSH对话」配置页。
 * 导出 WORKER_MODEL_FIELD_NAMES 与 WorkerModelField。
 */
import { ModelSelect } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx';
import type { CSSProperties } from 'react';

import { renderModelSlot } from './config-page.tsx';
import type { ModelDefaultsInjected, ModelFieldNames } from './model-defaults.ts';

/** 工作会话模型在行配置里的三个字段名。 */
export const WORKER_MODEL_FIELD_NAMES: ModelFieldNames = {
  provider: 'workerProvider',
  model: 'workerModel',
  effort: 'workerEffort',
};

/** 工作会话模型项的属性。 */
export interface WorkerModelFieldProps {
  readonly t: (
    key: 'presenceConfig.workerModel.label' | 'presenceConfig.workerModel.description',
  ) => string;
  readonly modelDefaults: ModelDefaultsInjected;
  readonly available: boolean;
  readonly disabled: boolean;
}

/** 渲染「工作会话模型」选择项。 */
export function WorkerModelField({ t, modelDefaults, available, disabled }: WorkerModelFieldProps) {
  return (
    <div data-dsh-lark-config-model="worker" style={fieldStyle}>
      <span style={titleStyle}>{t('presenceConfig.workerModel.label')}</span>
      <div style={{ display: 'grid' }}>
        <ModelSelect
          {...modelDefaults}
          locked={disabled}
          available={available}
          renderSlot={renderModelSlot}
        />
      </div>
      <p style={descriptionStyle}>{t('presenceConfig.workerModel.description')}</p>
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
