/**
 * `lark_notify` 成功通知卡片：显示完整正文与来源会话，提供有效会话的跳转入口。
 * 注册到 `conversation.chat.node` 的 `lark-notify` 键，节点由 `notify-node.ts` 产出。
 */
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import './notify-card.css';
import type { BridgeKey } from './locales.ts';
import type { NotifyCardData } from './notify-node.ts';

/** 宿主工作区快照类型。 */
type WorkspaceSnapshot = Parameters<
  Parameters<GlobalStandardProps['useWorkspaces']>[0]
>[0];

/** 本组件用到的槽位 props 子集。 */
export interface NotifyCardProps {
  readonly node: { readonly data: NotifyCardData };
  readonly useWorkspaces: GlobalStandardProps['useWorkspaces'];
  readonly openSession: (sessionId: string) => void;
  readonly t?: ((key: BridgeKey) => string) | undefined;
}

/** 翻译座缺席时的英文文案。 */
const FALLBACK: Partial<Record<BridgeKey, string>> = {
  'notify.session': 'Session',
  'notify.openSession': 'Open session',
};

/** 取界面文案；翻译座缺失时回退英文。 */
function translate(t: NotifyCardProps['t'], key: BridgeKey): string {
  const resolved = t?.(key);
  return typeof resolved === 'string' && resolved !== '' && resolved !== key
    ? resolved
    : (FALLBACK[key] ?? key);
}

/** 渲染通知正文与来源会话状态。 */
export function NotifyCard({ node, useWorkspaces, openSession, t }: NotifyCardProps) {
  const { text, sessionId } = node.data;
  const sessionState = useWorkspaces((state: WorkspaceSnapshot): 'active' | 'archived' | 'missing' | 'unassociated' => {
    if (sessionId === undefined) return 'unassociated';
    const id = sessionId as SessionId;
    if (state.archivedSessionIds.includes(id)) return 'archived';
    return state.items.some((workspace: { readonly sessionIds: readonly SessionId[] }) =>
      workspace.sessionIds.includes(id),
    )
      ? 'active'
      : 'missing';
  });
  const canOpen = sessionState === 'active';
  return (
    <section className="dsh-lark-notify" data-dsh-lark-notify-card="">
      <div className="dsh-lark-notify-body">{text}</div>
      {sessionId === undefined ? null : (
        <footer className="dsh-lark-notify-session" data-dsh-lark-notify-session="">
          <span className="dsh-lark-notify-session-label">{translate(t, 'notify.session')}</span>
          {canOpen ? (
            <button
              type="button"
              className="dsh-lark-notify-session-link"
              data-dsh-lark-notify-session-link=""
              aria-label={`${translate(t, 'notify.openSession')} ${sessionId}`}
              title={sessionId}
              onClick={() => openSession(sessionId)}
            >
              {sessionId}
            </button>
          ) : (
            <span className="dsh-lark-notify-session-id" title={sessionId}>
              {sessionId}
            </span>
          )}
        </footer>
      )}
    </section>
  );
}
