/** 本机 lark-cli 安装命令：仅在 CLI 缺失时展示只读命令。 */
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CSSProperties } from 'react';

import type { AuthStage } from './api.ts';
import type { NS } from './locales.ts';

/** 安装命令组件属性。 */
export interface CliInstallCommandProps {
  readonly t: TranslateNS<typeof NS>;
  readonly stage: AuthStage;
}

/** 在 `cli-missing` 阶段显示安装并初始化命令。 */
export function CliInstallCommand({ t, stage }: CliInstallCommandProps) {
  if (stage !== 'cli-missing') return null;
  return (
    <code data-dsh-lark-install-command style={commandStyle}>
      {t('auth.installCommand')}
    </code>
  );
}

const commandStyle: CSSProperties = {
  display: 'block',
  padding: '6px 8px',
  borderRadius: 'var(--dsw-radius-sm, 6px)',
  background: 'var(--dsw-alias-bg-secondary, transparent)',
  color: 'var(--dsw-alias-label-primary)',
  fontFamily: 'monospace',
  fontSize: 12,
  lineHeight: '18px',
  overflowWrap: 'anywhere',
  userSelect: 'text',
};
