/**
 * 侧栏页脚的在场状态按钮：显示器表示在电脑旁，手机表示离开。
 * 导出 PresenceButton、PresenceIcon、presenceLabel、triggerStyle、RAIL_CSS 与 PRESENCE_SLOT_ID。
 */
// Type-only：拉取 sidebar.footer.action 槽位声明与其 owner props。
import type { SidebarFooterActionOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client';
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { type CSSProperties, type ReactNode, useState } from 'react';

import type { Presence } from './api.ts';
import type { NS } from './locales.ts';
import { type PresenceController, usePresenceSnapshot } from './presence-controller.ts';

/** 页脚动作槽位中的注册 id。 */
export const PRESENCE_SLOT_ID = 'lark-bridge-presence';

/** 在电脑旁的强调色。 */
const LOCAL_COLOR = 'var(--dsw-alias-state-success-primary, #2ea043)';

/** 离开时的次要文字色。 */
const REMOTE_COLOR = 'var(--dsw-alias-label-secondary)';

/** 切换失败时的错误色。 */
const FAILED_COLOR = 'var(--dsw-alias-state-error-primary)';

/** 折叠栏把页脚动作排成纵向一列；规则与参考插件一致。 */
export const RAIL_CSS = [
  '[data-sidebar-collapsed] [class*="footerActions"]:has(.lbp-entry[data-rail="rail"]) {',
  '  flex-direction: column;',
  '  align-items: center;',
  '  gap: 4px;',
  '}',
].join('\n');

/** 按钮属性：槽位注入的栏宽状态、翻译座与共享控制器。 */
export interface PresenceButtonProps extends SidebarFooterActionOwnerProps {
  readonly t: TranslateNS<typeof NS>;
  readonly controller: PresenceController;
}

/** 视图状态：`failed` 表示最近一次切换失败。 */
export interface PresenceButtonView {
  readonly presence: Presence;
  readonly failed?: boolean;
}

/** 悬停提示与读屏文案。 */
export function presenceLabel(t: TranslateNS<typeof NS>, view: PresenceButtonView): string {
  if (view.failed === true) return t('presence.failed');
  return view.presence === 'local'
    ? `${t('presence.local')} · ${t('presence.toRemote')}`
    : `${t('presence.remote')} · ${t('presence.toLocal')}`;
}

/** 当前图标颜色。 */
export function presenceColor(view: PresenceButtonView): string {
  if (view.failed === true) return FAILED_COLOR;
  return view.presence === 'local' ? LOCAL_COLOR : REMOTE_COLOR;
}

/** 触发器样式：36×36 圆形透明按钮，悬停时底色为当前色 12% 混合。 */
export function triggerStyle(color: string, hover: boolean): CSSProperties {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: 'none',
    background: hover ? `color-mix(in srgb, ${color} 12%, transparent)` : 'transparent',
    color,
    font: 'inherit',
    fontSize: 12,
    padding: 0,
    width: 36,
    height: 36,
    borderRadius: '50%',
    cursor: 'pointer',
    lineHeight: 1,
  };
}

/** 状态图标：显示器或手机，描边继承 currentColor。 */
export function PresenceIcon({ presence }: { presence: Presence }): ReactNode {
  return (
    <svg
      width={18}
      height={18}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      data-presence={presence}
    >
      {presence === 'local' ? (
        <>
          <rect x={3} y={4} width={18} height={12} rx={2} />
          <path d="M12 16v4" />
          <path d="M8 20h8" />
        </>
      ) : (
        <>
          <rect x={7} y={2.5} width={10} height={19} rx={2.5} />
          <path d="M11 18.5h2" />
        </>
      )}
    </svg>
  );
}

/** 页脚在场按钮。 */
export function PresenceButton({ wide, t, controller }: PresenceButtonProps): ReactNode {
  const snapshot = usePresenceSnapshot(controller);
  const [hover, setHover] = useState(false);
  const color = presenceColor(snapshot);
  const label = presenceLabel(t, snapshot);
  return (
    <div
      className="lbp-entry"
      style={{ flex: 'none', display: 'flex', alignItems: 'center', minWidth: 0 }}
      data-dsh-part="entry"
      data-rail={wide ? undefined : 'rail'}
    >
      <button
        type="button"
        style={triggerStyle(color, hover)}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        title={label}
        aria-label={label}
        data-presence={snapshot.presence}
      >
        <PresenceIcon presence={snapshot.presence} />
      </button>
    </div>
  );
}
