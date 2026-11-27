/**
 * `lark_notify` 成功通知卡片：分隔线上方整块是折叠热区，任务与会话行常显。
 * 卡片模式热区显示总结、默认折叠；文本模式热区显示「通知」标题、默认展开。
 * 注册到 `conversation.chat.node` 的 `lark-notify` 键，节点由 `notify-node.ts` 产出。
 */
import {
  IconChevronDownOutlineRegular,
  IconPaperPlaneOutlineRegular,
  Tag,
} from '@deepseek-ai/dsh-client-ui-primitives';
import type { GlobalStandardProps } from '@deepseek-ai/dsh-client-ui-slots';
import type {} from '@deepseek-ai/dsh-client-ui-workspace/client';
import type { SessionId } from '@deepseek-ai/dsh-session/types';
import { useState } from 'react';
import './notify-card.css';
import type { BridgeKey } from './locales.ts';
import type { NotifyCardData } from './notify-node.ts';

/** 宿主工作区快照类型。 */
type WorkspaceSnapshot = Parameters<Parameters<GlobalStandardProps['useWorkspaces']>[0]>[0];

/** 本组件用到的槽位 props 子集。 */
export interface NotifyCardProps {
  readonly node: { readonly data: NotifyCardData };
  readonly useWorkspaces: GlobalStandardProps['useWorkspaces'];
  readonly openSession: (sessionId: string) => void;
  readonly t?: ((key: BridgeKey) => string) | undefined;
}

/** 翻译座缺席时的英文文案。 */
const FALLBACK: Partial<Record<BridgeKey, string>> = {
  'notify.title': 'Notification',
  'notify.task': 'Task',
  'notify.collapse': 'Collapse',
  'notify.expand': 'Expand',
  'notify.session': 'Session',
  'notify.openSession': 'Open session',
  'notify.archived': 'Archived',
};

/** 取界面文案；翻译座缺失时回退英文。 */
function translate(t: NotifyCardProps['t'], key: BridgeKey): string {
  const resolved = t?.(key);
  return typeof resolved === 'string' && resolved !== '' && resolved !== key
    ? resolved
    : (FALLBACK[key] ?? key);
}

/** 渲染通知卡片：热区切换正文折叠，任务与会话行常显在底部。 */
export function NotifyCard({ node, useWorkspaces, openSession, t }: NotifyCardProps) {
  const { text, summary, taskId, sessionId } = node.data;
  const [expanded, setExpanded] = useState(summary === undefined);
  const sessionState = useWorkspaces(
    (state: WorkspaceSnapshot): 'active' | 'archived' | 'missing' | 'unassociated' => {
      if (sessionId === undefined) return 'unassociated';
      const id = sessionId as SessionId;
      if (state.archivedSessionIds.includes(id)) return 'archived';
      return state.items.some((workspace: { readonly sessionIds: readonly SessionId[] }) =>
        workspace.sessionIds.includes(id),
      )
        ? 'active'
        : 'missing';
    },
  );
  const canOpen = sessionState === 'active';
  const toggleLabel = translate(t, expanded ? 'notify.collapse' : 'notify.expand');
  return (
    <section
      className="dsh-lark-notify"
      data-dsh-lark-notify-card=""
      data-expanded={expanded ? 'true' : 'false'}
    >
      <button
        type="button"
        className="dsh-lark-notify-head"
        data-dsh-lark-notify-toggle=""
        aria-expanded={expanded}
        aria-label={toggleLabel}
        onClick={() => setExpanded((previous) => !previous)}
      >
        <span className="dsh-lark-notify-icon" aria-hidden>
          <IconPaperPlaneOutlineRegular size={14} />
        </span>
        {summary === undefined ? (
          <span className="dsh-lark-notify-title">{translate(t, 'notify.title')}</span>
        ) : (
          <span className="dsh-lark-notify-summary" data-dsh-lark-notify-summary="">
            {summary}
          </span>
        )}
        <IconChevronDownOutlineRegular size={12} className="dsh-lark-notify-toggle-icon" />
      </button>
      {expanded ? <div className="dsh-lark-notify-body">{text}</div> : null}
      {taskId === undefined && sessionId === undefined ? null : (
        <footer className="dsh-lark-notify-meta">
          {taskId === undefined ? null : (
            <footer className="dsh-lark-notify-session" data-dsh-lark-notify-task="">
              <span className="dsh-lark-notify-session-label">{translate(t, 'notify.task')}</span>
              <span className="dsh-lark-notify-session-id" title={taskId}>
                {taskId}
              </span>
            </footer>
          )}
          {sessionId === undefined ? null : (
            <footer className="dsh-lark-notify-session" data-dsh-lark-notify-session="">
              <span className="dsh-lark-notify-session-label">
                {translate(t, 'notify.session')}
              </span>
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
              {sessionState === 'archived' ? (
                <span className="dsh-lark-notify-archived" data-dsh-lark-notify-archived="">
                  <Tag tone="neutral">{translate(t, 'notify.archived')}</Tag>
                </span>
              ) : null}
            </footer>
          )}
        </footer>
      )}
    </section>
  );
}
