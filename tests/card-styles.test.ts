// 卡片正文色测试：上报与通知容器及主要内容都使用宿主正文前景令牌。
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** 读取仓库内的卡片样式。 */
function cssOf(name: string): string {
  return readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8');
}

/** 取一个选择器的规则块。 */
function ruleOf(css: string, selector: string): string {
  const source = css.replace(/\/\*[\s\S]*?\*\//g, '');
  for (const match of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    if (match[1]?.trim() === selector) return match[2] ?? '';
  }
  throw new Error(`missing CSS rule: ${selector}`);
}

/** 断言规则使用正文主前景色。 */
function expectPrimaryColor(css: string, selector: string): void {
  expect(ruleOf(css, selector)).toContain('color: var(--dsw-alias-label-primary)');
}

describe('卡片正文颜色', () => {
  it('上报容器与主要内容使用主前景色', () => {
    const css = cssOf('report-card.css');
    for (const selector of [
      '.dsh-lark-report',
      '.dsh-lark-report-body',
      '.dsh-lark-report-desc-text',
      '.dsh-lark-report-file-name',
    ]) {
      expectPrimaryColor(css, selector);
    }
  });

  it('通知容器与正文使用主前景色并保留换行', () => {
    const css = cssOf('notify-card.css');
    expectPrimaryColor(css, '.dsh-lark-notify');
    expectPrimaryColor(css, '.dsh-lark-notify-body');
    expect(ruleOf(css, '.dsh-lark-notify-body')).toContain('white-space: pre-wrap');
  });
});
