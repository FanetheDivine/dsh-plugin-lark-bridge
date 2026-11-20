/** 只读终端命令：展示需要在插件外执行的命令，并在右侧提供复制。 */
import {
  Button,
  IconCheckOutlineRegular,
  useClipboardCopy,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import type { CSSProperties } from 'react';

import type { NS } from './locales.ts';

/** 命令组件属性。 */
export interface TerminalCommandProps {
  readonly kind: 'cli' | 'bot' | 'user';
  readonly command: string;
  readonly t: TranslateNS<typeof NS>;
}

/** 展示一条可选择文本的只读命令与复制按钮。 */
export function TerminalCommand({ kind, command, t }: TerminalCommandProps) {
  const { copied, onCopy } = useClipboardCopy(command);
  const label = copied ? t('auth.command.copied') : t('auth.command.copy');
  return (
    <div style={rowStyle} data-dsh-lark-command-row={kind}>
      <code data-dsh-lark-command={kind} style={commandStyle}>
        {command}
      </code>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        style={copyButtonStyle}
        aria-label={label}
        title={label}
        data-copied={copied ? '' : undefined}
        icon={copied ? <IconCheckOutlineRegular size={16} /> : <CopyIcon />}
        onClick={onCopy}
      />
    </div>
  );
}

/** 复制图标：宿主没有对应图标，用 16px 描边 SVG。 */
function CopyIcon() {
  return (
    <svg
      viewBox="0 0 16 16"
      width={16}
      height={16}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="5.75" y="5.75" width="7.5" height="7.5" rx="1.5" />
      <path d="M10.25 3.25h-4.5A1.5 1.5 0 0 0 4.25 4.75v4.5" />
    </svg>
  );
}

const rowStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
};

const commandStyle: CSSProperties = {
  flex: '1 1 auto',
  minWidth: 0,
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

const copyButtonStyle: CSSProperties = {
  flex: 'none',
  width: 28,
  padding: 0,
  color: 'var(--dsw-alias-label-secondary)',
};
