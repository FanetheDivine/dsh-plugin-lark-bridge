// 诊断：卡片样式与浮窗定位。
import { chromium } from 'playwright';

const url = process.env.RDT_GUI_URL;
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(5000);
for (const name of ['继续', 'Continue']) {
  const btn = page.getByRole('button', { name, exact: true });
  if (await btn.count()) {
    await btn.first().click();
    await page.waitForTimeout(1200);
    break;
  }
}
await page.getByRole('button', { name: '插件', exact: true }).first().click();
await page.waitForTimeout(1500);
await page.locator('[data-plugin-package="dsh-plugin-lark-bridge"]').waitFor();
await page.getByRole('button', { name: '查看 用飞书和DSH对话', exact: false }).first().click();
await page.waitForTimeout(1500);
const cfgButtons = await page.getByRole('button', { name: '配置', exact: false }).allInnerTexts();
console.log('CONFIG BUTTONS', JSON.stringify(cfgButtons));
await page.getByRole('button', { name: '配置 飞书任务与调度会话', exact: false }).first().click();
await page.locator('[data-plugin-config]').waitFor();
await page.waitForTimeout(800);

const cardInfo = await page.evaluate(() => {
  const card = document.querySelector('[data-dsh-lark-alarm="alarm-demo-local"]');
  if (!card) return null;
  const cs = getComputedStyle(card);
  const rect = card.getBoundingClientRect();
  const root = getComputedStyle(document.documentElement);
  return {
    className: card.className,
    rect: { x: rect.x, y: rect.y, w: rect.width, h: rect.height },
    background: cs.backgroundColor,
    border: `${cs.borderTopWidth} ${cs.borderTopStyle} ${cs.borderTopColor}`,
    borderRadius: cs.borderTopLeftRadius,
    display: cs.display,
    flexWrap: cs.flexWrap,
    tokenLayer1: root.getPropertyValue('--dsw-alias-bg-layer-1'),
    tokenBorderL3: root.getPropertyValue('--dsw-alias-border-l3'),
    tokenRadiusMd: root.getPropertyValue('--dsw-radius-md'),
    stylesheets: [...document.styleSheets].map((s) => s.id || s.href || 'inline').slice(0, 10),
  };
});
console.log('CARD', JSON.stringify(cardInfo, null, 2));

await page.locator('[data-dsh-lark-alarm="alarm-demo-local"] .dsh-lark-alarm-time').click();
await page.locator('[data-dsh-lark-alarm-editor]').waitFor();
await page.waitForTimeout(500);
await page.locator('[data-slot="time-picker-input-trigger"]').click();
await page.waitForTimeout(800);
const popInfo = await page.evaluate(() => {
  const content = document.querySelector('[data-slot="popover-content"]');
  const trigger = document.querySelector('[data-slot="time-picker-input-trigger"]');
  if (!content) return { content: null };
  const cs = getComputedStyle(content);
  const r = content.getBoundingClientRect();
  const t = trigger?.getBoundingClientRect();
  return {
    rect: { x: r.x, y: r.y, w: r.width, h: r.height },
    trigger: t ? { x: t.x, y: t.y, w: t.width, h: t.height } : null,
    position: cs.position,
    zIndex: cs.zIndex,
    transform: cs.transform,
    parent: content.parentElement?.tagName,
    display: cs.display,
    visibility: cs.visibility,
    opacity: cs.opacity,
  };
});
console.log('POPOVER', JSON.stringify(popInfo, null, 2));
await browser.close();
