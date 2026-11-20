/** 共用设置弹窗：连接状态、注册工作区选择、失效重开与保存状态。 */
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import { type CSSProperties, useEffect, useReducer, useRef } from 'react';

import { normalizeWorkspacePath, sameWorkspacePath } from '../workspace-path.ts';
import type { BridgeStatus } from './api.ts';
import { AuthPanel } from './auth-panel.tsx';
import type { ConfigFormState, ConfigPageInjected } from './config-form.ts';
import { useWorkspaceItems, WorkspaceSelect } from './config-page.tsx';
import type { NS } from './locales.ts';
import { type StatusController, useStatusSnapshot } from './status-controller.ts';

/** 弹窗 props。 */
export type AuthOverlayProps = PropsRuntime<'shell.overlay'> &
  PropsLocale<typeof NS> &
  InjectFace<
    ConfigPageInjected & {
      readonly controller: StatusController;
      readonly openSettings: () => void;
    }
  >;

/** 计算当前失效签名；连接与工作区均有效时返回空串。 */
export function getAuthOverlaySignature(
  status: BridgeStatus,
  workspaceRoot: string,
  workspacePaths: readonly string[],
): string {
  const root = normalizeWorkspacePath(workspaceRoot);
  const workspaceValid = workspacePaths.some((path) => sameWorkspacePath(path, root));
  if (status.ready && workspaceValid) return '';
  return `${status.cli}/${status.bot}/${status.user}|${workspaceValid ? 'valid' : 'invalid'}:${root}`;
}

/** 弹窗状态。 */
export interface AuthOverlayState {
  readonly signature: string;
  readonly open: boolean;
  readonly dismissed: boolean;
  readonly settleDismissed: boolean;
  readonly editing: boolean;
  readonly saving: boolean;
}

/** 弹窗初始状态。 */
export const INITIAL_AUTH_OVERLAY_STATE: AuthOverlayState = {
  signature: 'initial',
  open: true,
  dismissed: false,
  settleDismissed: false,
  editing: false,
  saving: false,
};

/** 弹窗状态动作。 */
export type AuthOverlayAction =
  | { readonly type: 'sync'; readonly signature: string }
  | { readonly type: 'editStart' }
  | { readonly type: 'dismiss' }
  | { readonly type: 'discard' }
  | { readonly type: 'saveStart' }
  | {
      readonly type: 'saveSettled';
      readonly saving: boolean;
      readonly dirty: boolean;
      readonly failed: boolean;
    };

/** 管理失效重开和显式保存；未发起保存的 settle 不产生副作用。 */
export function reduceAuthOverlayState(
  state: AuthOverlayState,
  action: AuthOverlayAction,
): AuthOverlayState {
  switch (action.type) {
    case 'sync': {
      const changed = action.signature !== state.signature;
      if (action.signature === '' && !state.editing && !state.saving) {
        return {
          signature: '',
          open: false,
          dismissed: false,
          settleDismissed: false,
          editing: false,
          saving: false,
        };
      }
      if (state.dismissed && (state.settleDismissed || !changed)) {
        return { ...state, signature: action.signature, settleDismissed: false };
      }
      return {
        ...state,
        signature: action.signature,
        open: true,
        dismissed: false,
      };
    }
    case 'editStart':
      return { ...state, open: true, dismissed: false, editing: true };
    case 'dismiss':
      return {
        ...state,
        open: false,
        dismissed: true,
        settleDismissed: false,
        editing: false,
        saving: false,
      };
    case 'discard':
      return {
        ...state,
        open: false,
        dismissed: true,
        settleDismissed: true,
        editing: false,
        saving: false,
      };
    case 'saveStart':
      return { ...state, open: true, dismissed: false, saving: true };
    case 'saveSettled': {
      if (!state.saving) return state;
      if (action.saving || action.dirty || action.failed) {
        return { ...state, open: true, saving: false, editing: true };
      }
      return {
        signature: '',
        open: false,
        dismissed: false,
        settleDismissed: false,
        editing: false,
        saving: false,
      };
    }
  }
}

/** 纯展示弹窗正文，便于服务端渲染验证。 */
export interface AuthOverlayContentProps {
  readonly t: AuthOverlayProps['t'];
  readonly controller: StatusController;
  readonly useWorkspaces: AuthOverlayProps['useWorkspaces'];
  readonly form: ConfigFormState;
  readonly onEdit: (path: string) => void;
  readonly onSave: () => void;
  readonly onClose: () => void;
  readonly onOpenSettings?: () => void;
}

/** 连接面板与工作区选择正文。 */
export function AuthOverlayContent({
  t,
  controller,
  useWorkspaces,
  form,
  onEdit,
  onSave,
  onClose,
  onOpenSettings,
}: AuthOverlayContentProps) {
  const disabled = !form.available || !form.writable || form.saving;
  const saveDisabled = disabled || !form.dirty || form.invalid || form.workspaceRoot.text === '';
  return (
    <div>
      <AuthPanel t={t} controller={controller} />
      <WorkspaceSelect
        t={t}
        useWorkspaces={useWorkspaces}
        value={form.workspaceRoot.text}
        disabled={disabled}
        invalid={form.workspaceRoot.invalid}
        onChange={onEdit}
      />
      {form.failed ? <p style={failedStyle}>{t('config.saveFailed')}</p> : null}
      <div style={actionsStyle}>
        <button type="button" style={secondaryStyle} onClick={onClose}>
          {t('auth.close')}
        </button>
        {onOpenSettings === undefined ? null : (
          <button type="button" style={secondaryStyle} onClick={onOpenSettings}>
            {t('auth.openSettings')}
          </button>
        )}
        <button
          type="button"
          style={{ ...primaryStyle, ...(saveDisabled ? disabledButtonStyle : {}) }}
          disabled={saveDisabled}
          onClick={onSave}
        >
          {form.saving ? t('config.saving') : t('config.saveSelection')}
        </button>
      </div>
    </div>
  );
}

/** 共用设置弹窗。 */
export function AuthOverlay(props: AuthOverlayProps) {
  const { t, controller } = props;
  const { status } = useStatusSnapshot(controller);
  const form = props.useConfigForm((value) => value);
  const workspacePaths = useWorkspaceItems(props.useWorkspaces).map((item) => item.path);
  const signature = getAuthOverlaySignature(status, form.workspaceRoot.text, workspacePaths);
  const [state, dispatch] = useReducer(
    reduceAuthOverlayState,
    INITIAL_AUTH_OVERLAY_STATE,
    (initial) => ({ ...initial, signature, open: signature !== '' }),
  );
  const wasSaving = useRef(false);

  useEffect(() => {
    dispatch({ type: 'sync', signature });
  }, [signature]);

  useEffect(() => {
    if (wasSaving.current && !form.saving) {
      dispatch({
        type: 'saveSettled',
        saving: form.saving,
        dirty: form.dirty,
        failed: form.failed,
      });
    }
    wasSaving.current = form.saving;
  }, [form.saving, form.dirty, form.failed]);

  if (!state.open) return null;

  const onClose = (): void => {
    if (state.editing) {
      props.discard();
      dispatch({ type: 'discard' });
      return;
    }
    dispatch({ type: 'dismiss' });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={t('auth.title')}
      closeLabel={t('auth.close')}
      description={t('auth.description')}
      tone="warning"
    >
      <AuthOverlayContent
        t={t}
        controller={controller}
        useWorkspaces={props.useWorkspaces}
        form={form}
        onEdit={(path) => {
          dispatch({ type: 'editStart' });
          props.edit('workspaceRoot', path);
        }}
        onSave={() => {
          dispatch({ type: 'saveStart' });
          props.save();
        }}
        onClose={onClose}
        onOpenSettings={() => {
          props.openSettings();
          dispatch({ type: 'dismiss' });
        }}
      />
    </Modal>
  );
}

const actionsStyle: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  paddingTop: 12,
};

const buttonBase: CSSProperties = {
  padding: '4px 10px',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

const secondaryStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-button-tool-bar-fill, transparent)',
  color: 'var(--dsw-alias-label-primary)',
};

const primaryStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--dsw-alias-brand-fill, #0969da)',
  background: 'var(--dsw-alias-brand-fill, #0969da)',
  color: 'var(--dsw-alias-label-on-brand, #fff)',
};

const disabledButtonStyle: CSSProperties = {
  borderColor: 'var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-button-tool-bar-fill, transparent)',
  color: 'var(--dsw-alias-label-secondary)',
  cursor: 'not-allowed',
  opacity: 0.65,
};

const failedStyle: CSSProperties = {
  margin: '8px 0 0',
  fontSize: 12,
  color: 'var(--dsw-alias-error-fill, #cf222e)',
};
