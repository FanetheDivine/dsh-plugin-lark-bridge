// send_report 卡片测试：准备、完成与失败三种阶段的类型、任务简介、正文与附件。
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

import { type NS, zh } from '../src/client/locales.ts';
import { ReportCard, type ReportCardProps } from '../src/client/report-card.tsx';

/** 中文翻译座；未知键返回 undefined，与卡片的回退逻辑一致。 */
const t = ((key: keyof typeof zh) => zh[key]) as TranslateNS<typeof NS>;

/** 一份完整的上报参数。 */
const ARGS = {
  kind: 'progress',
  desc: '  修复登录重试  ',
  text: '已定位到重试逻辑。',
  files: ['/tmp/report.md', 42, '/tmp/log.txt'],
};

/** 渲染卡片。 */
function render(props: Partial<ReportCardProps> & Pick<ReportCardProps, 'phase'>): string {
  return renderToStaticMarkup(
    createElement(ReportCard, { t, block: { argsRaw: JSON.stringify(ARGS) }, ...props }),
  );
}

/** 结果正文：工具输出的 JSON 文本。 */
function resultContent(value: unknown) {
  return [{ type: 'text', text: JSON.stringify(value) }];
}

describe('ReportCard 准备阶段', () => {
  it('显示类型、去空白的任务简介、正文与附件，没有送达状态', () => {
    const html = render({ phase: 'preparing' });
    expect(html).toContain('data-dsh-lark-report-card="progress"');
    expect(html).toContain('上报');
    expect(html).toContain('进度');
    expect(html).toContain('任务: 修复登录重试<');
    expect(html).toContain('<div data-markdown="compact">已定位到重试逻辑。</div>');
    expect(html).toContain('附件');
    expect(html).toContain('<code>/tmp/report.md</code>');
    expect(html).toContain('<code>/tmp/log.txt</code>');
    expect(html).not.toContain('42');
    expect(html).not.toContain('已送达');
    expect(html).not.toContain('未送达');
  });

  it('参数不完整时只显示标题', () => {
    const html = render({ phase: 'preparing', block: { argsRaw: '{"kind":"prog' } });
    expect(html).toContain('data-dsh-lark-report-card="report"');
    expect(html).toContain('上报');
    expect(html).not.toContain('进度');
    expect(html).not.toContain('任务:');
    expect(html).not.toContain('data-markdown');
    expect(html).not.toContain('附件');
  });

  it('缺少参数、空白简介与空附件时省略对应部分', () => {
    expect(render({ phase: 'start', block: {} })).toContain('data-dsh-lark-report-card="report"');
    const html = render({
      phase: 'start',
      block: { argsRaw: JSON.stringify({ kind: 'question', desc: '   ', files: [] }) },
    });
    expect(html).toContain('提问');
    expect(html).not.toContain('任务:');
    expect(html).not.toContain('data-markdown');
    expect(html).not.toContain('附件');
  });

  it('未知类型原样显示', () => {
    const html = render({ phase: 'start', block: { argsRaw: '{"kind":"custom"}' } });
    expect(html).toContain('data-dsh-lark-report-card="custom"');
    expect(html).toContain('>custom<');
  });
});

describe('ReportCard 完成阶段', () => {
  it('显示已送达与上报编号，并保留类型、简介、正文与附件', () => {
    const html = render({
      phase: 'result',
      block: {
        argsRaw: JSON.stringify(ARGS),
        content: resultContent({ reportId: 'report-7', taskId: 'task-1', delivered: true }),
      },
    });
    expect(html).toContain('已送达 report-7');
    expect(html).toContain('进度');
    expect(html).toContain('任务: 修复登录重试<');
    expect(html).toContain('已定位到重试逻辑。');
    expect(html).toContain('<code>/tmp/report.md</code>');
    expect(html).not.toContain('未送达');
  });

  it('结果正文无法解析时只显示已送达', () => {
    const html = render({
      phase: 'result',
      block: { argsRaw: JSON.stringify(ARGS), content: [{ type: 'text', text: 'ok' }] },
    });
    expect(html).toContain('>已送达<');
  });
});

describe('ReportCard 失败阶段', () => {
  it('显示未送达与失败原因，并保留上报内容', () => {
    const html = render({
      phase: 'result',
      block: {
        argsRaw: JSON.stringify(ARGS),
        isError: true,
        error: { reason: 'session is not managed' },
      },
    });
    expect(html).toContain('未送达');
    expect(html).toContain('session is not managed');
    expect(html).not.toContain('已送达');
    expect(html).toContain('进度');
    expect(html).toContain('任务: 修复登录重试<');
    expect(html).toContain('已定位到重试逻辑。');
    expect(html).toContain('<code>/tmp/log.txt</code>');
  });

  it('没有失败原因时只显示未送达', () => {
    const html = render({ phase: 'result', block: { argsRaw: '{}', isError: true } });
    expect(html).toContain('未送达');
    expect(html).not.toContain('session is not managed');
  });
});

describe('ReportCard 文案', () => {
  it('缺少翻译函数时标题、简介、附件与送达状态使用英文回退', () => {
    const { t: _t, ...props } = {
      t,
      phase: 'result' as const,
      block: {
        argsRaw: JSON.stringify({ desc: 'Fix login', files: ['/a'] }),
        content: resultContent({ reportId: 'r-1' }),
      },
    };
    const html = renderToStaticMarkup(createElement(ReportCard, props));
    expect(html).toContain('Report');
    expect(html).toContain('Task: Fix login');
    expect(html).toContain('Files');
    expect(html).toContain('Delivered r-1');
    const failed = renderToStaticMarkup(
      createElement(ReportCard, { phase: 'result', block: { isError: true } }),
    );
    expect(failed).toContain('Not delivered');
  });

  it('卡片文案键都在字典中', () => {
    for (const key of [
      'report.title',
      'report.kind.progress',
      'report.kind.question',
      'report.desc',
      'report.files',
      'report.delivered',
      'report.failed',
    ] as const) {
      expect(zh[key]).toBeTruthy();
    }
  });
});
