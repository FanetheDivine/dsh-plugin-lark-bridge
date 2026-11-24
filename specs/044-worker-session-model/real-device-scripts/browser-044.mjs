import { chromium } from 'playwright';
import { readFileSync } from 'node:fs';
const PATCH = 'D:/tmp/rdt044-home/profiles/rdt-044/cordis.patch.yml';
const SH = 'D:/tmp/rdt044-shots/';
const step = process.argv[2] ?? 'select';
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1400, height: 1300 } });
await page.goto(process.env.RDT_GUI_URL);
await page.waitForTimeout(6000);
await page.getByRole('button', { name: '本次不再提示' }).first().click().catch(() => {});
await page.waitForTimeout(800);
async function openRow(name) {
  await page.getByRole('button', { name: '插件', exact: true }).first().click();
  await page.locator('[data-plugin-package="dsh-plugin-lark-bridge"]').waitFor({ timeout: 60000 });
  await page.getByRole('button', { name: '查看 用飞书和DSH对话' }).click();
  await page.waitForTimeout(1200);
  await page.getByRole('button', { name: `配置 ${name}` }).click();
  await page.locator('[data-plugin-config]').waitFor({ timeout: 30000 });
  await page.waitForTimeout(2500);
}
const log = (k, v) => console.log(k, JSON.stringify(v));
const modelTexts = () => page.locator('[data-dsh-lark-config-model]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-dsh-lark-config-model'), e.innerText.replace(/\s+/g, ' ').slice(0, 300)]));
if (step === 'select') {
  await openRow('飞书任务与调度会话');
  log('worker field before', await modelTexts());
  await page.screenshot({ path: SH + 'b1-config-before.png' });
  // 打开工作会话模型选择器
  const field = page.locator('[data-dsh-lark-config-model="worker"]');
  await field.locator('button').first().click();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: SH + 'b2-picker-open.png' });
  log('menu', await page.locator('[role="menu"], [role="listbox"], [role="menuitem"], [role="option"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 80))));
}
if (step === 'effort') {
  await openRow('飞书任务与调度会话');
  const field = page.locator('[data-dsh-lark-config-model="worker"]');
  await field.locator('button').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Real device test mock / mock-worker').click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: SH + 'b3-after-model-click.png' });
  log('menu2', await page.locator('[role="menu"], [role="listbox"], [role="menuitem"], [role="option"], [role="menuitemradio"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 80))));
  log('field', await modelTexts());
  await field.locator('button').first().click();
  await page.waitForTimeout(1000);
  await page.getByText('Real device test mock / mock-worker').last().hover();
  await page.waitForTimeout(1000);
  await page.screenshot({ path: SH + 'b4-reopen-hover.png' });
  log('items', await page.locator('[role="menuitem"],[role="menuitemradio"],[role="option"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 80))));
}
if (step === 'save') {
  await openRow('飞书任务与调度会话');
  const field = page.locator('[data-dsh-lark-config-model="worker"]');
  await field.locator('button').first().click();
  await page.waitForTimeout(800);
  await page.getByText('Real device test mock / mock-worker').click();
  await page.waitForTimeout(800);
  await field.locator('button').first().click();
  await page.waitForTimeout(800);
  await page.getByRole('menuitem', { name: /推理等级/ }).click();
  await page.waitForTimeout(800);
  await page.screenshot({ path: SH + 'b5-effort-menu.png' });
  log('effort items', await page.locator('[role="menuitem"],[role="menuitemradio"],[role="option"]').evaluateAll((els) => els.map((e) => e.innerText.replace(/\s+/g, ' ').slice(0, 60))));
  await page.getByRole('menuitem', { name: /High/ }).click().catch(async () => page.getByText('High', { exact: true }).click());
  await page.waitForTimeout(800);
  log('field', await modelTexts());
  await page.screenshot({ path: SH + 'b6-selected.png' });
  await page.getByRole('button', { name: '保存', exact: true }).click();
  await page.waitForTimeout(4000);
  await page.screenshot({ path: SH + 'b7-saved.png' });
  log('patch', readFileSync(PATCH, 'utf8').split(String.fromCharCode(10)).filter((l) => /worker|lark-super|provider:|model:/.test(l)));
}
if (step === 'verify') {
  await openRow('飞书任务与调度会话');
  log('field after reload', await modelTexts());
  await page.screenshot({ path: SH + 'b8-after-restart.png' });
  await page.getByRole('button', { name: '返回插件' }).click().catch(() => {});
  await openRow('用飞书和DSH对话');
  log('main page model/preset', await modelTexts());
  await page.screenshot({ path: SH + 'b9-main-config.png' });
}
if (step === 'main') {
  await openRow('用飞书和DSH对话');
  log('main page', await modelTexts());
  await page.screenshot({ path: SH + 'b9-main-config.png' });
}
await browser.close();
