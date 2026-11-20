/** 只读终端命令：展示用户需要在插件外执行的命令。 */
import type { CSSProperties } from 'react';

/** 命令组件属性。 */
export interface TerminalCommandProps {
  readonly kind: 'cli' | 'bot' | 'user';
  readonly command: string;
}

/** 展示一条可选择文本的只读命令。 */
export function TerminalCommand({ kind, command }: TerminalCommandProps) {
  return (
    <code data-dsh-lark-command={kind} style={commandStyle}>
      {command}
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
