/**
 * Captures README screenshots by driving the user's system Chrome (headless) via
 * puppeteer-core against a local static server. No Chromium download.
 *
 *   node scripts/screenshots.mjs            (expects a static server on $BASE)
 *   BASE=http://localhost:5051 node scripts/screenshots.mjs
 */
import puppeteer from 'puppeteer-core';
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outDir = resolve(root, 'docs/screenshots');
mkdirSync(outDir, { recursive: true });

const BASE = process.env.BASE || 'http://localhost:5051';
const CHROME =
  process.env.CHROME ||
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--hide-scrollbars', '--force-color-profile=srgb'],
});

async function newPage(w, h) {
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: 2 });
  return page;
}

function shot(page, name, opts = {}) {
  return page.screenshot({ path: resolve(outDir, name), ...opts });
}

try {
  // 1. Landing / hero
  let p = await newPage(1280, 820);
  await p.goto(`${BASE}/public/index.html`, { waitUntil: 'networkidle0' });
  await sleep(500);
  await shot(p, 'hero.png');
  await p.close();

  // 2. Dashboard — Overview (wait for charts to render)
  p = await newPage(1320, 900);
  await p.goto(`${BASE}/extension/dashboard/index.html`, { waitUntil: 'networkidle0' });
  await sleep(1400);
  await shot(p, 'dashboard-overview.png');

  // 3. Dashboard — History (same page, switch tab)
  await p.evaluate(() => {
    const b = [...document.querySelectorAll('.nav button')].find((x) => x.textContent === 'History');
    b && b.click();
  });
  await sleep(700);
  await shot(p, 'dashboard-history.png');
  await p.close();

  // 4. Demo + interceptor modal (element screenshot, crisp)
  p = await newPage(1100, 860);
  await p.goto(`${BASE}/demo/index.html`, { waitUntil: 'networkidle0' });
  await sleep(400);
  await p.evaluate(() => {
    const i = document.getElementById('input');
    i.value =
      'config: postgres://admin:hunter2@10.0.0.5:5432/prod, email jane.doe@acme.com, card 4111 1111 1111 1111';
    document.getElementById('send').click();
  });
  await p.waitForSelector('.sentinel-root.sentinel-visible', { timeout: 5000 });
  await sleep(600);
  await shot(p, 'demo.png');
  const modal = await p.$('.sentinel-root');
  if (modal) await modal.screenshot({ path: resolve(outDir, 'modal.png') });
  await p.close();

  // 5. Popup (inject sample stats so it looks populated)
  p = await newPage(360, 470);
  await p.goto(`${BASE}/extension/popup/popup.html`, { waitUntil: 'networkidle0' });
  await p.evaluate(() => {
    document.getElementById('todayScans').textContent = '47';
    document.getElementById('todayThreats').textContent = '3';
    document.getElementById('streak').textContent = '12';
    document.getElementById('lastThreat').textContent = 'Last threat: 2 hours ago · AWS Key';
  });
  await sleep(300);
  await shot(p, 'popup.png');
  await p.close();

  console.log('screenshots written to docs/screenshots/');
} finally {
  await browser.close();
}
