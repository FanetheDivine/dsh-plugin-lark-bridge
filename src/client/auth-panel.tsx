/**
 * 配置页鉴权面板：展示阶段、启动设备码授权与重新检测。
 * 导出 AuthPanel。
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import {
  type ApiResult,
  type BridgeStatus,
  cancelLogin,
  checkAuth,
  fetchStatus,
  startLogin,
} from './api.ts';
import { CliInstallCommand } from './cli-install-command.tsx';
import type { NS } from './locales.ts';

/** 面板 props。 */
export interface AuthPanelProps {
  readonly t: TranslateNS<typeof NS>;
}

/** 从失败结果取提示文本。 */
function messageOf(result: ApiResult<unknown>, fallback: string): string {
  return result.ok ? '' : result.error.message === '' ? fallback : result.error.message;
}

/** 鉴权面板。 */
export function AuthPanel({ t }: AuthPanelProps) {
  const [status, setStatus] = useState<BridgeStatus | undefined>(undefined);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<'login' | 'check' | 'cancel' | undefined>(undefined);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    const result = await fetchStatus();
    if (!mounted.current) return;
    if (result.ok) {
      setStatus(result.data);
      setError('');
    } else {
      setError(result.error.message);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 3000);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, [refresh]);

  const apply = (result: ApiResult<BridgeStatus>, fallback: string): void => {
    if (!mounted.current) return;
    if (result.ok) {
      setStatus(result.data);
      setError('');
    } else {
      setError(messageOf(result, fallback));
    }
  };

  const onStart = async (): Promise<void> => {
    setBusy('login');
    try {
      const result = await startLogin();
      if (!mounted.current) return;
      if (result.ok) {
        setStatus((current) =>
          current === undefined ? current : { ...current, login: result.data },
        );
        setError('');
      } else {
        setError(result.error.message);
      }
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  const onCancel = async (): Promise<void> => {
    setBusy('cancel');
    try {
      const result = await cancelLogin();
      apply(result, '');
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  const onCheck = async (): Promise<void> => {
    setBusy('check');
    try {
      const result = await checkAuth();
      apply(result, '');
    } finally {
      if (mounted.current) setBusy(undefined);
    }
  };

  const stage = status?.stage ?? 'cli-missing';
  const ready = status?.ready === true;

  return (
    <section data-dsh-lark-auth-panel style={sectionStyle}>
      <header style={headerStyle}>
        <span style={ready ? okDotStyle : warnDotStyle} aria-hidden="true" />
        <span style={titleStyle}>{t(`auth.stage.${stage}`)}</span>
        <button
          type="button"
          style={linkButtonStyle}
          disabled={busy !== undefined}
          onClick={() => void onCheck()}
        >
          {busy === 'check' ? t('auth.checking') : t('auth.retry')}
        </button>
      </header>
      <p style={hintStyle}>{t(`auth.stage.${stage}.hint`)}</p>
      <CliInstallCommand t={t} stage={stage} />
      {status?.userName !== undefined && ready ? (
        <p style={metaStyle}>{t('auth.readyAccount', { name: status.userName })}</p>
      ) : null}
      {status?.appId !== undefined ? (
        <p style={metaStyle}>{t('auth.appIdLabel', { appId: status.appId })}</p>
      ) : null}
      {status?.detail !== undefined && status.detail !== '' ? (
        <p style={errorStyle}>{t('auth.detail', { detail: status.detail })}</p>
      ) : null}
      {error !== '' ? <p style={errorStyle}>{t('auth.actionError', { message: error })}</p> : null}

      {stage === 'user-missing' ? (
        <div style={formStyle}>
          {status?.login !== null && status?.login !== undefined ? (
            <>
              <a
                href={status.login.verificationUrl}
                target="_blank"
                rel="noreferrer"
                style={linkStyle}
              >
                {t('auth.openLink')}
              </a>
              <p style={metaStyle}>{t('auth.waiting')}</p>
              <button
                type="button"
                style={secondaryButtonStyle}
                disabled={busy !== undefined}
                onClick={() => void onCancel()}
              >
                {busy === 'cancel' ? t('auth.checking') : t('auth.cancel')}
              </button>
            </>
          ) : (
            <button
              type="button"
              style={primaryButtonStyle}
              disabled={busy !== undefined}
              onClick={() => void onStart()}
            >
              {busy === 'login' ? t('auth.starting') : t('auth.startLogin')}
            </button>
          )}
        </div>
      ) : null}
    </section>
  );
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '12px 0',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
};

const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
};

const dotStyle: CSSProperties = {
  width: 8,
  height: 8,
  borderRadius: 999,
  flex: 'none',
};

const okDotStyle: CSSProperties = {
  ...dotStyle,
  background: 'var(--dsw-alias-success-fill, #2da44e)',
};
const warnDotStyle: CSSProperties = {
  ...dotStyle,
  background: 'var(--dsw-alias-warning-fill, #bf8700)',
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
  flex: 1,
};

const hintStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
};

const metaStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
};

const errorStyle: CSSProperties = {
  ...metaStyle,
  color: 'var(--dsw-alias-error-fill, #cf222e)',
};

const formStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  paddingTop: 4,
};

const buttonBase: CSSProperties = {
  alignSelf: 'flex-start',
  padding: '4px 10px',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
};

const primaryButtonStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--dsw-alias-brand-fill, #0969da)',
  background: 'var(--dsw-alias-brand-fill, #0969da)',
  color: 'var(--dsw-alias-label-on-brand, #fff)',
};

const secondaryButtonStyle: CSSProperties = {
  ...buttonBase,
  border: '1px solid var(--dsw-alias-border-l2)',
  background: 'var(--dsw-alias-button-tool-bar-fill, transparent)',
  color: 'var(--dsw-alias-label-primary)',
};

const linkButtonStyle: CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--dsw-alias-label-link, #0969da)',
  font: 'inherit',
  fontSize: 12,
  cursor: 'pointer',
  padding: 0,
};

const linkStyle: CSSProperties = { ...linkButtonStyle, fontSize: 12, textDecoration: 'underline' };
