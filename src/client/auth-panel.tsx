/**
 * 连接状态面板：独立展示 CLI、bot、user，共用完整检测动作。
 * 导出 AuthPanel 与 AuthPanelStatus。
 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CSSProperties } from 'react';

import type { ConnectionState } from '../types.ts';
import type { BridgeStatus } from './api.ts';
import type { NS } from './locales.ts';
import { type StatusController, useStatusSnapshot } from './status-controller.ts';
import { TerminalCommand } from './terminal-command.tsx';

/** 面板翻译属性。 */
export interface AuthPanelProps {
  readonly t: TranslateNS<typeof NS>;
  readonly controller: StatusController;
}

/** 状态展示属性。 */
export interface AuthPanelStatusProps {
  readonly t: TranslateNS<typeof NS>;
  readonly status: BridgeStatus | undefined;
  readonly busy: boolean;
  readonly onCheck: () => void;
}

const CONNECTIONS = [
  { key: 'cli', name: 'auth.name.cli', check: 'auth.check.cli', command: 'auth.command.cli' },
  { key: 'bot', name: 'auth.name.bot', check: 'auth.check.bot', command: 'auth.command.bot' },
  { key: 'user', name: 'auth.name.user', check: 'auth.check.user', command: 'auth.command.user' },
] as const;

/** 只读连接状态与三个检测入口。 */
export function AuthPanelStatus({ t, status, busy, onCheck }: AuthPanelStatusProps) {
  return (
    <section data-dsh-lark-auth-panel style={sectionStyle}>
      {CONNECTIONS.map((connection) => {
        const state: ConnectionState = status?.[connection.key] ?? 'checking';
        return (
          <div key={connection.key} style={rowStyle} data-dsh-lark-connection={connection.key}>
            <div style={headerStyle}>
              <span
                style={{ ...dotStyle, ...stateDotStyle[state] }}
                data-state={state}
                aria-hidden="true"
              />
              <span style={titleStyle}>{t(connection.name)}</span>
              <span style={stateStyle}>{t(`auth.state.${state}`)}</span>
              <button type="button" style={linkButtonStyle} disabled={busy} onClick={onCheck}>
                {t(connection.check)}
              </button>
            </div>
            <TerminalCommand kind={connection.key} command={t(connection.command)} />
          </div>
        );
      })}
    </section>
  );
}

/** 从共享控制器读取状态的面板。 */
export function AuthPanel({ t, controller }: AuthPanelProps) {
  const snapshot = useStatusSnapshot(controller);
  return (
    <AuthPanelStatus
      t={t}
      status={snapshot.status}
      busy={snapshot.busy}
      onCheck={() => void controller.check()}
    />
  );
}

const sectionStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  padding: '12px 0',
  borderBottom: '0.5px solid var(--dsw-alias-border-l2)',
};

const rowStyle: CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 6,
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

const stateDotStyle: Record<ConnectionState, CSSProperties> = {
  checking: { background: 'var(--dsw-alias-warning-fill, #bf8700)' },
  connected: { background: 'var(--dsw-alias-success-fill, #2da44e)' },
  disconnected: { background: 'var(--dsw-alias-label-tertiary, #8c959f)' },
};

const titleStyle: CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: 'var(--dsw-alias-label-primary)',
};

const stateStyle: CSSProperties = {
  flex: 1,
  fontSize: 12,
  color: 'var(--dsw-alias-label-secondary)',
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
