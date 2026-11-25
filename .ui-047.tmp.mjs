// 047 实机用例：配置行卡片与时间选择浮窗。在 profile 目录运行。
// 用法：RDT_REPO=<仓库> RDT_GUI_URL=<地址> node ui-047.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';

const root = process.env.RDT_PROFILE_DIR ?? dirname(fileURLToPath(import.meta.url));
const url = process.env.RDT_GUI_URL;
if (!url) throw new Error('RDT_GUI_URL 必填');
const shots = process.env.RDT_SHOTS ?? join(root, 'shots');
mkdirSync(shots, { recursive: true });

const PLUGIN = 'dsh-plugin-lark-bridge';
const PACKAGE_TITLE = '用飞书和DSH对话';
const ROW_TITLE = '飞书任务与调度会话';

const results = [];
async function check(label, fn) {
  try {
    const detail = await fn();
    results.push({ label, status: 'PASS', detail });
    console.log('PASS', label, JSON.stringify(detail ?? {}));
  } catch (e) {
    results.push({ label, status: 'FAIL', error: e?.stack ?? String(e) });
    console.error('FAIL', label, e?.stack ?? e);
  }
}

async function clickLabel(page, names, exact = true) {
  for (const name of names) {
    const btn = page.getByRole('button', { name, exact });
    if (await btn.count()) {
      await btn.first().click();
      return true;
    }
  }
  return false;
}

const browser = await chromium.launch({
  channel: 'chrome',
  headless: process.env.RDT_HEADLESS !== '0',
});
const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
const page = await context.newPage();
page.setDefaultTimeout(20000);

try {
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

  await check('U0 打开行配置页', async () => {
    if (!(await clickLabel(page, ['插件', 'Plugins']))) throw new Error('找不到插件页入口');
    await page.waitForTimeout(1500);
    const card = page.locator(`[data-plugin-package="${PLUGIN}"]`);
    await card.waitFor({ state: 'visible', timeout: 60000 });
    if (!(await clickLabel(page, [`查看 ${PACKAGE_TITLE}`, `View ${PACKAGE_TITLE}`, PACKAGE_TITLE], false))) {
      throw new Error('找不到包详情入口');
    }
    if (
      !(await clickLabel(
        page,
        [`配置 ${ROW_TITLE}`, `Configure ${ROW_TITLE}`, '配置', 'Configure'],
        false,
      ))
    ) {
      throw new Error('找不到行配置入口');
    }
    await page.locator('[data-plugin-config]').waitFor({ state: 'visible', timeout: 30000 });
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u0-config.png'), fullPage: true });
    return { url: page.url() };
  });

  await check('U1 配置行卡片与停用态', async () => {
    const rows = page.locator('[data-dsh-lark-alarm]');
    await rows.first().waitFor({ state: 'visible', timeout: 20000 });
    const count = await rows.count();
    if (count !== 3) throw new Error(`期望 3 条时间，实际 ${count}`);
    const off = await page.locator('[data-dsh-lark-alarm="alarm-demo-off"]').getAttribute('data-off');
    if (off === null) throw new Error('停用条目没有 data-off');
    const time = await page
      .locator('[data-dsh-lark-alarm="alarm-demo-local"] .dsh-lark-alarm-time')
      .innerText();
    if (!time.includes('09:15')) throw new Error(`时间按钮文案异常：${time}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u1-rows.png'), fullPage: true });
    return { count, off: true, time };
  });

  await check('U2 点时间打开编辑弹窗', async () => {
    await page.locator('[data-dsh-lark-alarm="alarm-demo-local"] .dsh-lark-alarm-time').click();
    const editor = page.locator('[data-dsh-lark-alarm-editor]');
    await editor.waitFor({ state: 'visible', timeout: 20000 });
    const value = await editor.locator('[data-slot="time-picker-input"] input').inputValue();
    if (value !== '09:15') throw new Error(`输入框回填异常：${value}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u2-editor.png'), fullPage: true });
    return { value };
  });

  await check('U3 时钟按钮展开小时与分钟两列', async () => {
    await page.locator('[data-slot="time-picker-input-trigger"]').click();
    const content = page.locator('[data-slot="popover-content"]');
    await content.waitFor({ state: 'visible', timeout: 20000 });
    const columns = content.locator('[data-slot="time-picker-column"]');
    const count = await columns.count();
    if (count !== 2) throw new Error(`期望 2 列，实际 ${count}`);
    const labels = await columns.locator('[data-slot="time-picker-column-label"]').allInnerTexts();
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u3-popover.png'), fullPage: true });
    return { count, labels };
  });

  await check('U4 选中小时 10 后时间变为 10:15', async () => {
    const content = page.locator('[data-slot="popover-content"]');
    const hourOption = content
      .locator('[data-slot="time-picker-column"]')
      .first()
      .getByRole('option', { name: '10', exact: true });
    await hourOption.click();
    await page.waitForTimeout(400);
    const value = await page
      .locator('[data-dsh-lark-alarm-editor] [data-slot="time-picker-input"] input')
      .inputValue();
    if (value !== '10:15') throw new Error(`选中小时后时间异常：${value}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u4-picked.png'), fullPage: true });
    return { value };
  });

  await check('U5 确认后配置行显示新时间', async () => {
    await page.locator('[data-slot="time-picker-confirm"]').click();
    await page.waitForTimeout(300);
    await page.getByRole('dialog').getByRole('button', { name: '确认', exact: true }).last().click();
    await page.waitForTimeout(600);
    const text = await page.locator('[data-dsh-lark-alarm="alarm-demo-local"]').innerText();
    if (!text.includes('10:15')) throw new Error(`配置行没有更新：${text}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u5-saved-row.png'), fullPage: true });
    return { text };
  });

  await check('U6 取消编辑不改动条目', async () => {
    await page.locator('[data-dsh-lark-alarm="alarm-demo-local"] .dsh-lark-alarm-time').click();
    const editor = page.locator('[data-dsh-lark-alarm-editor]');
    await editor.waitFor({ state: 'visible', timeout: 20000 });
    await editor.locator('[data-slot="time-picker-input"] input').fill('23:59');
    await editor.locator('[data-slot="time-picker-input"] input').blur();
    await page.getByRole('dialog').getByRole('button', { name: '取消', exact: true }).last().click();
    await page.waitForTimeout(500);
    const text = await page.locator('[data-dsh-lark-alarm="alarm-demo-local"]').innerText();
    if (!text.includes('10:15')) throw new Error(`取消后条目被改动：${text}`);
    return { text };
  });

  await check('U7 浮窗层级高于弹窗，可点选分钟列', async () => {
    await page.locator('[data-dsh-lark-alarm="alarm-demo-remote"] .dsh-lark-alarm-time').click();
    await page.locator('[data-dsh-lark-alarm-editor]').waitFor({ state: 'visible', timeout: 20000 });
    await page.locator('[data-slot="time-picker-input-trigger"]').click();
    const content = page.locator('[data-slot="popover-content"]');
    await content.waitFor({ state: 'visible', timeout: 20000 });
    const minuteColumn = content.locator('[data-slot="time-picker-column"]').nth(1);
    await minuteColumn.getByRole('option', { name: '30', exact: true }).click();
    await page.waitForTimeout(400);
    const value = await page
      .locator('[data-dsh-lark-alarm-editor] [data-slot="time-picker-input"] input')
      .inputValue();
    if (value !== '21:30') throw new Error(`选中分钟后时间异常：${value}`);
    await page.waitForTimeout(500);
    await page.screenshot({ path: join(shots, 'u7-minute.png'), fullPage: true });
    return { value };
  });
} finally {
  writeFileSync(join(root, 'ui-results.json'), JSON.stringify(results, null, 2));
  await browser.close();
  const failed = results.filter((r) => r.status === 'FAIL');
  console.log(`\n${results.length - failed.length}/${results.length} 通过`);
  process.exit(failed.length === 0 ? 0 : 1);
}
