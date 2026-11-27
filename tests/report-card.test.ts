// @vitest-environment jsdom
// send_report 上报卡片测试：类型标签、任务简介、正文、文件列表、回执与文案回退。
import type { TranslateNS } from '@deepseek-ai/dsh-client-ui-slots';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

// 平台 Markdown 渲染依赖 katex 等未安装的包，替换为原样输出正文的桩。
vi.mock('@deepseek-ai/dsh-client-ui-primitives', async (importOriginal) => {
  const { createElement } = await import('react');
  return {
    ...(await importOriginal<object>()),
    MarkdownText: (props: { text: string; variant?: string }) =>
      createElement('div', { 'data-markdown': props.variant ?? '' }, props.text),
  };
});

import { en, type NS, zh } from '../src/client/locales.ts';
import { ReportCard, type ReportCardProps } from '../src/client/report-card.tsx';
import type { ReportCardData } from '../src/client/report-node.ts';

/** 中文翻译座。 */
const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

/** 一份完整的卡片数据。 */
const DATA: ReportCardData = {
  kind: 'progress',
  desc: '修复登录重试',
  text: '已定位到重试逻辑。',
  files: ['/tmp/report.md', 'docs/log.txt'],
  reportId: 'report-7',
};

/** 渲染卡片。 */
function render(data: Partial<ReportCardData> = {}, props: Partial<ReportCardProps> = {}): string {
  return renderToStaticMarkup(
    createElement(ReportCard, { t, node: { data: { ...DATA, ...data } }, ...props }),
  );
}

describe('ReportCard 内容', () => {
  it('默认展开并显示类型、任务简介、正文、文件、回执与收起开关', () => {
    const html = render({}, { openFile: () => {} });
    expect(html).toContain('data-dsh-lark-report-card="progress"');
    expect(html).toContain('data-expanded="true"');
    expect(html).toContain('data-dsh-lark-report-toggle=""');
    expect(html).toContain('aria-expanded="true"');
    expect(html).toContain('aria-label="收起"');
    expect(html).toContain('上报');
    expect(html).toContain('进度');
    expect(html).toContain('修复登录重试');
    expect(html).not.toContain('dsh-lark-report-head-desc');
    expect(html).toContain('<div data-markdown="compact">已定位到重试逻辑。</div>');
    expect(html).toContain('附件');
    expect(html).toContain('>report.md<');
    expect(html).toContain('>/tmp/report.md<');
    expect(html).toContain('>log.txt<');
    expect(html).toContain('已送达');
    expect(html).toContain('report-7');
  });

  it('只有正文时省略简介与文件区', () => {
    const html = render({ desc: '', files: [] });
    expect(html).toContain('已定位到重试逻辑。');
    expect(html).not.toContain('dsh-lark-report-desc');
    expect(html).not.toContain('dsh-lark-report-files');
  });

  it('只有文件时省略正文区', () => {
    const html = render({ text: '' });
    expect(html).not.toContain('data-markdown');
    expect(html).toContain('>report.md<');
  });

  it('提问类型使用提问标签，未知类型原样显示，缺失类型不显示标签，且全部带有默认展开开关', () => {
    const question = render({ kind: 'question' });
    expect(question).toContain('提问');
    expect(question).toContain('aria-expanded="true"');
    const custom = render({ kind: 'custom' });
    expect(custom).toContain('data-dsh-lark-report-card="custom"');
    expect(custom).toContain('>custom<');
    expect(custom).toContain('aria-expanded="true"');
    const none = render({ kind: '' });
    expect(none).toContain('data-dsh-lark-report-card="report"');
    expect(none).not.toContain('进度');
    expect(none).toContain('aria-expanded="true"');
  });

  it('没有打开能力时文件按钮禁用，折叠按钮保持可用', () => {
    expect(render()).toContain(
      'class="dsh-lark-report-file" title="/tmp/report.md" aria-label="打开 /tmp/report.md" disabled=""',
    );
    expect(render({}, { openFile: () => {} })).not.toContain('disabled=""');
  });
});

describe('ReportCard 交互', () => {
  it('点击文件按原路径打开', async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const opened: string[] = [];
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(ReportCard, {
          t,
          node: { data: DATA },
          openFile: (path: string) => opened.push(path),
        }),
      );
    });
    const fileButtons = container.querySelectorAll<HTMLButtonElement>('.dsh-lark-report-file');
    expect(fileButtons).toHaveLength(2);
    await act(async () => {
      fileButtons[1]?.click();
    });
    expect(opened).toEqual(['docs/log.txt']);
    expect(fileButtons[0]?.getAttribute('aria-label')).toBe('打开 /tmp/report.md');
    await act(async () => root.unmount());
    container.remove();
  });

  it('点击折叠开关收起主体并保留标题与摘要行，再次点击恢复完整内容', async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(ReportCard, {
          t,
          node: { data: { ...DATA, kind: 'question' } },
          openFile: () => {},
        }),
      );
    });

    const card = container.querySelector('.dsh-lark-report');
    const toggle = container.querySelector<HTMLButtonElement>('[data-dsh-lark-report-toggle]');
    expect(card?.getAttribute('data-expanded')).toBe('true');
    expect(toggle?.getAttribute('type')).toBe('button');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('收起');
    expect(container.querySelector('.dsh-lark-report-desc')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-body')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-files')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-head-desc')).toBeNull();

    await act(async () => {
      toggle?.click();
    });

    expect(card?.getAttribute('data-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    expect(toggle?.getAttribute('aria-label')).toBe('展开');
    expect(toggle?.textContent).toBe('展开');
    expect(container.querySelector('.dsh-lark-report-desc')).toBeNull();
    expect(container.querySelector('.dsh-lark-report-body')).toBeNull();
    expect(container.querySelector('.dsh-lark-report-files')).toBeNull();
    expect(container.querySelector('.dsh-lark-report-head-desc')?.textContent).toBe('修复登录重试');
    expect(container.querySelector('.dsh-lark-report-title')?.textContent).toBe('上报');
    expect(container.querySelector('.dsh-lark-report-receipt')?.textContent).toContain('report-7');

    await act(async () => {
      toggle?.click();
    });

    expect(card?.getAttribute('data-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');
    expect(toggle?.getAttribute('aria-label')).toBe('收起');
    expect(container.querySelector('.dsh-lark-report-desc')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-body')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-files')).not.toBeNull();
    expect(container.querySelector('.dsh-lark-report-head-desc')).toBeNull();

    await act(async () => root.unmount());
    container.remove();
  });

  it('无 desc 时折叠后不显示空摘要占位', async () => {
    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(
        createElement(ReportCard, {
          t,
          node: { data: { ...DATA, desc: '' } },
        }),
      );
    });
    const toggle = container.querySelector<HTMLButtonElement>('[data-dsh-lark-report-toggle]');
    await act(async () => {
      toggle?.click();
    });
    expect(container.querySelector('.dsh-lark-report-head-desc')).toBeNull();
    expect(container.querySelector('.dsh-lark-report-body')).toBeNull();
    await act(async () => root.unmount());
    container.remove();
  });
});

describe('ReportCard 文案', () => {
  it('缺少翻译函数时使用英文回退', async () => {
    const html = renderToStaticMarkup(createElement(ReportCard, { node: { data: DATA } }));
    expect(html).toContain('Report');
    expect(html).toContain('Progress');
    expect(html).toContain('Task');
    expect(html).toContain('Files');
    expect(html).toContain('Delivered');
    expect(html).toContain('Collapse');

    const { createRoot } = await import('react-dom/client');
    const { act } = await import('react');
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);
    await act(async () => {
      root.render(createElement(ReportCard, { node: { data: DATA } }));
    });
    const toggle = container.querySelector<HTMLButtonElement>('[data-dsh-lark-report-toggle]');
    await act(async () => {
      toggle?.click();
    });
    expect(toggle?.getAttribute('aria-label')).toBe('Expand');
    await act(async () => root.unmount());
    container.remove();
  });

  it('卡片文案键在中英文字典中都有值', () => {
    for (const key of [
      'report.title',
      'report.kind.progress',
      'report.kind.question',
      'report.desc',
      'report.files',
      'report.delivered',
      'report.collapse',
      'report.expand',
      'report.openFile',
      'report.copy',
      'report.copied',
      'report.footnotes',
    ] as const) {
      expect(zh[key]).toBeTruthy();
      expect(en[key]).toBeTruthy();
    }
  });
});
