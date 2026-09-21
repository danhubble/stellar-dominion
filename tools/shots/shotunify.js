// shotunify.js — screenshots the 4 phone frames in unify-mock.html
// Run from /home/claude so playwright-core resolves via NODE_PATH.
const path = require('path');
const { chromium } = require('playwright-core');

const SHOTS = [
  { id: 'ph1', file: 'unify-1-map-koru.png' },
  { id: 'ph2', file: 'unify-2-map-home.png' },
  { id: 'ph3', file: 'unify-3-empire-new.png' },
  { id: 'ph4', file: 'unify-4-empire-today.png' },
];

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1400, height: 2400 },
    deviceScaleFactor: 2,
  });
  const url = 'file://' + path.join(__dirname, 'unify-mock.html');
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForTimeout(1200);

  for (const s of SHOTS) {
    const el = await page.$('#' + s.id);
    if (!el) { console.error('missing element', s.id); continue; }
    const outPath = path.join(__dirname, 'shots', s.file);
    await el.screenshot({ path: outPath });
    console.log('wrote', outPath);
  }

  await browser.close();
})().catch(err => { console.error(err); process.exit(1); });
