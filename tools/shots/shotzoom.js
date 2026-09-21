const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
const { chromium } = require('playwright-core');

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 460, height: 1000 },
    deviceScaleFactor: 2,
  });
  await page.goto(GAME_URL, { waitUntil: 'load' });
  await page.waitForTimeout(1200); // let the orbit animation move off its start position

  const targets = [
    { id: 'ph0', file: SHOTS+'zoom-0-today.png' },
    { id: 'phA', file: SHOTS+'zoom-a.png' },
    { id: 'phB', file: SHOTS+'zoom-b.png' },
    { id: 'phC', file: SHOTS+'zoom-c.png' },
  ];

  for (const t of targets) {
    const el = await page.$('#' + t.id);
    await el.screenshot({ path: t.file });
    console.log('saved', t.file);
  }

  await browser.close();
}

main().catch(err => { console.error(err); process.exit(1); });
