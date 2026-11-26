// @vitest-environment jsdom
// lark_notify 卡片测试：正文、来源会话链接、归档标记与历史兼容。
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { en, type NS, zh } from '../src/client/locales.ts';
import { NotifyCard, type NotifyCardProps } from '../src/client/notify-card.tsx';

const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

interface RenderOptions {
  readonly sessionId?: string;
  readonly known?: boolean;
  readonly archived?: boolean;
  readonly openSession?: (sessionId: string) => void;
}

/** 构造通知卡片及固定会话快照。 */
function cardProps(options: RenderOptions = {}): NotifyCardProps {
  const sessionId = options.sessionId;
  const known = options.known ?? true;
  const archived = options.archived ?? false;
  const useWorkspaces = (<S>(selector: (state: unknown) => S): S =>
    selector({
      items: known && sessionId !== undefined ? [{ sessionIds: [sessionId] }] : [],
      archivedSessionIds: archived && sessionId !== undefined ? [sessionId] : [],
    })) as NotifyCardProps['useWorkspaces'];
  return {
    node: { data: { text: '第一行\n第二行', ...(sessionId === undefined ? {} : { sessionId }) } },
    t,
    useWorkspaces,
    openSession: options.openSession ?? vi.fn(),
  };
}

/** 静态渲染一张通知卡片。 */
function render(options: RenderOptions = {}): string {
  return renderToStaticMarkup(createElement(NotifyCard, cardProps(options)));
}

describe('NotifyCard 正文', () => {
  it('只显示完整正文并保留换行', () => {
    const html = render();
    expect(html).toContain('data-dsh-lark-notify-card');
    expect(html).toContain('第一行\n第二行');
    expect(html).toContain('dsh-lark-notify-body');
    expect(html).not.toContain('dsh-lark-notify-session');
  });

  it('Markdown 记号按原文显示，不出现标题、回执或分段信息', () => {
    const html = renderToStaticMarkup(
      createElement(NotifyCard, {
        ...cardProps(),
        node: { data: { text: '**不是粗体**\n- 不是列表' } },
      }),
    );
    expect(html).toContain('**不是粗体**');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('飞书通知');
    expect(html).not.toContain('已发送');
    expect(html).not.toContain('已回复');
    expect(html).not.toContain('messageId');
  });

  it('历史通知只有一个正文区域', () => {
    const container = document.createElement('div');
    container.innerHTML = render();
    const section = container.querySelector('section');
    expect(section?.children).toHaveLength(1);
    expect(section?.textContent).toBe('第一行\n第二行');
  });
});

describe('NotifyCard 会话链接', () => {
  it('有效未归档会话显示完整标识和链接', () => {
    const html = render({ sessionId: 'session-1' });
    expect(html).toContain('会话');
    expect(html).toContain('session-1');
    expect(html).toContain('data-dsh-lark-notify-session-link');
    expect(html).toContain('打开会话 session-1');
    expect(html).not.toContain('已归档');
  });

  it('目录中的未知会话只显示只读标识', () => {
    const html = render({ sessionId: 'session-missing', known: false });
    expect(html).toContain('session-missing');
    expect(html).toContain('dsh-lark-notify-session-id');
    expect(html).not.toContain('data-dsh-lark-notify-session-link');
  });

  it('已归档会话显示特殊标记且不能跳转', () => {
    const html = render({ sessionId: 'session-archived', archived: true });
    expect(html).toContain('session-archived');
    expect(html).toContain('已归档');
    expect(html).toContain('data-dsh-lark-notify-archived');
    expect(html).not.toContain('data-dsh-lark-notify-session-link');
  });

  it('点击链接以来源 sessionId 调用宿主导航', async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const openSession = vi.fn();
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(NotifyCard, cardProps({ sessionId: 'session-1', openSession })));
    });
    const button = container.querySelector('button');
    expect(button).not.toBeNull();
    await act(async () => button?.click());
    expect(openSession).toHaveBeenCalledWith('session-1');
    await act(async () => root.unmount());
    container.remove();
  });
});

describe('NotifyCard 文案', () => {
  it('会话与归档文案键在中英文字典中都有值', () => {
    for (const key of ['notify.session', 'notify.openSession', 'notify.archived'] as const) {
      expect(zh[key]).not.toBe('');
      expect(en[key]).not.toBe('');
    }
  });
});
