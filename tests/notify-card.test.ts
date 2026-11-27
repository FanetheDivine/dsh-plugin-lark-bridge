// @vitest-environment jsdom
// lark_notify 卡片测试：热区折叠、两种模式默认状态、常显任务/会话行、归档标记与历史兼容。
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { en, type NS, zh } from '../src/client/locales.ts';
import { NotifyCard, type NotifyCardProps } from '../src/client/notify-card.tsx';

const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

interface RenderOptions {
  readonly sessionId?: string;
  readonly summary?: string;
  readonly taskId?: string;
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
    node: {
      data: {
        text: '第一行\n第二行',
        ...(options.summary === undefined ? {} : { summary: options.summary }),
        ...(options.taskId === undefined ? {} : { taskId: options.taskId }),
        ...(sessionId === undefined ? {} : { sessionId }),
      },
    },
    t,
    useWorkspaces,
    openSession: options.openSession ?? vi.fn(),
  };
}

/** 静态渲染一张通知卡片。 */
function render(options: RenderOptions = {}): string {
  return renderToStaticMarkup(createElement(NotifyCard, cardProps(options)));
}

/** 把卡片挂到文档并返回容器与卸载函数。 */
async function mount(options: RenderOptions = {}) {
  const { createRoot } = await import('react-dom/client');
  const { act } = await import('react');
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(createElement(NotifyCard, cardProps(options)));
  });
  return {
    container,
    act,
    unmount: async () => {
      await act(async () => root.unmount());
      container.remove();
    },
  };
}

describe('NotifyCard 正文', () => {
  it('文本模式默认展开，显示完整正文并保留换行', () => {
    const html = render();
    expect(html).toContain('data-dsh-lark-notify-card');
    expect(html).toContain('data-expanded="true"');
    expect(html).toContain('data-dsh-lark-notify-toggle');
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

  it('历史通知只有一个正文区域，没有任务与会话行', () => {
    const container = document.createElement('div');
    container.innerHTML = render();
    const section = container.querySelector('section');
    expect(section?.querySelectorAll('.dsh-lark-notify-body')).toHaveLength(1);
    expect(section?.querySelector('.dsh-lark-notify-body')?.textContent).toBe('第一行\n第二行');
    expect(section?.querySelector('.dsh-lark-notify-meta')).toBeNull();
  });
});

describe('NotifyCard 热区折叠', () => {
  it('文本模式热区显示「通知」标题，点击收起正文，再次点击展开', async () => {
    const { container, act, unmount } = await mount();
    const card = container.querySelector('.dsh-lark-notify');
    const toggle = container.querySelector<HTMLButtonElement>('[data-dsh-lark-notify-toggle]');
    expect(toggle?.getAttribute('type')).toBe('button');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('收起');
    expect(toggle?.querySelector('.dsh-lark-notify-title')?.textContent).toBe('通知');
    expect(container.querySelector('.dsh-lark-notify-body')).not.toBeNull();

    await act(async () => toggle?.click());
    expect(card?.getAttribute('data-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('展开');
    expect(container.querySelector('.dsh-lark-notify-body')).toBeNull();

    await act(async () => toggle?.click());
    expect(card?.getAttribute('data-expanded')).toBe('true');
    expect(container.querySelector('.dsh-lark-notify-body')?.textContent).toBe('第一行\n第二行');
    await unmount();
  });

  it('卡片模式默认折叠，总结在热区内，点击展开完整正文', async () => {
    const html = render({ summary: 'xxx 任务已完成' });
    expect(html).toContain('data-expanded="false"');
    expect(html).toContain('data-dsh-lark-notify-summary');
    expect(html).not.toContain('<details');
    expect(html).not.toContain('dsh-lark-notify-body');

    const { container, act, unmount } = await mount({ summary: 'xxx 任务已完成' });
    const card = container.querySelector('.dsh-lark-notify');
    const toggle = container.querySelector<HTMLButtonElement>('[data-dsh-lark-notify-toggle]');
    expect(toggle?.querySelector('[data-dsh-lark-notify-summary]')?.textContent).toBe(
      'xxx 任务已完成',
    );
    expect(toggle?.getAttribute('aria-label')).toBe('展开');

    await act(async () => toggle?.click());
    expect(card?.getAttribute('data-expanded')).toBe('true');
    expect(container.querySelector('.dsh-lark-notify-body')?.textContent).toBe('第一行\n第二行');
    await unmount();
  });

  it('折叠态任务与会话行常显，点击会话链接不改变展开状态', async () => {
    const html = render({ summary: '总结', taskId: 'task-1', sessionId: 'session-1' });
    expect(html).toContain('data-expanded="false"');
    expect(html).toContain('data-dsh-lark-notify-task');
    expect(html).toContain('data-dsh-lark-notify-session-link');

    const openSession = vi.fn();
    const { container, act, unmount } = await mount({
      summary: '总结',
      taskId: 'task-1',
      sessionId: 'session-1',
      openSession,
    });
    const card = container.querySelector('.dsh-lark-notify');
    const link = container.querySelector<HTMLButtonElement>('[data-dsh-lark-notify-session-link]');
    await act(async () => link?.click());
    expect(openSession).toHaveBeenCalledWith('session-1');
    expect(card?.getAttribute('data-expanded')).toBe('false');
    await unmount();
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
    const openSession = vi.fn();
    const { container, act, unmount } = await mount({ sessionId: 'session-1', openSession });
    const button = container.querySelector<HTMLButtonElement>(
      '[data-dsh-lark-notify-session-link]',
    );
    expect(button).not.toBeNull();
    await act(async () => button?.click());
    expect(openSession).toHaveBeenCalledWith('session-1');
    await unmount();
  });
});

describe('NotifyCard 卡片模式与任务', () => {
  it('带 task_id 时显示任务标识，并链接到任务会话', () => {
    const html = render({ taskId: 'task-1', sessionId: 'session-task-1' });
    expect(html).toContain('data-dsh-lark-notify-task');
    expect(html).toContain('任务');
    expect(html).toContain('task-1');
    expect(html).toContain('data-dsh-lark-notify-session-link');
    expect(html).toContain('打开会话 session-task-1');
  });

  it('任务会话已归档时沿用已归档标记', () => {
    const html = render({ taskId: 'task-1', sessionId: 'session-task-1', archived: true });
    expect(html).toContain('已归档');
    expect(html).not.toContain('data-dsh-lark-notify-session-link');
  });

  it('不带 task_id 且没有元数据时不显示任务与会话', () => {
    const html = render();
    expect(html).not.toContain('data-dsh-lark-notify-task');
    expect(html).not.toContain('dsh-lark-notify-session');
  });
});

describe('NotifyCard 文案', () => {
  it('会话、归档与热区文案键在中英文字典中都有值', () => {
    for (const key of [
      'notify.session',
      'notify.openSession',
      'notify.archived',
      'notify.task',
      'notify.title',
      'notify.collapse',
      'notify.expand',
    ] as const) {
      expect(zh[key]).not.toBe('');
      expect(en[key]).not.toBe('');
    }
  });

  it('缺少翻译函数时使用英文回退', () => {
    const textMode = renderToStaticMarkup(
      createElement(NotifyCard, { ...cardProps(), t: undefined }),
    );
    expect(textMode).toContain('Notification');
    expect(textMode).toContain('aria-label="Collapse"');
    const cardMode = renderToStaticMarkup(
      createElement(NotifyCard, { ...cardProps({ summary: 'done' }), t: undefined }),
    );
    expect(cardMode).toContain('aria-label="Expand"');
  });
});
