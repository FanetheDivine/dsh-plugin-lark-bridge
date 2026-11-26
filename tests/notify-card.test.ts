// @vitest-environment jsdom
// lark_notify 正文卡片测试：只显示原始文本，保留换行，不渲染附加字段。
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { NotifyCard } from '../src/client/notify-card.tsx';

/** 渲染一份通知正文。 */
function render(text: string): string {
  return renderToStaticMarkup(createElement(NotifyCard, { node: { data: { text } } }));
}

describe('NotifyCard', () => {
  it('只显示完整正文并保留换行', () => {
    const html = render('第一行\n第二行');
    expect(html).toContain('data-dsh-lark-notify-card');
    expect(html).toContain('第一行\n第二行');
    expect(html).toContain('dsh-lark-notify-body');
  });

  it('Markdown 记号按原文显示，不出现标题、回执或分段信息', () => {
    const html = render('**不是粗体**\n- 不是列表');
    expect(html).toContain('**不是粗体**');
    expect(html).not.toContain('<strong>');
    expect(html).not.toContain('<ul>');
    expect(html).not.toContain('飞书通知');
    expect(html).not.toContain('已发送');
    expect(html).not.toContain('已回复');
    expect(html).not.toContain('messageId');
  });

  it('组件只有一个正文区域', () => {
    const html = render('正文');
    const container = document.createElement('div');
    container.innerHTML = html;
    const section = container.querySelector('section');
    expect(section?.children).toHaveLength(1);
    expect(section?.textContent).toBe('正文');
  });
});
