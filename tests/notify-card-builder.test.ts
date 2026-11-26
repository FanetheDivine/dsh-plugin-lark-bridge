// 卡片构造测试：结构、体积上限、拆分边界与序号。
import { describe, expect, it } from 'vitest';

import { buildCards, CARD_BYTE_LIMIT } from '../src/notify-card.ts';

const bytes = (card: unknown) => Buffer.byteLength(JSON.stringify(card), 'utf8');

/** 取第一张卡片；没有时直接失败。 */
function firstCard(cards: Record<string, unknown>[]): Record<string, unknown> {
  const [card] = cards;
  if (card === undefined) throw new Error('expected at least one card');
  return card;
}

function markdownOf(card: Record<string, unknown>): string {
  const body = card.body as { elements: Array<{ elements: Array<{ content: string }> }> };
  return body.elements[0]?.elements[0]?.content ?? '';
}

describe('buildCards', () => {
  it('短内容生成一张 Card 2.0：标题是总结，面板默认收起', () => {
    const cards = buildCards({ summary: '任务已完成', markdown: '# 结果\n\n全部通过' });
    expect(cards).toHaveLength(1);
    const card = firstCard(cards);
    expect(card).toMatchObject({ schema: '2.0' });
    expect((card.header as { title: { content: string } }).title.content).toBe('任务已完成');
    const panel = (card.body as { elements: Array<Record<string, unknown>> }).elements[0];
    expect(panel).toMatchObject({ tag: 'collapsible_panel', expanded: false });
    expect(markdownOf(card)).toBe('# 结果\n\n全部通过');
  });

  it('带任务名时写进副标题，不带时没有副标题', () => {
    const withTask = firstCard(
      buildCards({ summary: 's', markdown: 'm', taskLabel: '修复 (task-1)' }),
    );
    expect((withTask.header as { subtitle?: { content: string } }).subtitle?.content).toBe(
      '修复 (task-1)',
    );
    const without = firstCard(buildCards({ summary: 's', markdown: 'm' }));
    expect((without.header as { subtitle?: unknown }).subtitle).toBeUndefined();
  });

  it('总结压成单行并限长', () => {
    const card = firstCard(
      buildCards({ summary: `第一行\n第二行 ${'长'.repeat(300)}`, markdown: 'm' }),
    );
    const title = (card.header as { title: { content: string } }).title.content;
    expect(title.includes('\n')).toBe(false);
    expect(title.length).toBeLessThanOrEqual(200);
  });

  it('超长内容在段落边界拆成多张，每张不超过上限，拼回后无损，标题带序号', () => {
    const paragraphs = Array.from({ length: 80 }, (_, i) => `段落${i}：${'内容'.repeat(300)}`);
    const markdown = paragraphs.join('\n\n');
    const cards = buildCards({ summary: '报告', markdown, taskLabel: 'T (task-1)' });
    expect(cards.length).toBeGreaterThan(1);
    for (const [index, card] of cards.entries()) {
      expect(bytes(card)).toBeLessThanOrEqual(CARD_BYTE_LIMIT);
      expect((card.header as { title: { content: string } }).title.content).toBe(
        `报告（${index + 1}/${cards.length}）`,
      );
    }
    expect(cards.map((card) => markdownOf(card)).join('\n\n')).toBe(markdown);
    for (const card of cards) {
      expect(markdownOf(card).startsWith('段落')).toBe(true);
    }
  });

  it('单个超长段落按行拆分，单行超长按字符拆分，内容不丢失', () => {
    const longLine = '字'.repeat(40_000);
    const cards = buildCards({ summary: 's', markdown: `${longLine}\nend` });
    for (const card of cards) expect(bytes(card)).toBeLessThanOrEqual(CARD_BYTE_LIMIT);
    expect(
      cards
        .map((card) => markdownOf(card))
        .join('')
        .replaceAll('\n', ''),
    ).toBe(`${longLine}end`);
  });

  it('含引号与换行的内容按转义后体积计入上限', () => {
    const markdown = Array.from({ length: 2000 }, () => '"quoted"\\path\n').join('');
    const cards = buildCards({ summary: 's', markdown });
    for (const card of cards) expect(bytes(card)).toBeLessThanOrEqual(CARD_BYTE_LIMIT);
  });
});
