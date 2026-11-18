/**
 * 全局鉴权弹窗：每次打开 GUI 读取状态，未就绪时显示可关闭的提示。
 * 导出 AuthOverlay。
 */
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useCallback, useEffect, useRef, useState } from 'react';

import { type BridgeStatus, checkAuth, fetchStatus } from './api.ts';
import type { NS } from './locales.ts';

/** 弹窗 props。 */
export interface AuthOverlayProps {
  readonly t: TranslateNS<typeof NS>;
  /** 打开设置面板。 */
  readonly openSettings: () => void;
}

/** 鉴权弹窗。 */
export function AuthOverlay({ t, openSettings }: AuthOverlayProps) {
  const [status, setStatus] = useState<BridgeStatus | undefined>(undefined);
  const [dismissed, setDismissed] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastReady = useRef<boolean | undefined>(undefined);

  const refresh = useCallback(async () => {
    const result = await fetchStatus();
    if (!result.ok) return;
    setStatus(result.data);
    if (lastReady.current === true && !result.data.ready) setDismissed(false);
    lastReady.current = result.data.ready;
  }, []);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, [refresh]);

  if (status === undefined || status.ready || dismissed) return null;

  const stage = status.stage;
  const hint = t(`auth.stage.${stage}.hint`);
  const detail =
    status.detail !== undefined && status.detail !== ''
      ? `\n${t('auth.detail', { detail: status.detail })}`
      : '';

  const onRetry = async (): Promise<void> => {
    setBusy(true);
    try {
      const result = await checkAuth();
      if (result.ok) {
        setStatus(result.data);
        lastReady.current = result.data.ready;
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open
      onClose={() => setDismissed(true)}
      title={t('auth.title')}
      closeLabel={t('auth.close')}
      description={`${hint}${detail}`}
      tone="warning"
      footer={
        <div style={footerStyle}>
          <button type="button" style={secondaryStyle} onClick={() => setDismissed(true)}>
            {t('auth.close')}
          </button>
          <div style={spacerStyle} />
          <button
            type="button"
            style={secondaryStyle}
            disabled={busy}
            onClick={() => void onRetry()}
          >
            {busy ? t('auth.checking') : t('auth.retry')}
          </button>
          <button
            type="button"
            style={primaryStyle}
            onClick={() => {
              openSettings();
              setDismissed(true);
            }}
          >
            {t('auth.openSettings')}
          </button>
        </div>
      }
    >
      <p style={bodyStyle}>{t('auth.description')}</p>
      {status.profile !== '' ? (
        <p style={bodyStyle}>{t('auth.profile', { profile: status.profile })}</p>
      ) : null}
    </Modal>
  );
}

const footerStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, width: '100%' };

const spacerStyle: CSSProperties = { flex: 1 };

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

const bodyStyle: CSSProperties = {
  margin: '0 0 6px',
  fontSize: 12,
  lineHeight: '18px',
  color: 'var(--dsw-alias-label-secondary)',
};
