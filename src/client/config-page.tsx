/** 配置页与共享工作区选择器：仅选择当前注册工作区。 */
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import type { SettingsFormLabels } from '@deepseek-ai/dsh-client-ui-primitives';
import { SettingsForm } from '@deepseek-ai/dsh-client-ui-primitives';
import type {
  GlobalStandardProps,
  InjectFace,
  PropsLocale,
  PropsRuntime,
  TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import { type CSSProperties, useId } from 'react';

import { normalizeWorkspacePath, sameWorkspacePath } from '../workspace-path.ts';
import { AuthPanel } from './auth-panel.tsx';
import type { ConfigPageInjected } from './config-form.ts';
import type { NS } from './locales.ts';
import type { StatusController } from './status-controller.ts';

/** 配置页组件 props。 */
export type ConfigPageProps = PropsRuntime<'plugins.row.config'> &
  PropsLocale<typeof NS> &
  InjectFace<ConfigPageInjected & { readonly controller: StatusController }>;

/** 运行时工作区条目；发布包的传递类型不可用时保持结构化收窄。 */
export interface WorkspaceListItem {
  readonly workspaceId: unknown;
  readonly path: string;
  readonly title: string;
}

/** 读取宿主当前工作区条目。 */
export function useWorkspaceItems(
  useWorkspaces: GlobalStandardProps['useWorkspaces'],
): readonly WorkspaceListItem[] {
  return useWorkspaces((state) => state.items) as readonly WorkspaceListItem[];
}

/** 工作区选择器属性。 */
export interface WorkspaceSelectProps {
  readonly t: TranslateNS<typeof NS>;
  readonly useWorkspaces: GlobalStandardProps['useWorkspaces'];
  readonly value: string;
  readonly disabled: boolean;
  readonly onChange: (path: string) => void;
  readonly invalid?: boolean;
}

/** 从当前注册列表选择工作区，值与标签统一为 Linux 风格路径。 */
export function WorkspaceSelect({
  t,
  useWorkspaces,
  value,
  disabled,
  onChange,
  invalid = false,
}: WorkspaceSelectProps) {
  const id = useId();
  const items = useWorkspaceItems(useWorkspaces);
  const options = items.map((item) => ({
    id: String(item.workspaceId),
    title: item.title,
    path: normalizeWorkspacePath(item.path),
  }));
  const selected = options.find((option) => sameWorkspacePath(option.path, value));
  return (
    <div style={fieldStyle} data-dsh-lark-config-workspace>
      <div style={labelRowStyle}>
        <label htmlFor={id} style={titleStyle}>
          {t('config.workspaceRoot.title')}
        </label>
      </div>
      <select
        id={id}
        aria-label={t('config.workspaceRoot.title')}
        style={selectStyle}
        value={selected?.path ?? ''}
        disabled={disabled || options.length === 0}
        onChange={(event) => onChange(event.currentTarget.value)}
      >
        <option value="">
          {options.length === 0
            ? t('config.workspaceRoot.empty')
            : t('config.workspaceRoot.placeholder')}
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.path}>
            {option.title} — {option.path}
          </option>
        ))}
      </select>
      <p style={descriptionStyle}>{t('config.workspaceRoot.description')}</p>
      {invalid ? <p style={invalidStyle}>{t('config.workspaceRoot.invalid')}</p> : null}
    </div>
  );
}

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
  const state = props.useConfigForm((value) => value);
  if (props.view === 'summary') return t('config.summary');

  const disabled = !state.available || !state.writable || state.saving;
  return (
    <div>
      <AuthPanel t={t} controller={props.controller} />
      <SettingsForm
        state={state}
        labels={formLabels(t)}
        onSave={props.save}
        onDiscard={props.discard}
      >
        <WorkspaceSelect
          t={t}
          useWorkspaces={props.useWorkspaces}
          value={state.workspaceRoot.text}
          disabled={disabled}
          invalid={state.workspaceRoot.invalid}
          onChange={(path) => props.edit('workspaceRoot', path)}
        />
      </SettingsForm>
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

const labelRowStyle: CSSProperties = {
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

const selectStyle: CSSProperties = {
  width: '100%',
  boxSizing: 'border-box',
  padding: '6px 8px',
  border: '1px solid var(--dsw-alias-border-l2)',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'var(--dsw-alias-bg-primary, transparent)',
  color: 'var(--dsw-alias-label-primary)',
  font: 'inherit',
  fontSize: 13,
};

const descriptionStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
};

const invalidStyle: CSSProperties = {
  ...descriptionStyle,
  color: 'var(--dsw-alias-error-fill, #cf222e)',
};
