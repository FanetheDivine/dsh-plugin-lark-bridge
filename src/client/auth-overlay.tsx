/** 全局连接弹窗：连接未就绪时展示三个状态区与终端命令。 */
import { Modal } from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { AuthPanel } from './auth-panel.tsx';
import type { NS } from './locales.ts';
import { type StatusController, useStatusSnapshot } from './status-controller.ts';

/** 弹窗 props。 */
export interface AuthOverlayProps {
  readonly t: TranslateNS<typeof NS>;
  readonly controller: StatusController;
  /** 打开设置面板。 */
  readonly openSettings: () => void;
}

/** 连接弹窗。 */
export function AuthOverlay({ t, controller, openSettings }: AuthOverlayProps) {
  const { status } = useStatusSnapshot(controller);
  const [dismissed, setDismissed] = useState(false);
  const lastReady = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    if (lastReady.current === true && !status.ready) setDismissed(false);
    lastReady.current = status.ready;
  }, [status.ready]);

  if (status.ready || dismissed) return null;

  return (
    <Modal
      open
      onClose={() => setDismissed(true)}
      title={t('auth.title')}
      closeLabel={t('auth.close')}
      description={t('auth.description')}
      tone="warning"
      footer={
        <div style={footerStyle}>
          <button type="button" style={secondaryStyle} onClick={() => setDismissed(true)}>
            {t('auth.close')}
          </button>
          <div style={spacerStyle} />
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
      <AuthPanel t={t} controller={controller} />
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
