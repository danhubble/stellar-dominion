const SHOTS=require('path').resolve(__dirname,'../../shots')+'/';
const GAME_URL='file://'+require('path').resolve(__dirname,'../../dist/stellar-dominion.html');
// shots_r1_b2.js — patch609c review shots: context card worst-case overflow check.
// 390x844 dpr2. Drives window.__SD, not game data directly.
const { chromium } = require('playwright-core');
const URL = GAME_URL;

async function fresh(browser) {
  const p = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const errs = []; p.on('pageerror', e => errs.push(e.message));
  await p.goto(URL);
  await p.waitForTimeout(500);
  await p.evaluate(() => { if (window.__SD && __SD.sceneOn) __SD.sceneFinish(); });
  await p.waitForFunction(() => { const el = document.getElementById('scene'); return !el || getComputedStyle(el).display === 'none'; });
  await p.waitForTimeout(300);
  return { p, errs };
}

(async () => {
  const b = await chromium.launch({ executablePath:process.env.SD_CHROME||'/opt/pw-browsers/chromium' });

  // (b2-1) an Antimatter system (longest exotic name) with a big banked balance -
  // worst case for the name+rate line the patch fixed.
  {
    const { p, errs } = await fresh(b);
    await p.evaluate(() => {
      const G = window.__SD;
      G.adopt({ ...G.fresh(), lvl: 30, lvSeen: 30, ore: 1e13, dm: 5000 });
      G.claimSystem(G.SYSMAP.hal);
      // buy a tier on hal's own (void) ladder so exoRate('am') is actually nonzero -
      // exercises the rate line, not just the balance line.
      G.S.ore = 1e10; G.S.exo.am = 5e6; G.S.buy = 1;
      const gi = G.sysNextGi('hal');
      if (gi != null) G.ladderBuy('hal', gi);
      G.S.exo.am = 4.88e6;
      G.S.msel = 'hal'; G.setMapZoom(null);
      G.S.notifyQueue = [];
      dirty = true; render();
    });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await p.waitForTimeout(150);
    const rate = await p.evaluate(() => document.getElementById('vCtxRate').textContent);
    const name = await p.evaluate(() => document.getElementById('vCtxName').textContent);
    const val = await p.evaluate(() => document.getElementById('vCtxVal').textContent);
    console.log('(b2-1) name/val/rate:', JSON.stringify({ name, val, rate }));
    await p.screenshot({ path: SHOTS+'unify-r1-b2-context-antimatter.png' });
    console.log('(b2-1) errs:', errs);
    await p.close();
  }

  // (b2-2) home selected - re-check the empty-state copy at 390px.
  {
    const { p, errs } = await fresh(b);
    await p.evaluate(() => {
      const G = window.__SD;
      G.adopt({ ...G.fresh(), lvl: 20, lvSeen: 20, ore: 5e6, dm: 400 });
      G.S.msel = 'home'; G.setMapZoom(null);
      G.S.notifyQueue = [];
      dirty = true; render();
    });
    await p.waitForTimeout(500);
    await p.evaluate(() => { const t = document.getElementById('toasts'); if (t) t.innerHTML = ''; });
    await p.waitForTimeout(150);
    const rate = await p.evaluate(() => document.getElementById('vCtxRate').textContent);
    const name = await p.evaluate(() => document.getElementById('vCtxName').textContent);
    const val = await p.evaluate(() => document.getElementById('vCtxVal').textContent);
    console.log('(b2-2) name/val/rate:', JSON.stringify({ name, val, rate }));
    await p.screenshot({ path: SHOTS+'unify-r1-b2-context-home.png' });
    console.log('(b2-2) errs:', errs);
    await p.close();
  }

  await b.close();
})().catch(err => { console.error(err); process.exit(1); });
