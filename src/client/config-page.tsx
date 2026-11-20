/** 配置页与共享工作区选择器：选择工作区、新建会话的模型与预设。 */
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import { ModelSelect } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/ModelSelect.tsx';
import type { ModelLabelOwner } from '@deepseek-ai/dsh-client-ui-model-selection/src/client/slots.ts';
import type {} from '@deepseek-ai/dsh-client-ui-plugin-manager/client';
import {
  Button,
  IconChevronDownOutlineRegular,
  Menu,
  SettingsForm,
  type SettingsFormLabels,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type {
  GlobalStandardProps,
  InjectFace,
  PropsLocale,
  PropsRuntime,
  TranslateNS,
} from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import { type ComponentProps, type CSSProperties, useId, useRef, useState } from 'react';

import { normalizeWorkspacePath, sameWorkspacePath } from '../workspace-path.ts';
import { AuthPanel } from './auth-panel.tsx';
import type { ConfigPageInjected } from './config-form.ts';
import type { NS } from './locales.ts';
import type { ModelDefaultsInjected } from './model-defaults.ts';
import type { StatusController } from './status-controller.ts';

/** 配置页组件 props。 */
export type ConfigPageProps = PropsRuntime<'plugins.row.config'> &
  PropsLocale<typeof NS> &
  InjectFace<
    ConfigPageInjected & {
      readonly controller: StatusController;
      readonly modelDefaults: ModelDefaultsInjected;
    }
  >;

/** 运行时工作区条目；发布包的传递类型不可用时保持结构化收窄。 */
export interface WorkspaceListItem {
  readonly workspaceId: unknown;
  readonly path: string;
  readonly title: string;
}

/** 下拉里的一项工作区。 */
export interface WorkspaceOption {
  readonly id: string;
  readonly title: string;
  readonly path: string;
}

/** 读取宿主当前工作区条目。 */
export function useWorkspaceItems(
  useWorkspaces: GlobalStandardProps['useWorkspaces'],
): readonly WorkspaceListItem[] {
  return useWorkspaces((state) => state.items) as readonly WorkspaceListItem[];
}

/** 把注册列表转成下拉选项，路径统一为 Linux 风格。 */
export function workspaceOptions(items: readonly WorkspaceListItem[]): readonly WorkspaceOption[] {
  return items.map((item) => ({
    id: String(item.workspaceId),
    title: item.title,
    path: normalizeWorkspacePath(item.path),
  }));
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

/** 从当前注册列表选择工作区，值为归一化路径。 */
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
  const options = workspaceOptions(items);
  const selected = options.find((option) => sameWorkspacePath(option.path, value));
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const empty = options.length === 0;
  const label = empty
    ? t('config.workspaceRoot.empty')
    : selected === undefined
      ? t('config.workspaceRoot.placeholder')
      : `${selected.title} — ${selected.path}`;

  return (
    <div style={fieldStyle} data-dsh-lark-config-workspace>
      <div style={labelRowStyle}>
        <label htmlFor={id} style={titleStyle}>
          {t('config.workspaceRoot.title')}
        </label>
      </div>
      <div style={triggerRowStyle}>
        <Menu
          open={open}
          anchorRef={triggerRef}
          portal
          align="start"
          items={options.map((option) => ({
            id: option.id,
            label: (
              <span style={optionLabelStyle}>
                <span style={optionTitleStyle}>{option.title}</span>
                <span style={optionPathStyle}>{option.path}</span>
              </span>
            ),
          }))}
          selectedId={selected?.id}
          onSelect={(selectedId) => {
            setOpen(false);
            const option = options.find((candidate) => candidate.id === selectedId);
            if (option !== undefined) onChange(option.path);
          }}
          onClose={() => setOpen(false)}
          anchor={
            <Button
              ref={triggerRef}
              id={id}
              type="button"
              variant="outline"
              size="md"
              style={triggerStyle}
              disabled={disabled || empty}
              aria-haspopup="menu"
              aria-expanded={open}
              onClick={() => setOpen((previous) => !previous)}
            >
              <span style={triggerLabelStyle}>{label}</span>
              <IconChevronDownOutlineRegular size={16} />
            </Button>
          }
        />
      </div>
      <p style={descriptionStyle}>{t('config.workspaceRoot.description')}</p>
      {invalid ? <p style={invalidStyle}>{t('config.workspaceRoot.invalid')}</p> : null}
    </div>
  );
}

/** 模型标签：在 trigger、根菜单与选项中显示 provider。 */
export const renderModelSlot: ComponentProps<typeof ModelSelect>['renderSlot'] = (name, owner) => {
  if (name === 'conversation.input.model.label') {
    const label = owner as unknown as ModelLabelOwner;
    return (
      <span data-dsh-lark-provider={label.provider.id}>
        {label.provider.name} / {label.model.name}
      </span>
    );
  }
  return null;
};

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
        <div data-dsh-lark-config-model="default" style={fieldStyle}>
          <div style={labelRowStyle}>
            <span style={titleStyle}>{t('config.sessionModel.label')}</span>
          </div>
          <div style={triggerRowStyle}>
            <ModelSelect
              {...props.modelDefaults}
              locked={disabled}
              available={state.available}
              renderSlot={renderModelSlot}
            />
          </div>
          <p style={descriptionStyle}>{t('config.sessionModel.description')}</p>
        </div>
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

const triggerRowStyle: CSSProperties = {
  display: 'grid',
};

const triggerStyle: CSSProperties = {
  width: '100%',
  justifyContent: 'space-between',
  gap: 8,
  paddingInline: 10,
  fontSize: 13,
  fontWeight: 400,
};

const triggerLabelStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  textAlign: 'left',
};

const optionLabelStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 1,
  minWidth: 0,
  whiteSpace: 'normal',
};

const optionTitleStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
};

const optionPathStyle: CSSProperties = {
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  fontSize: 11,
  lineHeight: '16px',
  color: 'var(--dsw-alias-label-secondary)',
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
