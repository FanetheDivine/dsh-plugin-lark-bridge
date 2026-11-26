/**
 * `lark_notify` 成功通知的正文卡片：只显示完整原始文本，保留换行。
 * 注册到 `conversation.chat.node` 的 `lark-notify` 键，节点由 `notify-node.ts` 产出。
 */
import './notify-card.css';
import type { NotifyCardData } from './notify-node.ts';

/** 本组件用到的槽位 props 子集。 */
export interface NotifyCardProps {
  readonly node: { readonly data: NotifyCardData };
}

/** 渲染只含正文的通知卡片。 */
export function NotifyCard({ node }: NotifyCardProps) {
  return (
    <section className="dsh-lark-notify" data-dsh-lark-notify-card="">
      <div className="dsh-lark-notify-body">{node.data.text}</div>
    </section>
  );
}
